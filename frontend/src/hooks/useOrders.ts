"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import { useFirestoreQuery } from "@/lib/firestoreQuery";
import {
    collection,
    doc,
    query,
    orderBy,
    limit,
    addDoc,
    updateDoc,
    serverTimestamp,
    writeBatch,
    type DocumentSnapshot,
} from "firebase/firestore";

// =============================================================================
// Firebase migration:
//   - estimates → tenants/{tenantId}/estimates
//   - activity_logs → tenants/{tenantId}/activityLogs
//   - All fields are camelCase in Firestore
// =============================================================================

export interface Order {
    id: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    customerCity?: string;
    segment?: string;
    plan?: string;
    carpetArea?: number;
    lineItems?: any[];
    totalAmount?: number;

    // Shared fields
    status?: "draft" | "sent" | "approved" | "rejected" | "expired";
    createdAt?: any;
    tenantId: string;
    pdfUrl?: string;
    assignedTo?: string;
    leadId?: string;
    validUntil?: string;

    // Legacy compat aliases
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    estimatedAmount?: number;
    timeline?: Array<{
        action: string;
        summary: string;
        timestamp: any;
        actorId?: string;
    }>;
}

export interface OrderStats {
    draft: number;
    sent: number;
    approved: number;
    rejected: number;
    totalValue: number;
}

function mapDocToOrder(snap: DocumentSnapshot): Order {
    const d = snap.data() ?? {};
    return {
        id: snap.id,
        customerName: d.customerName ?? undefined,
        customerPhone: d.customerPhone ?? undefined,
        customerEmail: d.customerEmail ?? undefined,
        customerCity: d.customerCity ?? undefined,
        segment: d.segment ?? undefined,
        plan: d.plan ?? undefined,
        carpetArea: d.carpetArea ?? undefined,
        lineItems: d.lineItems ?? [],
        totalAmount: d.totalAmount ?? undefined,
        status: d.status || "draft",
        createdAt: d.createdAt ?? undefined,
        tenantId: d.tenantId ?? "",
        pdfUrl: d.pdfUrl ?? undefined,
        assignedTo: d.assignedTo ?? undefined,
        leadId: d.leadId ?? undefined,
        validUntil: d.validUntil ?? undefined,
        // Legacy compat
        clientName: d.customerName ?? undefined,
        clientPhone: d.customerPhone ?? undefined,
        clientEmail: d.customerEmail ?? undefined,
        estimatedAmount: d.totalAmount ?? undefined,
        timeline: [],
    };
}

export function useOrders(tenantId: string | null, storeId?: string | null) {
    const queryClient = useQueryClient();
    const qk = ["orders", tenantId, storeId] as const;
    const db = getDb();

    const collectionRef = useMemo(
        () =>
            query(
                collection(db, `tenants/${tenantId}/estimates`),
                orderBy("createdAt", "desc"),
                limit(200)
            ),
        [db, tenantId]
    );

    const { data: orders = [], isLoading: loading } = useFirestoreQuery<Order>({
        queryKey: qk,
        collectionRef,
        mapDoc: mapDocToOrder,
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    // Derive stats from orders via useMemo instead of separate useState
    const stats: OrderStats = useMemo(() => {
        const draft = orders.filter((o) => o.status === "draft").length;
        const sent = orders.filter((o) => o.status === "sent").length;
        const approved = orders.filter((o) => o.status === "approved").length;
        const rejected = orders.filter((o) => o.status === "rejected").length;
        const totalValue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        return { draft, sent, approved, rejected, totalValue };
    }, [orders]);

    const updateOrderStatus = useCallback(
        async (orderId: string, status: "draft" | "sent" | "approved" | "rejected") => {
            if (!tenantId) return false;
            try {
                // Atomic: estimate update + activity log
                const batch = writeBatch(db);
                batch.update(
                    doc(db, `tenants/${tenantId}/estimates`, orderId),
                    { status }
                );
                const logRef = doc(collection(db, `tenants/${tenantId}/activityLogs`));
                batch.set(logRef, {
                    tenantId,
                    entityType: "estimate",
                    entityId: orderId,
                    action: "status_changed",
                    summary: `Order status updated to ${status}`,
                    createdAt: serverTimestamp(),
                });
                await batch.commit();

                invalidate();
                return true;
            } catch (error) {
                console.error("Error updating order status:", error);
                return false;
            }
        },
        [db, tenantId, invalidate]
    );

    const updateOrderDetails = useCallback(
        async (orderId: string, updates: Partial<Order>) => {
            if (!tenantId) return false;
            try {
                const dbUpdates: Record<string, any> = {};

                for (const [key, value] of Object.entries(updates)) {
                    if (key === "id" || key === "timeline") continue;
                    // Skip legacy alias fields to avoid duplication
                    if (key === "clientName" || key === "clientPhone" || key === "clientEmail" || key === "estimatedAmount") continue;
                    dbUpdates[key] = value;
                }

                await updateDoc(
                    doc(db, `tenants/${tenantId}/estimates`, orderId),
                    dbUpdates
                );

                if (updates.assignedTo) {
                    await addDoc(
                        collection(db, `tenants/${tenantId}/activityLogs`),
                        {
                            tenantId,
                            entityType: "estimate",
                            entityId: orderId,
                            action: "assigned",
                            summary: `Order assigned`,
                            createdAt: serverTimestamp(),
                        }
                    );
                }

                invalidate();
                return true;
            } catch (error) {
                console.error("Error updating order details:", error);
                return false;
            }
        },
        [db, tenantId, invalidate]
    );

    return { orders, stats, loading, updateOrderStatus, updateOrderDetails };
}
