import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
    // Rate limit: 10 emails per minute per IP
    const rateLimitResponse = rateLimit(req, { max: 10, windowMs: 60_000, keyPrefix: "send-email" });
    if (rateLimitResponse) return rateLimitResponse;

    const {
        type,
        name, email, phone,
        projectType, totalAmount,
        tenantId, tenantEmail, tenantBusinessName,
        // lead_won fields
        leadName, clientEmail, estimatedValue,
        // project_assigned fields
        memberEmail, memberName, role, projectName,
    } = await req.json();

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    const businessName = tenantBusinessName || "Interior Studio";

    try {
        // ── Welcome email (sent right after signup, no estimate data needed) ──
        if (type === "welcome") {
            await transporter.sendMail({
                from: `"${businessName}" <${process.env.GMAIL_USER}>`,
                to: email,
                subject: `Welcome to ${businessName}! 🎉`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
                        <div style="background: linear-gradient(135deg, #0F172A, #1E293B);
                                    border-radius: 16px; padding: 32px; margin-bottom: 28px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome, ${name}!</h1>
                            <p style="color: #94A3B8; margin: 12px 0 0; font-size: 15px;">
                                Your account has been created successfully.
                            </p>
                        </div>
                        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                            We're thrilled to have you on board at <strong>${businessName}</strong>.
                            You're just moments away from seeing your personalised interior design estimate.
                        </p>
                        <div style="background: #F8FAFC; border-radius: 12px; padding: 20px; margin: 24px 0;">
                            <p style="margin: 0 0 8px; color: #64748B; font-size: 14px; font-weight: 600;
                                       text-transform: uppercase; letter-spacing: 0.05em;">What happens next?</p>
                            <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 15px; line-height: 1.8;">
                                <li>Review your detailed cost breakdown</li>
                                <li>Our design team will reach out to discuss your project</li>
                                <li>Get a site visit booked at your convenience</li>
                            </ul>
                        </div>
                        <p style="color: #94A3B8; font-size: 13px; margin-top: 32px;">
                            You can always log back in to view your estimates and project updates from your dashboard.
                        </p>
                    </div>
                `,
            });
            return NextResponse.json({ success: true });
        }

        // ── Lead won: notify owner + client ──
        if (type === "lead_won") {
            const formattedValue = estimatedValue
                ? `₹ ${Number(estimatedValue).toLocaleString("en-IN")}`
                : "—";

            if (tenantEmail) {
                await transporter.sendMail({
                    from: `"${businessName} - Leads" <${process.env.GMAIL_USER}>`,
                    to: tenantEmail,
                    subject: `Lead Converted: "${leadName || name}" is now a Project`,
                    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
                      <div style="background:linear-gradient(135deg,#0F172A,#1E293B);border-radius:12px;padding:24px;margin-bottom:24px;">
                        <h2 style="color:#fff;margin:0;">Lead Won!</h2>
                        <p style="color:#94A3B8;margin:8px 0 0;font-size:14px;">A lead has been converted to an active project.</p>
                      </div>
                      <table style="width:100%;border-collapse:collapse;">
                        <tr>
                          <td style="padding:10px 0;color:#64748B;font-size:14px;width:140px;border-bottom:1px solid #F1F5F9;">Client</td>
                          <td style="padding:10px 0;color:#0F172A;font-weight:600;border-bottom:1px solid #F1F5F9;">${leadName || name || "—"}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 0;color:#64748B;font-size:14px;border-bottom:1px solid #F1F5F9;">Email</td>
                          <td style="padding:10px 0;color:#0F172A;font-weight:600;border-bottom:1px solid #F1F5F9;">${clientEmail || email || "—"}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 0;color:#64748B;font-size:14px;border-bottom:1px solid #F1F5F9;">Phone</td>
                          <td style="padding:10px 0;color:#0F172A;font-weight:600;border-bottom:1px solid #F1F5F9;">${phone || "—"}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 0;color:#64748B;font-size:14px;">Contract Value</td>
                          <td style="padding:10px 0;color:#0F172A;font-weight:700;font-size:18px;">${formattedValue}</td>
                        </tr>
                      </table>
                      <p style="color:#475569;font-size:14px;margin-top:24px;">Log in to your Projects dashboard to manage this project.</p>
                    </div>`,
                });
            }

            const recipientEmail = clientEmail || email;
            if (recipientEmail) {
                await transporter.sendMail({
                    from: `"${businessName}" <${process.env.GMAIL_USER}>`,
                    to: recipientEmail,
                    subject: `Your project with ${businessName} is now underway!`,
                    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
                      <div style="background:linear-gradient(135deg,#0F172A,#1E293B);border-radius:12px;padding:24px;margin-bottom:24px;">
                        <h2 style="color:#fff;margin:0;">Your Project Has Started!</h2>
                        <p style="color:#94A3B8;margin:8px 0 0;font-size:14px;">${businessName}</p>
                      </div>
                      <p style="color:#475569;font-size:16px;">Hi ${leadName || name},</p>
                      <p style="color:#475569;font-size:16px;">
                        We're thrilled to confirm that your interior design project with
                        <strong>${businessName}</strong> is officially underway.
                        Our team will be in touch shortly to arrange a site visit and discuss timelines.
                      </p>
                    </div>`,
                });
            }

            return NextResponse.json({ success: true });
        }

        // ── Project assigned: notify employee ──
        if (type === "project_assigned") {
            if (!memberEmail) {
                return NextResponse.json({ success: false, error: "Missing memberEmail" }, { status: 400 });
            }
            const displayRole = role
                ? role.charAt(0).toUpperCase() + role.slice(1)
                : "Team Member";

            await transporter.sendMail({
                from: `"${businessName}" <${process.env.GMAIL_USER}>`,
                to: memberEmail,
                subject: `You've been assigned as ${displayRole} on "${projectName || "a project"}"`,
                html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
                  <div style="background:linear-gradient(135deg,#0F172A,#1E293B);border-radius:12px;padding:24px;margin-bottom:24px;">
                    <h2 style="color:#fff;margin:0;">Project Assignment</h2>
                    <p style="color:#94A3B8;margin:8px 0 0;font-size:14px;">${businessName}</p>
                  </div>
                  <p style="color:#475569;font-size:16px;">Hi ${memberName || "there"},</p>
                  <p style="color:#475569;font-size:16px;">
                    You have been assigned as <strong>${displayRole}</strong> on the project
                    <strong>"${projectName || "a new project"}"</strong>.
                  </p>
                  <div style="background:#F8FAFC;border-radius:12px;padding:20px;margin:24px 0;">
                    <p style="margin:0;color:#64748B;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Your Role</p>
                    <p style="margin:8px 0 0;color:#0F172A;font-size:22px;font-weight:700;">${displayRole}</p>
                  </div>
                  <p style="color:#475569;font-size:16px;">Log in to your employee dashboard to view project details and your tasks.</p>
                </div>`,
            });

            return NextResponse.json({ success: true });
        }

        // ── Estimate confirmation + lead notification (default flow) ──
        if (!email || !name) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }
        const formattedAmount = `₹ ${Number(totalAmount).toLocaleString("en-IN")}`;

        // 1. Estimate ready email → customer
        await transporter.sendMail({
            from: `"${businessName}" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: "Your Interior Design Estimate is Ready!",
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
                    <h2 style="color: #0F172A;">Hi ${name},</h2>
                    <p style="color: #475569; font-size: 16px;">
                        Thank you for using our estimate tool! We've received your request for a
                        <strong>${projectType}</strong> project.
                    </p>
                    <div style="background: #F8FAFC; border-radius: 12px; padding: 24px; margin: 24px 0;">
                        <p style="margin: 0; color: #64748B; font-size: 14px; text-transform: uppercase;
                                   letter-spacing: 0.05em;">Estimated Cost</p>
                        <p style="margin: 8px 0 0; color: #0F172A; font-size: 32px; font-weight: 700;">
                            ${formattedAmount}
                        </p>
                    </div>
                    <p style="color: #475569; font-size: 16px;">
                        Our design team will review your requirements and get in touch with you shortly
                        to discuss the next steps.
                    </p>
                    <p style="color: #94A3B8; font-size: 14px; margin-top: 32px;">
                        This estimate is indicative and subject to site visit and final measurements.
                    </p>
                </div>
            `,
        });

        // 2. Lead notification → tenant owner (business admin)
        if (tenantEmail) {
            await transporter.sendMail({
                from: `"${businessName} - Leads" <${process.env.GMAIL_USER}>`,
                to: tenantEmail,
                subject: `New Lead: ${name} — ${formattedAmount}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
                        <div style="background: linear-gradient(135deg, #0F172A, #1E293B);
                                    border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                            <h2 style="color: #ffffff; margin: 0;">New Lead Received!</h2>
                            <p style="color: #94A3B8; margin: 8px 0 0; font-size: 14px;">
                                A potential client just submitted an estimate on your website.
                            </p>
                        </div>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 12px 0; color: #64748B; font-size: 14px; width: 140px;
                                           border-bottom: 1px solid #F1F5F9;">Name</td>
                                <td style="padding: 12px 0; color: #0F172A; font-weight: 600;
                                           border-bottom: 1px solid #F1F5F9;">${name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 0; color: #64748B; font-size: 14px;
                                           border-bottom: 1px solid #F1F5F9;">Phone</td>
                                <td style="padding: 12px 0; color: #0F172A; font-weight: 600;
                                           border-bottom: 1px solid #F1F5F9;">+91 ${phone || "—"}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 0; color: #64748B; font-size: 14px;
                                           border-bottom: 1px solid #F1F5F9;">Email</td>
                                <td style="padding: 12px 0; color: #0F172A; font-weight: 600;
                                           border-bottom: 1px solid #F1F5F9;">${email}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 0; color: #64748B; font-size: 14px;
                                           border-bottom: 1px solid #F1F5F9;">Project Type</td>
                                <td style="padding: 12px 0; color: #0F172A; font-weight: 600;
                                           border-bottom: 1px solid #F1F5F9;">${projectType}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 0; color: #64748B; font-size: 14px;">Estimate</td>
                                <td style="padding: 12px 0; color: #0F172A; font-weight: 700;
                                           font-size: 18px;">${formattedAmount}</td>
                            </tr>
                        </table>
                        <p style="color: #475569; font-size: 14px; margin-top: 24px;">
                            Log in to your dashboard to view the full estimate details and follow up with this lead.
                        </p>
                    </div>
                `,
            });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Email send error:", err);
        return NextResponse.json({ success: false, error: "Email failed" }, { status: 500 });
    }
}
