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
    getDocs,
    where,
    serverTimestamp,
    writeBatch,
    type DocumentSnapshot,
} from "firebase/firestore";

// =============================================================================
// Firebase migration:
//   - consultations → tenants/{tenantId}/consultations
//   - activity_logs → tenants/{tenantId}/activityLogs
//   - All fields are camelCase in Firestore
// =============================================================================

export interface ConsultationRequest {
    id: string;
    clientName: string;
    phone?: string;
    email?: string;
    source: string;
    requirement: string;
    status: "new" | "contacted" | "closed";
    createdAt: any;
    tenantId: string;
    assignedTo?: string;
    timeline?: Array<{
        action: string;
        summary: string;
        timestamp: any;
        actorId?: string;
    }>;
}

function mapDocToConsultation(snap: DocumentSnapshot): ConsultationRequest {
    const d = snap.data() ?? {};
    return {
        id: snap.id,
        clientName: d.clientName ?? d.name ?? "",
        phone: d.phone ?? undefined,
        email: d.email ?? undefined,
        source: d.source ?? "",
        requirement: d.requirement ?? "",
        status: d.status ?? "new",
        createdAt: d.createdAt ?? null,
        tenantId: d.tenantId ?? "",
        assignedTo: d.assignedTo ?? undefined,
        timeline: [],
    };
}

export function useConsultations(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["consultations", tenantId] as const;
    const db = getDb();

    const collectionRef = useMemo(
        () =>
            query(
                collection(db, `tenants/${tenantId}/consultations`),
                orderBy("createdAt", "desc"),
                limit(100)
            ),
        [db, tenantId]
    );

    const { data: requests = [], isLoading: loading } = useFirestoreQuery<ConsultationRequest>({
        queryKey: qk,
        collectionRef,
        mapDoc: mapDocToConsultation,
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    // Derive stats from data via useMemo instead of separate useState
    const stats = useMemo(() => {
        const newCount = requests.filter(r => r.status === "new").length;
        const contactedCount = requests.filter(r => r.status === "contacted").length;
        const closedCount = requests.filter(r => r.status === "closed").length;
        const total = requests.length;

        return {
            new: newCount,
            inProgress: contactedCount,
            conversionRate: total > 0 ? Math.round((closedCount / total) * 100) : 0,
        };
    }, [requests]);

    const updateRequest = useCallback(
        async (requestId: string, updates: Partial<ConsultationRequest>) => {
            if (!tenantId) return false;
            try {
                const dbUpdates: Record<string, any> = {};

                for (const [key, value] of Object.entries(updates)) {
                    if (key === "id" || key === "timeline") continue;
                    dbUpdates[key] = value;
                }

                await updateDoc(
                    doc(db, `tenants/${tenantId}/consultations`, requestId),
                    dbUpdates
                );

                invalidate();
                return true;
            } catch (error) {
                console.error("Error updating consultation request:", error);
                return false;
            }
        },
        [db, tenantId, invalidate]
    );

    const createConsultation = useCallback(
        async (data: Omit<ConsultationRequest, "id" | "createdAt">) => {
            if (!tenantId) return null;
            try {
                const docRef = await addDoc(
                    collection(db, `tenants/${tenantId}/consultations`),
                    {
                        tenantId,
                        clientName: data.clientName,
                        name: data.clientName,
                        phone: data.phone || null,
                        email: data.email || null,
                        source: data.source,
                        requirement: data.requirement,
                        status: data.status || "new",
                        assignedTo: data.assignedTo || null,
                        createdAt: serverTimestamp(),
                    }
                );

                invalidate();
                return docRef.id;
            } catch (error) {
                console.error("Error creating consultation:", error);
                return null;
            }
        },
        [db, tenantId, invalidate]
    );

    const convertToLead = useCallback(
        async (requestId: string) => {
            if (!tenantId) return null;
            try {
                const request = requests.find(r => r.id === requestId);
                if (!request) return null;

                const batch = writeBatch(db);

                // Create lead in tenants/{tenantId}/leads
                const leadRef = doc(collection(db, `tenants/${tenantId}/leads`));
                batch.set(leadRef, {
                    tenantId,
                    name: request.clientName,
                    email: request.email || "",
                    phone: request.phone || "",
                    source: "consultation",
                    stage: "new",
                    score: 0,
                    estimatedValue: 0,
                    followUpCount: 0,
                    createdAt: serverTimestamp(),
                });

                // Log activity for the lead
                const leadLogRef = doc(collection(db, `tenants/${tenantId}/activityLogs`));
                batch.set(leadLogRef, {
                    tenantId,
                    entityType: "lead",
                    entityId: leadRef.id,
                    action: "created",
                    summary: `Converted from consultation request ${requestId}`,
                    createdAt: serverTimestamp(),
                });

                // Update consultation status to closed and link lead
                batch.update(
                    doc(db, `tenants/${tenantId}/consultations`, requestId),
                    { status: "closed", leadId: leadRef.id }
                );

                // Log consultation conversion
                const consultLogRef = doc(collection(db, `tenants/${tenantId}/activityLogs`));
                batch.set(consultLogRef, {
                    tenantId,
                    entityType: "consultation",
                    entityId: requestId,
                    action: "status_changed",
                    summary: `Converted to lead ${leadRef.id}`,
                    createdAt: serverTimestamp(),
                });

                await batch.commit();
                invalidate();
                return leadRef.id;
            } catch (error) {
                console.error("Error converting to lead:", error);
                return null;
            }
        },
        [db, tenantId, requests, invalidate]
    );

    return { requests, stats, loading, updateRequest, createConsultation, convertToLead };
}
