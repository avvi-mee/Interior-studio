import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { verifyAuth, verifyCronSecret, verifyTenantAccess } from "@/lib/firestoreServer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";

interface InvoiceDoc {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientId: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: string;
  projectId: string;
}

interface VendorBillDoc {
  id: string;
  vendorName: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: string;
  projectId: string;
}

function formatAmount(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

export async function POST(req: NextRequest) {
  try {
    // V-11 fix: Rate limit — max 3 reminder sends per minute per IP
    const rateLimited = rateLimit(req, { max: 3, windowMs: 60_000, keyPrefix: "payment-rem" });
    if (rateLimited) return rateLimited;

    // V-02 fix: Verify authentication — accept either JWT or cron secret
    const isCron = verifyCronSecret(req);
    let verifiedUserId: string | null = null;

    if (!isCron) {
      const { user: authUser, response: authError } = await verifyAuth(req);
      if (authError) return authError;
      verifiedUserId = authUser!.id;
    }

    const { tenantId, targetType, targetId } = await req.json();

    if (!tenantId) {
      return NextResponse.json({ success: false, error: "Missing tenantId" }, { status: 400 });
    }

    // V-02 fix: If not a cron job, verify tenant access
    if (!isCron && verifiedUserId) {
      const hasAccess = await verifyTenantAccess(verifiedUserId, tenantId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden: not a member of this tenant" }, { status: 403 });
      }
    }

    const db = getAdminDb();

    // Get tenant info
    const tenantDoc = await db.collection("tenants").doc(tenantId).get();
    const tenantData = tenantDoc.exists ? tenantDoc.data() : null;

    const businessName = tenantData?.name || "Interior Studio";
    const tenantOwnerEmail = tenantData?.email || process.env.GMAIL_USER;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 86400000);
    const deduplicationWindowMs = 24 * 60 * 60 * 1000; // 24 hours
    let sentCount = 0;

    // ==========================================
    // MANUAL SINGLE REMINDER (specific invoice or bill)
    // ==========================================
    if (targetType && targetId) {
      if (targetType === "invoice") {
        const invDoc = await db
          .collection("tenants")
          .doc(tenantId)
          .collection("invoices")
          .doc(targetId)
          .get();

        if (!invDoc.exists) {
          return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
        }

        const invData = invDoc.data()!;
        const inv: InvoiceDoc = {
          id: invDoc.id,
          invoiceNumber: invData.invoiceNumber || invData.invoice_number,
          clientName: invData.clientName || invData.client_name,
          clientId: invData.clientId || invData.client_id,
          amount: invData.amount,
          paidAmount: invData.paidAmount || invData.paid_amount || 0,
          dueDate: invData.dueDate || invData.due_date,
          status: invData.status,
          projectId: invData.projectId || invData.project_id,
        };

        const outstanding = inv.amount - inv.paidAmount;
        if (outstanding <= 0) {
          return NextResponse.json({ success: true, sent: 0, message: "Invoice already paid" });
        }

        // Dedup check: skip if reminded within last 24 hours
        const lastReminder = invData.lastReminderSentAt;
        if (lastReminder) {
          const lastMs = typeof lastReminder.toMillis === "function" ? lastReminder.toMillis() : new Date(lastReminder).getTime();
          if (now.getTime() - lastMs < deduplicationWindowMs) {
            return NextResponse.json({ success: true, sent: 0, message: "Reminder already sent within last 24 hours" });
          }
        }

        // Send reminder to tenant owner (who follows up with client)
        await transporter.sendMail({
          from: `"${businessName} - Finance" <${process.env.GMAIL_USER}>`,
          to: tenantOwnerEmail,
          subject: `Payment Reminder: ${inv.invoiceNumber} — ${formatAmount(outstanding)} outstanding`,
          html: buildSingleInvoiceEmail(inv, outstanding, businessName),
        });

        // Record reminder timestamp
        await db.collection("tenants").doc(tenantId).collection("invoices").doc(targetId).update({
          lastReminderSentAt: new Date(),
        });
        sentCount = 1;
      } else if (targetType === "bill") {
        const billDoc = await db
          .collection("tenants")
          .doc(tenantId)
          .collection("vendorBills")
          .doc(targetId)
          .get();

        if (!billDoc.exists) {
          return NextResponse.json({ success: false, error: "Vendor bill not found" }, { status: 404 });
        }

        const billData = billDoc.data()!;
        const bill: VendorBillDoc = {
          id: billDoc.id,
          vendorName: billData.vendorName || billData.vendor_name,
          amount: billData.amount,
          paidAmount: billData.paidAmount || billData.paid_amount || 0,
          dueDate: billData.dueDate || billData.due_date,
          status: billData.status,
          projectId: billData.projectId || billData.project_id,
        };

        const outstanding = bill.amount - bill.paidAmount;
        if (outstanding <= 0) {
          return NextResponse.json({ success: true, sent: 0, message: "Bill already paid" });
        }

        // Dedup check: skip if reminded within last 24 hours
        const lastBillReminder = billData.lastReminderSentAt;
        if (lastBillReminder) {
          const lastMs = typeof lastBillReminder.toMillis === "function" ? lastBillReminder.toMillis() : new Date(lastBillReminder).getTime();
          if (now.getTime() - lastMs < deduplicationWindowMs) {
            return NextResponse.json({ success: true, sent: 0, message: "Reminder already sent within last 24 hours" });
          }
        }

        await transporter.sendMail({
          from: `"${businessName} - Finance" <${process.env.GMAIL_USER}>`,
          to: tenantOwnerEmail,
          subject: `Vendor Payment Due: ${bill.vendorName} — ${formatAmount(outstanding)}`,
          html: buildSingleBillEmail(bill, outstanding, businessName),
        });

        // Record reminder timestamp
        await db.collection("tenants").doc(tenantId).collection("vendorBills").doc(targetId).update({
          lastReminderSentAt: new Date(),
        });
        sentCount = 1;
      }

      return NextResponse.json({ success: true, sent: sentCount });
    }

    // ==========================================
    // BULK REMINDERS — overdue + upcoming (due within 3 days)
    // ==========================================

    // 1. Fetch unpaid invoices (status in ["sent", "partial", "overdue"])
    const invoicesSnap = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("invoices")
      .where("status", "in", ["sent", "partial", "overdue"])
      .get();

    const overdueInvoices: InvoiceDoc[] = [];
    const upcomingInvoices: InvoiceDoc[] = [];

    invoicesSnap.docs.forEach((docSnap) => {
      const row = docSnap.data();

      // Dedup: skip if reminded within last 24 hours
      const lastReminder = row.lastReminderSentAt;
      if (lastReminder) {
        const lastMs = typeof lastReminder.toMillis === "function" ? lastReminder.toMillis() : new Date(lastReminder).getTime();
        if (now.getTime() - lastMs < deduplicationWindowMs) return;
      }

      const inv: InvoiceDoc = {
        id: docSnap.id,
        invoiceNumber: row.invoiceNumber || row.invoice_number,
        clientName: row.clientName || row.client_name,
        clientId: row.clientId || row.client_id,
        amount: row.amount,
        paidAmount: row.paidAmount || row.paid_amount || 0,
        dueDate: row.dueDate || row.due_date,
        status: row.status,
        projectId: row.projectId || row.project_id,
      };
      if (inv.paidAmount >= inv.amount) return;
      const dueDateMs = new Date(inv.dueDate).getTime();
      if (dueDateMs > 0 && dueDateMs < now.getTime()) {
        overdueInvoices.push(inv);
      } else if (dueDateMs > 0 && dueDateMs <= threeDaysFromNow.getTime()) {
        upcomingInvoices.push(inv);
      }
    });

    // 2. Fetch unpaid vendor bills (status in ["pending", "partial", "overdue"])
    const billsSnap = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("vendorBills")
      .where("status", "in", ["pending", "partial", "overdue"])
      .get();

    const overdueBills: VendorBillDoc[] = [];
    const upcomingBills: VendorBillDoc[] = [];

    billsSnap.docs.forEach((docSnap) => {
      const row = docSnap.data();

      // Dedup: skip if reminded within last 24 hours
      const lastBillReminder = row.lastReminderSentAt;
      if (lastBillReminder) {
        const lastMs = typeof lastBillReminder.toMillis === "function" ? lastBillReminder.toMillis() : new Date(lastBillReminder).getTime();
        if (now.getTime() - lastMs < deduplicationWindowMs) return;
      }

      const bill: VendorBillDoc = {
        id: docSnap.id,
        vendorName: row.vendorName || row.vendor_name,
        amount: row.amount,
        paidAmount: row.paidAmount || row.paid_amount || 0,
        dueDate: row.dueDate || row.due_date,
        status: row.status,
        projectId: row.projectId || row.project_id,
      };
      if (bill.paidAmount >= bill.amount) return;
      const dueDateMs = new Date(bill.dueDate).getTime();
      if (dueDateMs > 0 && dueDateMs < now.getTime()) {
        overdueBills.push(bill);
      } else if (dueDateMs > 0 && dueDateMs <= threeDaysFromNow.getTime()) {
        upcomingBills.push(bill);
      }
    });

    const totalItems = overdueInvoices.length + upcomingInvoices.length + overdueBills.length + upcomingBills.length;

    if (totalItems === 0) {
      return NextResponse.json({ success: true, sent: 0, message: "No overdue or upcoming items" });
    }

    // 3. Send digest email to tenant owner
    const overdueInvHtml = buildInvoiceTable(overdueInvoices, "#dc2626", "Overdue Invoices");
    const upcomingInvHtml = buildInvoiceTable(upcomingInvoices, "#d97706", "Upcoming Due Invoices (next 3 days)");
    const overdueBillHtml = buildBillTable(overdueBills, "#dc2626", "Overdue Vendor Bills");
    const upcomingBillHtml = buildBillTable(upcomingBills, "#d97706", "Upcoming Vendor Bills (next 3 days)");

    await transporter.sendMail({
      from: `"${businessName} - Finance" <${process.env.GMAIL_USER}>`,
      to: tenantOwnerEmail,
      subject: `Payment Digest: ${totalItems} item${totalItems > 1 ? "s" : ""} need attention`,
      html: `
        <div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:32px;">
          <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px;padding:24px;margin-bottom:24px;">
            <h2 style="color:#fff;margin:0;">Payment Reminders</h2>
            <p style="color:#94a3b8;margin:8px 0 0;font-size:14px;">
              ${totalItems} financial item${totalItems > 1 ? "s" : ""} need your attention.
            </p>
          </div>
          ${overdueInvHtml}
          ${upcomingInvHtml}
          ${overdueBillHtml}
          ${upcomingBillHtml}
          <p style="color:#64748b;font-size:13px;margin-top:24px;">
            Log in to your Finance dashboard to record payments and manage these items.
          </p>
        </div>
      `,
    });
    sentCount = 1;

    // Record lastReminderSentAt on all included items to prevent re-sending
    const batch = db.batch();
    const reminderTimestamp = new Date();
    for (const inv of [...overdueInvoices, ...upcomingInvoices]) {
      batch.update(
        db.collection("tenants").doc(tenantId).collection("invoices").doc(inv.id),
        { lastReminderSentAt: reminderTimestamp }
      );
    }
    for (const bill of [...overdueBills, ...upcomingBills]) {
      batch.update(
        db.collection("tenants").doc(tenantId).collection("vendorBills").doc(bill.id),
        { lastReminderSentAt: reminderTimestamp }
      );
    }
    await batch.commit();

    return NextResponse.json({
      success: true,
      sent: sentCount,
      overdueInvoices: overdueInvoices.length,
      upcomingInvoices: upcomingInvoices.length,
      overdueBills: overdueBills.length,
      upcomingBills: upcomingBills.length,
    });
  } catch (error) {
    console.error("Payment reminder error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// ==========================================
// Email template helpers
// ==========================================

function buildSingleInvoiceEmail(inv: InvoiceDoc, outstanding: number, businessName: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="color:#fff;margin:0;">Invoice Payment Reminder</h2>
        <p style="color:#94a3b8;margin:8px 0 0;font-size:14px;">${businessName}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Invoice #</td>
          <td style="padding:10px 0;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;">${inv.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Client</td>
          <td style="padding:10px 0;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;">${inv.clientName}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Total Amount</td>
          <td style="padding:10px 0;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;">${formatAmount(inv.amount)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Outstanding</td>
          <td style="padding:10px 0;color:#dc2626;font-weight:700;font-size:18px;border-bottom:1px solid #f1f5f9;">${formatAmount(outstanding)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#64748b;font-size:14px;">Due Date</td>
          <td style="padding:10px 0;color:#0f172a;font-weight:600;">${formatDate(inv.dueDate)}</td>
        </tr>
      </table>
      <p style="color:#64748b;font-size:13px;">Follow up with the client to collect this payment.</p>
    </div>
  `;
}

function buildSingleBillEmail(bill: VendorBillDoc, outstanding: number, businessName: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="color:#fff;margin:0;">Vendor Payment Due</h2>
        <p style="color:#94a3b8;margin:8px 0 0;font-size:14px;">${businessName}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Vendor</td>
          <td style="padding:10px 0;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;">${bill.vendorName}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Total Amount</td>
          <td style="padding:10px 0;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;">${formatAmount(bill.amount)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Outstanding</td>
          <td style="padding:10px 0;color:#dc2626;font-weight:700;font-size:18px;border-bottom:1px solid #f1f5f9;">${formatAmount(outstanding)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#64748b;font-size:14px;">Due Date</td>
          <td style="padding:10px 0;color:#0f172a;font-weight:600;">${formatDate(bill.dueDate)}</td>
        </tr>
      </table>
      <p style="color:#64748b;font-size:13px;">Process this vendor payment to avoid delays.</p>
    </div>
  `;
}

function buildInvoiceTable(items: InvoiceDoc[], color: string, label: string): string {
  if (items.length === 0) return "";
  const rows = items
    .map((inv) => {
      const outstanding = inv.amount - inv.paidAmount;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-family:monospace;">${inv.invoiceNumber}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;">${inv.clientName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#dc2626;font-weight:600;font-size:14px;">${formatAmount(outstanding)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#475569;font-size:14px;">${formatDate(inv.dueDate)}</td>
      </tr>`;
    })
    .join("");

  return `
    <div style="margin-bottom:24px;">
      <h3 style="color:${color};font-size:16px;margin:0 0 12px;">${label} (${items.length})</h3>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Invoice #</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Client</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Outstanding</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Due Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function buildBillTable(items: VendorBillDoc[], color: string, label: string): string {
  if (items.length === 0) return "";
  const rows = items
    .map((bill) => {
      const outstanding = bill.amount - bill.paidAmount;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;">${bill.vendorName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#dc2626;font-weight:600;font-size:14px;">${formatAmount(outstanding)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#475569;font-size:14px;">${formatDate(bill.dueDate)}</td>
      </tr>`;
    })
    .join("");

  return `
    <div style="margin-bottom:24px;">
      <h3 style="color:${color};font-size:16px;margin:0 0 12px;">${label} (${items.length})</h3>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Vendor</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Outstanding</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Due Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
