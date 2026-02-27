import { NextRequest, NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otpStore";

export async function POST(req: NextRequest) {
    const { email, otp } = await req.json();

    if (!email || !otp) {
        return NextResponse.json({ success: false, error: "Email and OTP required" }, { status: 400 });
    }

    const result = verifyOtp(email, otp);

    if (!result.valid) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
}
