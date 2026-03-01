import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";

function emailToDocId(email: string): string {
    return email.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 100);
}

export async function POST(req: NextRequest) {
    try {
        const rateLimited = rateLimit(req, { max: 10, windowMs: 60_000, keyPrefix: "verify-otp" });
        if (rateLimited) return rateLimited;

        const { email, otp } = await req.json();

        if (!email || !otp) {
            return NextResponse.json(
                { verified: false, error: "Email and OTP are required" },
                { status: 400 }
            );
        }

        const db = getAdminDb();
        const docRef = db.collection("otpVerifications").doc(emailToDocId(email));
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({
                verified: false,
                error: "Code not found or already used. Please request a new one.",
            });
        }

        const data = docSnap.data()!;

        if (new Date(data.expiresAt) < new Date()) {
            await docRef.delete();
            return NextResponse.json({
                verified: false,
                error: "Code has expired. Please request a new one.",
            });
        }

        if (data.otp !== otp.trim()) {
            return NextResponse.json({
                verified: false,
                error: "Incorrect code. Please try again.",
            });
        }

        // Delete after successful verification — one-time use
        await docRef.delete();

        return NextResponse.json({ verified: true });
    } catch (err: any) {
        console.error("Verify OTP error:", err);
        return NextResponse.json(
            { verified: false, error: err.message || "Verification failed" },
            { status: 500 }
        );
    }
}
