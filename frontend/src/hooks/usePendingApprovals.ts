"use client";

import { useCallback, useMemo } from "react";
import { getDb } from "@/lib/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { Tenant, approveTenant, rejectTenant } from "@/lib/firestoreHelpers";
import { useFirestoreQuery } from "@/lib/firestoreQuery";
import { useQueryClient } from "@tanstack/react-query";

export interface PendingApproval extends Tenant {}

function mapDocToApproval(snap: any): PendingApproval {
  const data = snap.data() || {};
  return {
    id: snap.id,
    ownerId: data.ownerId || data.owner_id,
    name: data.name || "",
    email: data.email || "",
    phone: data.phone,
    slug: data.slug || "",
    status: data.status || "pending",
    createdAt: data.createdAt || data.created_at || "",
    approvedAt: data.approvedAt || data.approved_at,
    subscription: data.subscription || "free",
    settings: data.settings,
  };
}

export function usePendingApprovals() {
  const queryClient = useQueryClient();
  const db = getDb();

  const pendingQuery = useMemo(
    () =>
      query(
        collection(db, "tenants"),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
      ),
    [db]
  );

  const { data: approvals = [], isLoading: loading } = useFirestoreQuery<PendingApproval>({
    queryKey: ["pending-approvals"],
    collectionRef: pendingQuery,
    mapDoc: mapDocToApproval,
  });

  const handleApprove = useCallback(
    async (tenantId: string) => {
      await approveTenant(tenantId);
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    [queryClient]
  );

  const handleReject = useCallback(
    async (tenantId: string) => {
      await rejectTenant(tenantId);
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    [queryClient]
  );

  return { approvals, loading, handleApprove, handleReject };
}
