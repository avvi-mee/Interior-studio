import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { verifyAuth, verifyCronSecret, verifyTenantAccess } from "@/lib/firestoreServer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";

interface FollowUpDoc {
  id: string;
  leadId: string;
  type: string;
  scheduledAt: string;
  status: string;
  notes?: string;
  lastReminderSentAt?: string | null;
}

interface LeadDoc {
  name: string;
  phone: string;
  email: string;
  assignedTo?: string;
}

interface EmployeeDoc {
  full_name: string;
  email: string;
}

export async function POST(req: NextRequest) {
  try {
    // V-11 fix: Rate limit — max 3 reminder sends per minute per IP
    const rateLimited = rateLimit(req, { max: 3, windowMs: 60_000, keyPrefix: "followup-rem" });
    if (rateLimited) return rateLimited;

    // V-02 fix: Verify authentication — accept either JWT or cron secret
    const isCron = verifyCronSecret(req);
    if (!isCron) {
      const { user: authUser, response: authError } = await verifyAuth(req);
      if (authError) return authError;

      const body = await req.json();
      const tenantId = body.tenantId;

      if (!tenantId) {
        return NextResponse.json({ success: false, error: "Missing tenantId" }, { status: 400 });
      }

      // Verify the user has access to this tenant
      const hasAccess = await verifyTenantAccess(authUser!.id, tenantId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden: not a member of this tenant" }, { status: 403 });
      }

      // Continue with verified tenantId — fall through to main logic below
      return await processFollowUpReminders(tenantId);
    }

    // Cron path: tenantId comes from body (trusted because cron secret verified)
    const { tenantId } = await req.json();

    if (!tenantId) {
      return NextResponse.json({ success: false, error: "Missing tenantId" }, { status: 400 });
    }

    return await processFollowUpReminders(tenantId);
  } catch (error) {
    console.error("Follow-up reminder error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

async function processFollowUpReminders(tenantId: string) {
    const db = getAdminDb();

    // 1. Query pending follow-ups from tenants/{tenantId}/followUps
    const followUpsSnap = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("followUps")
      .where("status", "==", "pending")
      .get();

    if (followUpsSnap.empty) {
      return NextResponse.json({ success: true, sent: 0, totalFollowUps: 0, overdueCount: 0, todayCount: 0 });
    }

    const now = new Date();
    const nowMs = now.getTime();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const overdue: FollowUpDoc[] = [];
    const dueToday: FollowUpDoc[] = [];

    followUpsSnap.docs.forEach((docSnap) => {
      const row = docSnap.data();
      const fu: FollowUpDoc = {
        id: docSnap.id,
        leadId: row.leadId || row.lead_id,
        type: row.type,
        scheduledAt: row.scheduledAt || row.scheduled_at,
        status: row.status,
        notes: row.notes,
        lastReminderSentAt: row.lastReminderSentAt ?? null,
      };

      // Skip if reminded within the last 22 hours (dedup for cron retries)
      if (fu.lastReminderSentAt) {
        const lastMs = new Date(fu.lastReminderSentAt as string).getTime();
        if (nowMs - lastMs < 22 * 60 * 60 * 1000) return;
      }

      const scheduledMs = new Date(fu.scheduledAt).getTime();
      if (scheduledMs > 0 && scheduledMs < todayStart.getTime()) {
        overdue.push(fu);
      } else if (scheduledMs >= todayStart.getTime() && scheduledMs < todayEnd.getTime()) {
        dueToday.push(fu);
      }
    });

    if (overdue.length === 0 && dueToday.length === 0) {
      return NextResponse.json({ success: true, sent: 0, totalFollowUps: 0, overdueCount: 0, todayCount: 0 });
    }

    // 2. Collect unique lead IDs and fetch lead docs
    const allFollowUps = [...overdue, ...dueToday];
    const leadIds = [...new Set(allFollowUps.map((f) => f.leadId))];
    const leadMap = new Map<string, LeadDoc>();

    // Firestore 'in' queries support max 30 items at a time
    for (let i = 0; i < leadIds.length; i += 30) {
      const batch = leadIds.slice(i, i + 30);
      const leadsSnap = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("leads")
        .where("__name__", "in", batch)
        .get();

      leadsSnap.docs.forEach((docSnap) => {
        const row = docSnap.data();
        leadMap.set(docSnap.id, {
          name: row.name,
          phone: row.phone,
          email: row.email,
          assignedTo: row.assignedTo || row.assigned_to,
        });
      });
    }

    // 3. Collect assigned employee IDs and fetch employee docs
    const employeeIds = [...new Set(
      Array.from(leadMap.values())
        .map((l) => l.assignedTo)
        .filter(Boolean) as string[]
    )];
    const employeeMap = new Map<string, EmployeeDoc>();

    if (employeeIds.length > 0) {
      for (let i = 0; i < employeeIds.length; i += 30) {
        const batch = employeeIds.slice(i, i + 30);
        // Batch fetch employees (mirrors lead fetch pattern above)
        const empSnap = await db
          .collection("tenants")
          .doc(tenantId)
          .collection("employees")
          .where("__name__", "in", batch)
          .get();
        empSnap.docs.forEach((empDoc) => {
          const row = empDoc.data();
          employeeMap.set(empDoc.id, {
            full_name: row.full_name || row.fullName || row.name,
            email: row.email,
          });
        });
      }
    }

    // 4. Get tenant owner email as fallback
    const tenantDoc = await db.collection("tenants").doc(tenantId).get();
    const tenantData = tenantDoc.exists ? tenantDoc.data() : null;

    const fallbackEmail = tenantData?.email || process.env.GMAIL_USER;
    const businessName = tenantData?.name || "Interior Studio";

    // 5. Group follow-ups by recipient email
    const recipientGroups = new Map<string, { overdue: typeof overdue; today: typeof dueToday }>();

    for (const fu of allFollowUps) {
      const lead = leadMap.get(fu.leadId);
      const assignedEmp = lead?.assignedTo ? employeeMap.get(lead.assignedTo) : null;
      const recipientEmail = assignedEmp?.email || fallbackEmail;

      if (!recipientEmail) continue;

      if (!recipientGroups.has(recipientEmail)) {
        recipientGroups.set(recipientEmail, { overdue: [], today: [] });
      }
      const group = recipientGroups.get(recipientEmail)!;
      if (overdue.includes(fu)) {
        group.overdue.push(fu);
      } else {
        group.today.push(fu);
      }
    }

    // 6. Send digest emails
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const formatDate = (isoStr: string) => {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
    };

    const buildTable = (items: FollowUpDoc[], color: string, label: string) => {
      if (items.length === 0) return "";
      const rows = items
        .map((fu) => {
          const lead = leadMap.get(fu.leadId);
          return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;">${lead?.name || "Unknown"}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#475569;font-size:14px;">${lead?.phone || "-"}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#475569;font-size:14px;text-transform:capitalize;">${fu.type.replace(/_/g, " ")}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#475569;font-size:14px;">${formatDate(fu.scheduledAt)}</td>
          </tr>`;
        })
        .join("");

      return `
        <div style="margin-bottom:24px;">
          <h3 style="color:${color};font-size:16px;margin:0 0 12px;">${label} (${items.length})</h3>
          <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Client</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Phone</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Type</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Scheduled</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    };

    let sentCount = 0;

    for (const [email, group] of recipientGroups) {
      const overdueHtml = buildTable(group.overdue, "#dc2626", "Overdue Follow-ups");
      const todayHtml = buildTable(group.today, "#d97706", "Due Today");

      const totalCount = group.overdue.length + group.today.length;

      await transporter.sendMail({
        from: `"${businessName} - Reminders" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `Follow-up Reminder: ${totalCount} pending follow-up${totalCount > 1 ? "s" : ""}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
            <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px;padding:24px;margin-bottom:24px;">
              <h2 style="color:#fff;margin:0;">Follow-up Reminders</h2>
              <p style="color:#94a3b8;margin:8px 0 0;font-size:14px;">You have ${totalCount} follow-up${totalCount > 1 ? "s" : ""} that need attention.</p>
            </div>
            ${overdueHtml}
            ${todayHtml}
            <p style="color:#64748b;font-size:13px;margin-top:24px;">
              Log in to your dashboard to manage these follow-ups.
            </p>
          </div>
        `,
      });

      sentCount++;
    }

    // Stamp lastReminderSentAt on all reminded follow-ups to prevent duplicate sends
    if (sentCount > 0 && allFollowUps.length > 0) {
      const reminderTimestamp = new Date().toISOString();
      const batchWrite = db.batch();
      for (const fu of allFollowUps) {
        batchWrite.update(
          db.collection("tenants").doc(tenantId).collection("followUps").doc(fu.id),
          { lastReminderSentAt: reminderTimestamp }
        );
      }
      await batchWrite.commit();
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      totalFollowUps: allFollowUps.length,
      overdueCount: overdue.length,
      todayCount: dueToday.length,
    });
}
