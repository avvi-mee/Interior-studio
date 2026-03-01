"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import { collection, doc, addDoc, updateDoc, query, orderBy, serverTimestamp, increment } from "firebase/firestore";
import { useFirestoreQuery } from "@/lib/firestoreQuery";

export interface FollowUp {
  id: string;
  leadId: string;
  tenantId: string;
  type: "call" | "email" | "meeting" | "site_visit" | "whatsapp";
  scheduledAt: any;
  completedAt?: any;
  status: "pending" | "completed" | "missed" | "rescheduled";
  notes?: string;
  outcome?: string;
  createdBy?: string;
  createdByName?: string;
}

function mapDoc(snap: any): FollowUp {
  const data = snap.data();
  return {
    id: snap.id,
    leadId: data.leadId ?? "",
    tenantId: data.tenantId ?? "",
    type: data.type ?? "call",
    scheduledAt: data.scheduledAt ?? null,
    completedAt: data.completedAt ?? undefined,
    status: data.status ?? "pending",
    notes: data.notes ?? undefined,
    outcome: data.outcome ?? undefined,
    createdBy: data.createdBy ?? undefined,
    createdByName: data.createdByName ?? undefined,
  };
}

export function useFollowUps(tenantId: string | null) {
  const queryClient = useQueryClient();
  const qk = ["follow-ups", tenantId] as const;
  const db = getDb();

  const { data: followUps = [], isLoading: loading } = useFirestoreQuery<FollowUp>({
    queryKey: qk,
    collectionRef: query(
      collection(db, `tenants/${tenantId}/followUps`),
      orderBy("scheduledAt", "asc")
    ),
    mapDoc,
    enabled: !!tenantId,
  });

  const invalidate = useCallback(() => queryClient.invalidateQueries({ queryKey: qk }), [queryClient, qk]);

  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), [now]);
  const todayEnd = useMemo(() => todayStart + 86400000, [todayStart]);

  const todayFollowUps = useMemo(
    () => followUps.filter((f) => {
      if (f.status !== "pending") return false;
      const t = f.scheduledAt ? new Date(f.scheduledAt).getTime() : 0;
      return t >= todayStart && t < todayEnd;
    }),
    [followUps, todayStart, todayEnd]
  );

  const overdueFollowUps = useMemo(
    () => followUps.filter((f) => {
      if (f.status !== "pending") return false;
      const t = f.scheduledAt ? new Date(f.scheduledAt).getTime() : 0;
      return t > 0 && t < todayStart;
    }),
    [followUps, todayStart]
  );

  const addFollowUp = useCallback(async (data: Omit<FollowUp, "id">) => {
    if (!tenantId) return "";
    try {
      const ref = await addDoc(collection(db, `tenants/${tenantId}/followUps`), {
        leadId: data.leadId,
        type: data.type,
        scheduledAt: data.scheduledAt,
        status: data.status || "pending",
        notes: data.notes || null,
        outcome: data.outcome || null,
        createdBy: data.createdBy || null,
        createdByName: data.createdByName || null,
        createdAt: serverTimestamp(),
      });
      // Keep lead's followUpCount in sync so lead scoring has accurate engagement data
      await updateDoc(doc(db, `tenants/${tenantId}/leads`, data.leadId), {
        followUpCount: increment(1),
        nextFollowUp: data.scheduledAt,
        updatedAt: serverTimestamp(),
      });
      invalidate();
      return ref.id;
    } catch (error) {
      console.error("Error adding follow-up:", error);
      return "";
    }
  }, [tenantId, db, invalidate]);

  const completeFollowUp = useCallback(async (followUpId: string, outcome: string) => {
    if (!tenantId) return false;
    try {
      await updateDoc(doc(db, `tenants/${tenantId}/followUps`, followUpId), {
        status: "completed",
        outcome,
        completedAt: serverTimestamp(),
      });
      invalidate();
      return true;
    } catch (error) {
      console.error("Error completing follow-up:", error);
      return false;
    }
  }, [tenantId, db, invalidate]);

  const rescheduleFollowUp = useCallback(async (followUpId: string, newDate: string | Date) => {
    if (!tenantId) return false;
    try {
      const scheduledAt = typeof newDate === "string" ? newDate : newDate.toISOString();

      await updateDoc(doc(db, `tenants/${tenantId}/followUps`, followUpId), {
        status: "rescheduled",
      });

      const original = followUps.find((f) => f.id === followUpId);
      if (original) {
        await addDoc(collection(db, `tenants/${tenantId}/followUps`), {
          leadId: original.leadId,
          type: original.type,
          scheduledAt,
          status: "pending",
          notes: original.notes || null,
          createdBy: original.createdBy || null,
          createdByName: original.createdByName || null,
          createdAt: serverTimestamp(),
        });
      }
      invalidate();
      return true;
    } catch (error) {
      console.error("Error rescheduling follow-up:", error);
      return false;
    }
  }, [tenantId, db, followUps, invalidate]);

  return { followUps, todayFollowUps, overdueFollowUps, loading, addFollowUp, completeFollowUp, rescheduleFollowUp };
}
