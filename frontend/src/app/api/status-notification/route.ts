import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { verifyAuth, verifyTenantAccess } from "@/lib/firestoreServer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const rateLimited = rateLimit(req, { max: 10, windowMs: 60_000, keyPrefix: "status-notif" });
    if (rateLimited) return rateLimited;

    const { user: authUser, response: authError } = await verifyAuth(req);
    if (authError) return authError;

    const { tenantId, projectId, clientEmail, clientName, projectName, statusType, entityName, newStatus } = await req.json();

    if (!tenantId || !projectId || !clientEmail) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const hasAccess = await verifyTenantAccess(authUser!.id, tenantId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const tenantDoc = await db.collection("tenants").doc(tenantId).get();
    const tenantData = tenantDoc.exists ? tenantDoc.data() : null;
    const businessName = tenantData?.name || "Interior Studio";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const displayStatus = newStatus.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    const displayType = statusType === "project" ? "Project" : "Phase";
    const subject = statusType === "project"
      ? `Project Update: "${projectName || "Your Project"}" is now ${displayStatus}`
      : `Project Update: Phase "${entityName}" is now ${displayStatus}`;

    await transporter.sendMail({
      from: `"${businessName}" <${process.env.GMAIL_USER}>`,
      to: clientEmail,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
          <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px;padding:24px;margin-bottom:24px;">
            <h2 style="color:#fff;margin:0;">Project Status Update</h2>
            <p style="color:#94a3b8;margin:8px 0 0;font-size:14px;">${businessName}</p>
          </div>
          <p style="color:#475569;font-size:16px;">Hi ${clientName || "there"},</p>
          <p style="color:#475569;font-size:16px;">
            ${statusType === "project"
              ? `Your project <strong>"${projectName || "Your Project"}"</strong> status has been updated.`
              : `The phase <strong>"${entityName}"</strong> in your project <strong>"${projectName || "Your Project"}"</strong> has been updated.`
            }
          </p>
          <div style="background:#f8fafc;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
            <p style="margin:0;color:#64748b;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;">${displayType} Status</p>
            <p style="margin:8px 0 0;color:#0f172a;font-size:24px;font-weight:700;">${displayStatus}</p>
          </div>
          <p style="color:#475569;font-size:16px;">
            Log in to your dashboard to view the latest progress on your project.
          </p>
          <p style="color:#94a3b8;font-size:13px;margin-top:32px;">
            If you have any questions, please contact us directly.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Status notification error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
