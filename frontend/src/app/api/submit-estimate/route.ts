import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";

/**
 * POST /api/submit-estimate
 * Creates a lead and back-links it to an estimate using Admin SDK,
 * completely bypassing Firestore security rules.
 */
export async function POST(req: NextRequest) {
    try {
        const rateLimited = rateLimit(req, { max: 5, windowMs: 60_000, keyPrefix: "submit-est" });
        if (rateLimited) return rateLimited;

        const body = await req.json();
        const { tenantId, estimateId, leadData } = body;

        if (!tenantId || !estimateId || !leadData) {
            return NextResponse.json(
                { error: "tenantId, estimateId and leadData are required" },
                { status: 400 }
            );
        }

        const db = getAdminDb();

        // Idempotency guard: return existing leadId if already submitted
        const existingEstimate = await db
            .collection(`tenants/${tenantId}/estimates`)
            .doc(estimateId)
            .get();
        if (existingEstimate.exists && existingEstimate.data()?.leadId) {
            return NextResponse.json({ success: true, leadId: existingEstimate.data()!.leadId });
        }

        const leadsRef = db.collection(`tenants/${tenantId}/leads`);

        // Look up customer by phone to back-link storefront user
        const customerSnap = await db
            .collection("customers")
            .where("phone", "==", leadData.phone ?? "")
            .limit(1)
            .get();
        const customerId = customerSnap.empty ? null : customerSnap.docs[0].id;

        // Create lead document — normalize to camelCase to match mapDocToLead()
        const leadRef = await leadsRef.add({
            tenantId,
            estimateId,
            customerId:     customerId,
            name:           leadData.name           ?? "",
            email:          leadData.email          ?? "",
            phone:          leadData.phone          ?? "",
            city:           leadData.city           ?? null,
            source:         "website",
            stage:          "new",
            score:          0,
            estimatedValue: leadData.total_amount   ?? 0,
            followUpCount:  0,
            createdAt:      new Date().toISOString(),
            updatedAt:      new Date().toISOString(),
        });
        const leadId = leadRef.id;

        // Back-link lead to estimate — camelCase to match estimate doc reads
        await db
            .collection(`tenants/${tenantId}/estimates`)
            .doc(estimateId)
            .update({ leadId });

        return NextResponse.json({ success: true, leadId });
    } catch (err: any) {
        console.error("submit-estimate error:", err);
        return NextResponse.json(
            { error: err.message || "Failed to create lead" },
            { status: 500 }
        );
    }
}
