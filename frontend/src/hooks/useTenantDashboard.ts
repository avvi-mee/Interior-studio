"use client";

import { useMemo } from "react";
import { getDb } from "@/lib/firebase";
import {
  collection,
  doc,
  query,
  orderBy,
  limit as firestoreLimit,
} from "firebase/firestore";
import { useFirestoreQuery } from "@/lib/firestoreQuery";
import { useFirestoreDoc } from "@/lib/firestoreQuery";

export interface RecentOrder {
  id: string;
  estimateId: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  carpetArea?: number;
  numberOfRooms?: number;
  rooms?: string[];
  selectedRooms?: string[];
  materialGrade?: string;
  finishType?: string;
  estimatedAmount?: number;
  status: "pending" | "approved" | "rejected" | "generated";
  createdAt: any;
  pdfUrl?: string;
}

export interface TenantDashboardStats {
  revenue: { total: number; thisMonth: number; lastMonth: number; growth: number };
  subscription: { plan: string; status: string };
  estimatesCount: number;
  ordersCount: number;
  pendingApprovalsCount: number;
  todayEstimatesCount: number;
  rejectedThisWeekCount: number;
  recentOrders: RecentOrder[];
  loading: boolean;
}

const EMPTY: TenantDashboardStats = {
  revenue: { total: 0, thisMonth: 0, lastMonth: 0, growth: 0 },
  subscription: { plan: "free", status: "active" },
  estimatesCount: 0,
  ordersCount: 0,
  pendingApprovalsCount: 0,
  todayEstimatesCount: 0,
  rejectedThisWeekCount: 0,
  recentOrders: [],
  loading: true,
};

interface EstimateRow {
  id: string;
  status: string;
  totalAmount?: number;
  customerInfo?: { name?: string; phone?: string; email?: string };
  carpetArea?: number;
  bedrooms?: number;
  materialGrade?: string;
  finishType?: string;
  pdfUrl?: string;
  createdAt?: string;
}

function mapDocToEstimate(snap: any): EstimateRow {
  const data = snap.data() || {};
  return {
    id: snap.id,
    status: data.status || "pending",
    totalAmount: data.totalAmount ?? data.total_amount,
    customerInfo: data.customerInfo ?? data.customer_info,
    carpetArea: data.carpetArea ?? data.carpet_area,
    bedrooms: data.bedrooms,
    materialGrade: data.materialGrade ?? data.material_grade,
    finishType: data.finishType ?? data.finish_type,
    pdfUrl: data.pdfUrl ?? data.pdf_url,
    createdAt: data.createdAt ?? data.created_at,
  };
}

interface TenantInfo {
  subscription: string;
  subscriptionStatus: string;
}

function mapDocToTenantInfo(snap: any): TenantInfo | null {
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    subscription: data.subscription || data.subscriptionPlan || "free",
    subscriptionStatus: data.subscriptionStatus || "active",
  };
}

export function useTenantDashboard(tenantId: string | null) {
  const db = getDb();

  // Fetch tenant info
  const tenantDocRef = useMemo(
    () => (tenantId ? doc(db, "tenants", tenantId) : null),
    [db, tenantId]
  );

  const { data: tenantInfo } = useFirestoreDoc<TenantInfo>({
    queryKey: ["tenant-dashboard-tenant", tenantId],
    docRef: tenantDocRef!,
    mapDoc: mapDocToTenantInfo,
    enabled: !!tenantId && !!tenantDocRef,
  });

  // Fetch estimates (subcollection under the tenant)
  const estimatesQuery = useMemo(() => {
    if (!tenantId) return null;
    return query(
      collection(db, `tenants/${tenantId}/estimates`),
      orderBy("createdAt", "desc"),
      firestoreLimit(50)
    );
  }, [db, tenantId]);

  const { data: estimates = [], isLoading } = useFirestoreQuery<EstimateRow>({
    queryKey: ["tenant-dashboard-estimates", tenantId],
    collectionRef: estimatesQuery!,
    mapDoc: mapDocToEstimate,
    enabled: !!tenantId && !!estimatesQuery,
  });

  // Derive all stats from the fetched data
  const dashboardStats = useMemo<TenantDashboardStats>(() => {
    if (!tenantId) return { ...EMPTY, loading: isLoading };

    const allOrders: RecentOrder[] = estimates.map((row) => ({
      id: row.id,
      estimateId: row.id,
      clientName: row.customerInfo?.name ?? undefined,
      clientPhone: row.customerInfo?.phone ?? undefined,
      clientEmail: row.customerInfo?.email ?? undefined,
      carpetArea: row.carpetArea ?? undefined,
      numberOfRooms: row.bedrooms ?? undefined,
      materialGrade: row.materialGrade ?? undefined,
      finishType: row.finishType ?? undefined,
      estimatedAmount: row.totalAmount ?? undefined,
      status: (row.status as RecentOrder["status"]) || "pending",
      createdAt: row.createdAt,
      pdfUrl: row.pdfUrl ?? undefined,
    }));

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return {
      revenue: { total: 0, thisMonth: 0, lastMonth: 0, growth: 0 },
      subscription: {
        plan: tenantInfo?.subscription || "free",
        status: tenantInfo?.subscriptionStatus || "active",
      },
      estimatesCount: estimates.length,
      ordersCount: estimates.length,
      pendingApprovalsCount: allOrders.filter((o) => o.status === "pending").length,
      todayEstimatesCount: allOrders.filter(
        (o) => o.createdAt && new Date(o.createdAt).getTime() >= startOfToday.getTime()
      ).length,
      rejectedThisWeekCount: allOrders.filter(
        (o) =>
          o.status === "rejected" &&
          o.createdAt &&
          new Date(o.createdAt).getTime() >= startOfWeek.getTime()
      ).length,
      recentOrders: allOrders.slice(0, 5),
      loading: false,
    };
  }, [tenantId, estimates, tenantInfo, isLoading]);

  return dashboardStats;
}
