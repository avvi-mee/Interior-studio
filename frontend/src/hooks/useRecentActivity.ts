"use client";

import { useMemo } from "react";
import { getDb } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  limit as firestoreLimit,
} from "firebase/firestore";
import { Activity, formatRelativeTime } from "@/lib/firestoreHelpers";
import { useFirestoreQuery } from "@/lib/firestoreQuery";

export interface ActivityWithTime extends Activity {
  relativeTime: string;
}

function mapDocToActivity(snap: any): ActivityWithTime {
  const data = snap.data() || {};
  const createdAt = data.createdAt || data.created_at || "";
  return {
    id: snap.id,
    type: data.type || "signup",
    description: data.description || "",
    tenantId: data.tenantId || data.tenant_id,
    tenantName: data.tenantName || data.tenant_name,
    createdAt,
    metadata: data.metadata,
    relativeTime: createdAt ? formatRelativeTime(createdAt) : "Unknown",
  };
}

export function useRecentActivity(maxItems: number = 10) {
  const db = getDb();

  const activitiesQuery = useMemo(
    () =>
      query(
        collection(db, "activities"),
        orderBy("createdAt", "desc"),
        firestoreLimit(maxItems)
      ),
    [db, maxItems]
  );

  const { data: activities = [], isLoading: loading } = useFirestoreQuery<ActivityWithTime>({
    queryKey: ["recent-activities", maxItems],
    collectionRef: activitiesQuery,
    mapDoc: mapDocToActivity,
  });

  return { activities, loading };
}
