import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { verifyAuth, verifyTenantAccess } from "@/lib/firestoreServer";
import { rateLimit } from "@/lib/rateLimit";

/**
 * POST /api/auth/set-employee-password
 * Admin sets or resets a password for an employee.
 * - If a Firebase Auth account already exists for the email → updates the password.
 * - If no Auth account exists yet → creates one so the employee can log in.
 * Requires the caller to be an authenticated tenant member.
 */
export async function POST(req: NextRequest) {
    try {
        const rateLimited = rateLimit(req, { max: 5, windowMs: 60_000, keyPrefix: "set-emp-pwd" });
        if (rateLimited) return rateLimited;

        const { user, response: authError } = await verifyAuth(req);
        if (authError) return authError;

        const { tenantId, email, password } = await req.json();

        if (!tenantId || !email || !password) {
            return NextResponse.json({ error: "tenantId, email and password are required" }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
        }

        const hasAccess = await verifyTenantAccess(user!.id, tenantId, user!.email);
        if (!hasAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const adminAuth = getAdminAuth();
        const db = getAdminDb();

        // Look up employee doc first (needed for both paths)
        const empSnap = await db
            .collection("tenants")
            .doc(tenantId)
            .collection("employees")
            .where("email", "==", email)
            .limit(1)
            .get();

        const empDocData = empSnap.empty ? null : empSnap.docs[0].data();
        const displayName = empDocData?.fullName || empDocData?.full_name || empDocData?.name || email.split("@")[0];

        let uid: string;
        let created = false;

        try {
            // Try to find existing auth account
            const existing = await adminAuth.getUserByEmail(email);
            await adminAuth.updateUser(existing.uid, { password });
            uid = existing.uid;
        } catch (err: any) {
            if (err.code !== "auth/user-not-found") throw err;

            const newUser = await adminAuth.createUser({
                email,
                password,
                displayName,
                emailVerified: true,
            });
            uid = newUser.uid;
            created = true;
        }

        // Update the employee Firestore doc with the auth UID
        if (!empSnap.empty) {
            await empSnap.docs[0].ref.update({ userId: uid, is_active: true });
        }

        // Ensure users/{uid} has tenantId + role so employee login lookup works
        await db.collection("users").doc(uid).set({
            email,
            fullName: displayName,
            role: "employee",
            tenantId,
            createdAt: new Date().toISOString(),
        }, { merge: true });

        // Write a marker doc at employees/{uid} so Firestore security rules
        // (isTenantEmployee uses exists(...employees/{authUid})) work for this user
        await db
            .collection("tenants").doc(tenantId)
            .collection("employees").doc(uid)
            .set({ userId: uid, email, isActive: true, is_active: true, tenantId }, { merge: true });

        return NextResponse.json({ success: true, uid, created });
    } catch (err: any) {
        console.error("set-employee-password error:", err);
        return NextResponse.json({ error: err.message || "Failed to update password" }, { status: 500 });
    }
}
