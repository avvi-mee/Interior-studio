import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
    try {
        const rateLimited = rateLimit(req, { max: 5, windowMs: 60_000, keyPrefix: "auth-signup" });
        if (rateLimited) return rateLimited;

        const { name, email, phone, password } = await req.json();

        if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
        if (!email?.includes("@")) return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
        if (!phone || String(phone).replace(/\D/g, "").length !== 10) {
            return NextResponse.json({ error: "Valid 10-digit phone is required" }, { status: 400 });
        }
        if (!password || password.length < 6) {
            return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
        }

        const adminAuth = getAdminAuth();
        const adminDb = getAdminDb();
        const cleanPhone = String(phone).replace(/\D/g, "");
        const cleanEmail = email.trim().toLowerCase();
        const cleanName = name.trim();

        const userRecord = await adminAuth.createUser({
            email: cleanEmail,
            password,
            displayName: cleanName,
        });

        const uid = userRecord.uid;
        const now = new Date();

        await adminDb.collection("users").doc(uid).set({
            email: cleanEmail,
            name: cleanName,
            phone: cleanPhone,
            role: "customer",
            lastLogin: now,
            createdAt: now,
        }, { merge: true });

        await adminDb.collection("customers").doc(uid).set({
            email: cleanEmail,
            displayName: cleanName,
            phoneNumber: cleanPhone,
            lastLogin: now,
            createdAt: now,
        }, { merge: true });

        // Obtain idToken for the newly-created account so the client can make authenticated API calls.
        // NOTE: Token expires in 1 hour; refresh is deferred to Phase 6.
        let signupIdToken: string | null = null;
        try {
            const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
            const tokenRes = await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: cleanEmail, password, returnSecureToken: true }),
                }
            );
            const tokenData = await tokenRes.json();
            if (tokenRes.ok) signupIdToken = tokenData.idToken ?? null;
        } catch { /* non-fatal — client will need to re-login for token */ }

        return NextResponse.json({ uid, name: cleanName, email: cleanEmail, phone: cleanPhone, idToken: signupIdToken });
    } catch (err: any) {
        if (err.code === "auth/email-already-exists") {
            return NextResponse.json({ error: "email_in_use" }, { status: 409 });
        }
        console.error("Signup error:", err);
        return NextResponse.json({ error: err.message || "Signup failed" }, { status: 500 });
    }
}
