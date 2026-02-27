import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
    const { name, email, phone, projectType, totalAmount, tenantId, tenantEmail, tenantBusinessName } = await req.json();

    if (!email || !name) {
        return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    const businessName = tenantBusinessName || "Interior Studio";
    const formattedAmount = `₹ ${Number(totalAmount).toLocaleString("en-IN")}`;

    try {
        // 1. Welcome email to CLIENT
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
                        <p style="margin: 0; color: #64748B; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Estimated Cost</p>
                        <p style="margin: 8px 0 0; color: #0F172A; font-size: 32px; font-weight: 700;">${formattedAmount}</p>
                    </div>
                    <p style="color: #475569; font-size: 16px;">
                        Our design team will review your requirements and get in touch with you shortly to discuss the next steps.
                    </p>
                    <p style="color: #94A3B8; font-size: 14px; margin-top: 32px;">
                        This estimate is indicative and subject to site visit and final measurements.
                    </p>
                </div>
            `,
        });

        // 2. Lead notification to TENANT OWNER (company owner, NOT super admin)
        const ownerEmail = tenantEmail;
        if (ownerEmail) {
            await transporter.sendMail({
                from: `"${businessName} - Leads" <${process.env.GMAIL_USER}>`,
                to: ownerEmail,
                subject: `New Lead: ${name} — ${formattedAmount}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
                        <div style="background: linear-gradient(135deg, #0F172A, #1E293B); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                            <h2 style="color: #ffffff; margin: 0;">New Lead Received!</h2>
                            <p style="color: #94A3B8; margin: 8px 0 0; font-size: 14px;">A potential client just submitted an estimate on your website.</p>
                        </div>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 12px 0; color: #64748B; font-size: 14px; width: 140px; border-bottom: 1px solid #F1F5F9;">Name</td>
                                <td style="padding: 12px 0; color: #0F172A; font-weight: 600; border-bottom: 1px solid #F1F5F9;">${name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 0; color: #64748B; font-size: 14px; border-bottom: 1px solid #F1F5F9;">Phone</td>
                                <td style="padding: 12px 0; color: #0F172A; font-weight: 600; border-bottom: 1px solid #F1F5F9;">+91 ${phone}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 0; color: #64748B; font-size: 14px; border-bottom: 1px solid #F1F5F9;">Email</td>
                                <td style="padding: 12px 0; color: #0F172A; font-weight: 600; border-bottom: 1px solid #F1F5F9;">${email}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 0; color: #64748B; font-size: 14px; border-bottom: 1px solid #F1F5F9;">Project Type</td>
                                <td style="padding: 12px 0; color: #0F172A; font-weight: 600; border-bottom: 1px solid #F1F5F9;">${projectType}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 0; color: #64748B; font-size: 14px;">Estimate</td>
                                <td style="padding: 12px 0; color: #0F172A; font-weight: 700; font-size: 18px;">${formattedAmount}</td>
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
