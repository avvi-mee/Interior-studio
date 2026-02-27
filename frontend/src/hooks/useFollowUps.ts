"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

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

export function useFollowUps(tenantId: string | null) {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const followUpsRef = collection(db, `tenants/${tenantId}/followUps`);
    const q = query(followUpsRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as FollowUp[];

        data.sort((a, b) => {
          const aTime = a.scheduledAt?.toMillis ? a.scheduledAt.toMillis() : 0;
          const bTime = b.scheduledAt?.toMillis ? b.scheduledAt.toMillis() : 0;
          return aTime - bTime;
        });

        setFollowUps(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching follow-ups:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tenantId]);

  const now = useMemo(() => {
    const d = new Date();
    return d;
  }, []);

  const todayStart = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return d.getTime();
  }, [now]);

  const todayEnd = useMemo(() => todayStart + 86400000, [todayStart]);

  const todayFollowUps = useMemo(
    () =>
      followUps.filter((f) => {
        if (f.status !== "pending") return false;
        const t = f.scheduledAt?.toMillis ? f.scheduledAt.toMillis() : 0;
        return t >= todayStart && t < todayEnd;
      }),
    [followUps, todayStart, todayEnd]
  );

  const overdueFollowUps = useMemo(
    () =>
      followUps.filter((f) => {
        if (f.status !== "pending") return false;
        const t = f.scheduledAt?.toMillis ? f.scheduledAt.toMillis() : 0;
        return t > 0 && t < todayStart;
      }),
    [followUps, todayStart]
  );

  const addFollowUp = useCallback(
    async (data: Omit<FollowUp, "id">) => {
      if (!tenantId) return "";
      try {
        const ref = await addDoc(collection(db, `tenants/${tenantId}/followUps`), data);
        return ref.id;
      } catch (error) {
        console.error("Error adding follow-up:", error);
        return "";
      }
    },
    [tenantId]
  );

  const completeFollowUp = useCallback(
    async (followUpId: string, outcome: string) => {
      if (!tenantId) return false;
      try {
        const ref = doc(db, `tenants/${tenantId}/followUps`, followUpId);
        await updateDoc(ref, {
          status: "completed",
          outcome,
          completedAt: serverTimestamp(),
        });
        return true;
      } catch (error) {
        console.error("Error completing follow-up:", error);
        return false;
      }
    },
    [tenantId]
  );

  const rescheduleFollowUp = useCallback(
    async (followUpId: string, newDate: Timestamp) => {
      if (!tenantId) return false;
      try {
        const ref = doc(db, `tenants/${tenantId}/followUps`, followUpId);
        await updateDoc(ref, {
          status: "rescheduled",
          scheduledAt: newDate,
        });
        // Create a new pending follow-up
        const original = followUps.find((f) => f.id === followUpId);
        if (original) {
          await addDoc(collection(db, `tenants/${tenantId}/followUps`), {
            leadId: original.leadId,
            tenantId,
            type: original.type,
            scheduledAt: newDate,
            status: "pending",
            notes: original.notes,
            createdBy: original.createdBy,
            createdByName: original.createdByName,
          });
        }
        return true;
      } catch (error) {
        console.error("Error rescheduling follow-up:", error);
        return false;
      }
    },
    [tenantId, followUps]
  );

  return {
    followUps,
    todayFollowUps,
    overdueFollowUps,
    loading,
    addFollowUp,
    completeFollowUp,
    rescheduleFollowUp,
  };
}
