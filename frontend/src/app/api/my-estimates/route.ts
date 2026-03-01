import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { verifyAuth } from "@/lib/firestoreServer";

/**
 * GET /api/my-estimates?tenantId=xxx
 * Returns all estimates for the authenticated customer, enriched with task attachments
 * (drawings) from linked project tasks.
 * Email is derived from the verified Firebase ID token — caller cannot spoof it.
 */
export async function GET(req: NextRequest) {
    const tenantId = req.nextUrl.searchParams.get("tenantId");
    if (!tenantId) {
        return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
    }

    // Verify caller identity — reject unauthenticated/tampered requests
    const { user, response: authError } = await verifyAuth(req);
    if (authError) return authError;
    const email = user!.email?.toLowerCase();
    if (!email) {
        return NextResponse.json({ error: "Token missing email claim" }, { status: 401 });
    }

    try {
        const db = getAdminDb();
        const snapshot = await db
            .collection(`tenants/${tenantId}/estimates`)
            .where("customerEmail", "==", email)
            .orderBy("created_at", "desc")
            .get();

        const estimates = await Promise.all(
            snapshot.docs.map(async (doc) => {
                const d = doc.data();
                const ci = d.customer_info ?? {};
                const ps = d.project_summary ?? {};

                const estimateFields = {
                    id: doc.id,
                    customerEmail: ci.email ?? "",
                    customerName: ci.name ?? "",
                    customerPhone: ci.phone ?? "",
                    customerCity: ci.city ?? "",
                    segment: ps.segment ?? d.segment ?? "",
                    plan: ps.plan ?? d.plan ?? "",
                    carpetArea: ps.carpetArea ?? d.carpetArea ?? 0,
                    totalAmount: d.total_amount ?? d.totalAmount ?? 0,
                    estimatedAmount: d.total_amount ?? d.totalAmount ?? 0,
                    status: d.status ?? "pending",
                    createdAt: d.created_at ?? d.createdAt ?? null,
                    tenantId: d.tenant_id ?? tenantId,
                    pdfUrl: d.pdfUrl ?? null,
                    costSummary: ps.costSummary ?? null,
                    timeline: d.timeline ?? [],
                    projectId: d.projectId ?? null,
                };

                // Enrich with task attachments (drawings) from the linked project
                const projectId: string | null = d.projectId ?? null;
                let attachments: Array<{ name: string; url: string; taskName: string }> = [];

                if (projectId) {
                    try {
                        const tasksSnap = await db
                            .collection(`tenants/${tenantId}/projects/${projectId}/tasks`)
                            .limit(50)
                            .get();
                        await Promise.all(
                            tasksSnap.docs.map(async (taskDoc) => {
                                const taskName = taskDoc.data().name ?? "";
                                const attSnap = await db
                                    .collection(`tenants/${tenantId}/projects/${projectId}/tasks/${taskDoc.id}/attachments`)
                                    .limit(10)
                                    .get();
                                attSnap.docs.forEach((a) => {
                                    const ad = a.data();
                                    attachments.push({ name: ad.name ?? "", url: ad.url ?? "", taskName });
                                });
                            })
                        );
                    } catch { /* non-fatal — attachments may not exist for all projects */ }
                }

                return { ...estimateFields, attachments };
            })
        );

        return NextResponse.json({ estimates });
    } catch (err: any) {
        console.error("my-estimates error:", err);
        return NextResponse.json({ error: err.message || "Failed to fetch estimates" }, { status: 500 });
    }
}
