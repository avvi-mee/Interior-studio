import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { verifyAuth } from "@/lib/firestoreServer";

/**
 * GET /api/my-invoices?tenantId=xxx
 * Returns all invoices for the authenticated customer.
 * Email is derived from the verified Firebase ID token — caller cannot spoof it.
 *
 * NOTE: Invoices created before Fix 5 (clientEmail field) lack the clientEmail field
 * and will not appear in results. A backfill script is needed for legacy data.
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
            .collection(`tenants/${tenantId}/invoices`)
            .where("clientEmail", "==", email)
            .orderBy("createdAt", "desc")
            .get();

        const invoices = snapshot.docs.map((doc) => {
            const d = doc.data();
            return {
                id: doc.id,
                invoiceNumber: d.invoiceNumber || d.invoice_number || "",
                amount: d.amount || 0,
                paidAmount: d.paidAmount || d.paid_amount || 0,
                dueDate: d.dueDate || d.due_date || null,
                status: d.status || "draft",
                description: d.description || "",
                createdAt: d.createdAt || null,
                projectId: d.projectId || d.project_id || "",
            };
        });

        return NextResponse.json({ invoices });
    } catch (err: any) {
        console.error("my-invoices error:", err);
        return NextResponse.json({ error: err.message || "Failed to fetch invoices" }, { status: 500 });
    }
}
