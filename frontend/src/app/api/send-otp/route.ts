import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { setOtp } from "@/lib/otpStore";

export async function POST(req: NextRequest) {
    const { email, name } = await req.json();

    if (!email) {
        return NextResponse.json({ success: false, error: "Email required" }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in shared global store
    setOtp(email, otp);

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    try {
        await transporter.sendMail({
            from: `"Interior Studio" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: `Your verification code: ${otp}`,
            html: `
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                    <h2 style="color: #0F172A; margin-bottom: 8px;">Hi ${name || "there"},</h2>
                    <p style="color: #475569; font-size: 16px;">
                        Your verification code for your interior design estimate is:
                    </p>
                    <div style="background: #F1F5F9; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 36px; font-weight: 700; letter-spacing: 0.3em; color: #0F172A;">${otp}</span>
                    </div>
                    <p style="color: #94A3B8; font-size: 14px;">
                        This code expires in 5 minutes. If you didn't request this, please ignore this email.
                    </p>
                </div>
            `,
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("OTP email error:", err);
        return NextResponse.json({ success: false, error: "Failed to send email" }, { status: 500 });
    }
}
