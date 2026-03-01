import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";

/**
 * POST /api/auth/employee-login
 * Verifies a Firebase ID token then finds the matching employee record.
 * Uses Admin SDK so Firestore security rules are bypassed.
 * Returns employee session data on success.
 */
export async function POST(req: NextRequest) {
    try {
        const rateLimited = rateLimit(req, { max: 10, windowMs: 60_000, keyPrefix: "emp-login" });
        if (rateLimited) return rateLimited;

        const { idToken } = await req.json();
        if (!idToken) {
            return NextResponse.json({ error: "idToken is required" }, { status: 400 });
        }

        const adminAuth = getAdminAuth();
        const db = getAdminDb();

        // 1. Verify the Firebase ID token
        const decoded = await adminAuth.verifyIdToken(idToken);
        const uid = decoded.uid;
        const email = decoded.email || "";

        // 2. Read users/{uid} to get tenantId (set when admin grants login access)
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        const tenantId: string | null = userData?.tenantId || userData?.tenant_id || null;

        // Helper to shape the response
        const toSession = (docId: string, d: any, tid: string) => ({
            id: docId,
            name: d.full_name || d.fullName || d.name || email.split("@")[0],
            email: d.email || email,
            area: d.area || "",
            phone: d.phone || "",
            role: d.role || d.primaryRole || "designer",
            roles: d.roles || d.role_names || [d.role || "designer"],
            tenantId: tid,
            totalWork: d.total_work || 0,
            currentWork: d.current_work || "None",
        });

        // 3a. Fast path: query the known tenant's employees by userId field
        if (tenantId) {
            const empSnap = await db
                .collection("tenants").doc(tenantId)
                .collection("employees")
                .where("userId", "==", uid)
                .limit(1)
                .get();

            if (!empSnap.empty) {
                const d = empSnap.docs[0].data();
                if (d.is_active !== false && d.isActive !== false) {
                    return NextResponse.json({ employee: toSession(empSnap.docs[0].id, d, tenantId) });
                }
                return NextResponse.json({ error: "Account is inactive." }, { status: 403 });
            }
        }

        // 3b. Fallback: collectionGroup search by email (catches pre-fix employees)
        const emailSnap = await db
            .collectionGroup("employees")
            .where("email", "==", email)
            .limit(1)
            .get();

        if (!emailSnap.empty) {
            const d = emailSnap.docs[0].data();
            const empTenantId: string = d.tenant_id || d.tenantId || tenantId || "";
            if (!empTenantId) {
                return NextResponse.json({ error: "Employee tenant not configured." }, { status: 403 });
            }
            if (d.is_active === false || d.isActive === false) {
                return NextResponse.json({ error: "Account is inactive." }, { status: 403 });
            }

            // Backfill: write userId + tenantId so future logins use fast path
            await emailSnap.docs[0].ref.update({ userId: uid }).catch(() => {});
            await db.collection("users").doc(uid).set(
                { tenantId: empTenantId, role: "employee" },
                { merge: true }
            ).catch(() => {});

            return NextResponse.json({ employee: toSession(emailSnap.docs[0].id, d, empTenantId) });
        }

        return NextResponse.json({ error: "No active employee account found." }, { status: 404 });

    } catch (err: any) {
        if (err.code === "auth/id-token-expired" || err.code === "auth/argument-error") {
            return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
        }
        console.error("employee-login error:", err);
        return NextResponse.json({ error: err.message || "Login failed" }, { status: 500 });
    }
}
