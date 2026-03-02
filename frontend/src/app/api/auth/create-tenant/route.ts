import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
    try {
        const { uid, name, email, phone, businessName, slug } = await req.json();

        // Verify the caller is the same user who just signed up
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const idToken = authHeader.slice(7);
        const decoded = await getAdminAuth().verifyIdToken(idToken);
        if (decoded.uid !== uid) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const adminDb = getAdminDb();

        // Deduplicate slug using Admin SDK (bypasses Firestore security rules)
        let uniqueSlug = slug;
        let counter = 1;
        let exists = true;
        while (exists) {
            const snap = await adminDb
                .collection("tenants")
                .where("slug", "==", uniqueSlug)
                .limit(1)
                .get();
            if (snap.empty) {
                exists = false;
            } else {
                uniqueSlug = `${slug}-${counter}`;
                counter++;
            }
        }

        // Create tenant — set both ownerId and ownerUid so isTenantOwner() rule passes
        const tenantRef = await adminDb.collection("tenants").add({
            ownerId: uid,
            ownerUid: uid,
            name: businessName,
            email,
            phone: phone || "",
            slug: uniqueSlug,
            status: "pending",
            subscription: "free",
            createdAt: new Date(),
        });

        // Create activity log entry
        try {
            await adminDb.collection("activities").add({
                type: "signup",
                description: `New designer signup: ${businessName}`,
                metadata: { email, slug: uniqueSlug, tenantId: tenantRef.id },
                createdAt: new Date(),
            });
        } catch { /* non-fatal */ }

        return NextResponse.json({ tenantId: tenantRef.id, slug: uniqueSlug });
    } catch (err: any) {
        console.error("Create tenant error:", err);
        return NextResponse.json({ error: err.message || "Failed to create tenant" }, { status: 500 });
    }
}
