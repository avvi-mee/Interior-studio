import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import nodemailer from "nodemailer";

function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function emailToDocId(email: string): string {
    return email.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 100);
}

export async function POST(req: NextRequest) {
    try {
        const rateLimited = rateLimit(req, { max: 5, windowMs: 60_000, keyPrefix: "send-otp" });
        if (rateLimited) return rateLimited;

        const { email, name } = await req.json();

        if (!email || !email.includes("@")) {
            return NextResponse.json({ success: false, error: "Valid email required" }, { status: 400 });
        }

        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        // Store OTP in Firestore (Admin SDK — bypasses security rules, survives serverless restarts)
        const db = getAdminDb();
        await db.collection("otpVerifications").doc(emailToDocId(email)).set({
            otp,
            email: email.toLowerCase(),
            name: name || "",
            expiresAt,
            createdAt: new Date().toISOString(),
        });

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        await transporter.sendMail({
            from: `"Interior Studio" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: "Your verification code",
            html: `
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                    <h2 style="color: #0F172A; margin-bottom: 8px;">Verify your email</h2>
                    <p style="color: #475569; font-size: 16px;">Hi ${name || "there"},</p>
                    <p style="color: #475569; font-size: 16px;">
                        Use this code to complete your sign up. It expires in <strong>15 minutes</strong>.
                    </p>
                    <div style="background: #F8FAFC; border-radius: 16px; padding: 32px; margin: 24px 0;
                                text-align: center; border: 2px solid #E2E8F0;">
                        <span style="color: #0F172A; font-size: 48px; font-weight: 800; letter-spacing: 16px;">${otp}</span>
                    </div>
                    <p style="color: #94A3B8; font-size: 13px; margin-top: 16px;">
                        If you did not request this, you can safely ignore this email.
                    </p>
                </div>
            `,
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Send OTP error:", err);
        return NextResponse.json({ success: false, error: err.message || "Failed to send OTP" }, { status: 500 });
    }
}
