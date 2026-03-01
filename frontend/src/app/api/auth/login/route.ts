import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
    try {
        const rateLimited = rateLimit(req, { max: 10, windowMs: 60_000, keyPrefix: "auth-login" });
        if (rateLimited) return rateLimited;

        const { email, password } = await req.json();

        if (!email?.includes("@")) return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
        if (!password) return NextResponse.json({ error: "Password is required" }, { status: 400 });

        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
        }

        // Use Firebase Auth REST API server-to-server (bypasses browser firewall)
        const authRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase(), password, returnSecureToken: true }),
            }
        );

        const authData = await authRes.json();

        if (!authRes.ok) {
            const code = authData?.error?.message || "";
            if (
                code.includes("INVALID_PASSWORD") ||
                code.includes("EMAIL_NOT_FOUND") ||
                code.includes("INVALID_LOGIN_CREDENTIALS")
            ) {
                return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
            }
            if (code.includes("TOO_MANY_ATTEMPTS")) {
                return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
            }
            return NextResponse.json({ error: "Login failed" }, { status: 401 });
        }

        const uid: string = authData.localId;
        const adminDb = getAdminDb();

        // Fetch user profile
        let userName = email.split("@")[0];
        let userPhone = "";
        try {
            const userDoc = await adminDb.collection("users").doc(uid).get();
            if (userDoc.exists) {
                const data = userDoc.data()!;
                userName = data.name || data.displayName || userName;
                userPhone = data.phone || data.phoneNumber || "";
            }
        } catch { /* non-fatal */ }

        // Update lastLogin (fire-and-forget)
        const now = new Date();
        adminDb.collection("users").doc(uid).set({ lastLogin: now }, { merge: true }).catch(() => {});
        adminDb.collection("customers").doc(uid).set({ lastLogin: now }, { merge: true }).catch(() => {});

        return NextResponse.json({
            uid,
            name: userName,
            email: email.trim().toLowerCase(),
            phone: userPhone,
            idToken: authData.idToken ?? null,
        });
    } catch (err: any) {
        console.error("Login error:", err);
        return NextResponse.json({ error: err.message || "Login failed" }, { status: 500 });
    }
}
