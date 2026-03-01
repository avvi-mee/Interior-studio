import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyTenantAccess } from "@/lib/firestoreServer";
import { getAdminDb, getAdminAuth } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
    try {
        // V-11 fix: Rate limit — max 5 employee registrations per minute per IP
        const rateLimited = rateLimit(req, { max: 5, windowMs: 60_000, keyPrefix: "emp-reg" });
        if (rateLimited) return rateLimited;

        // V-02 fix: Verify JWT authentication
        const { user: authUser, response: authResponse } = await verifyAuth(req);
        if (authResponse) return authResponse;

        const { tenantId, name, email, phone, area, password } = await req.json();

        if (!tenantId || !name || !email || !password) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // V-02 fix: Verify the authenticated user has access to this tenant
        const hasAccess = await verifyTenantAccess(authUser!.id, tenantId);
        if (!hasAccess) {
            return NextResponse.json({ error: "Forbidden: not a member of this tenant" }, { status: 403 });
        }

        const db = getAdminDb();
        const adminAuth = getAdminAuth();

        // Check if email already exists in this tenant's employees
        const existingSnap = await db
            .collection("tenants")
            .doc(tenantId)
            .collection("employees")
            .where("email", "==", email)
            .limit(1)
            .get();

        if (!existingSnap.empty) {
            return NextResponse.json(
                { error: "A team member with this email is already registered under this designer." },
                { status: 409 }
            );
        }

        // Create Firebase Auth account
        let firebaseUser;
        try {
            firebaseUser = await adminAuth.createUser({
                email,
                password,
                displayName: name,
                emailVerified: true,
            });
        } catch (authError: any) {
            console.error("Auth creation error:", authError);
            return NextResponse.json(
                { error: authError.message || "Failed to create auth account" },
                { status: 400 }
            );
        }

        const uid = firebaseUser.uid;

        // 1. Create user profile record in users/{uid}
        try {
            await db.collection("users").doc(uid).set({
                fullName: name,
                email,
                phone: phone || null,
                createdAt: new Date().toISOString(),
            });
        } catch (userError: any) {
            console.error("User profile creation error:", userError);
            // Rollback: delete the auth account
            await adminAuth.deleteUser(uid);
            return NextResponse.json(
                { error: "Failed to create user profile" },
                { status: 500 }
            );
        }

        // 2. Create employee record in tenants/{tenantId}/employees/{uid}
        try {
            await db
                .collection("tenants")
                .doc(tenantId)
                .collection("employees")
                .doc(uid)
                .set({
                    fullName: name,
                    email,
                    phone: phone || null,
                    area: area || null,
                    totalWork: 0,
                    currentWork: "None",
                    upcomingWork: "None",
                    isActive: true,
                    role: "designer",
                    createdAt: new Date().toISOString(),
                });
        } catch (empError: any) {
            console.error("Employee record creation error:", empError);
            // Rollback: delete user doc and auth account
            await db.collection("users").doc(uid).delete();
            await adminAuth.deleteUser(uid);
            return NextResponse.json(
                { error: "Failed to create team member record" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            employeeId: uid,
            authUid: uid,
        });
    } catch (error: any) {
        console.error("Employee registration error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
