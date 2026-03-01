"use client";

import { useMemo } from "react";
import { getDb } from "@/lib/firebase";
import { collection, query } from "firebase/firestore";
import { useFirestoreQuery } from "@/lib/firestoreQuery";

export interface PlatformStats {
  totalCompanies: number;
  activeCompanies: number;
  platformRevenue: number;
  growthRate: number;
  companiesLastMonth: number;
  companiesThisMonth: number;
  revenueLastMonth: number;
  loading: boolean;
}

const EMPTY: PlatformStats = {
  totalCompanies: 0,
  activeCompanies: 0,
  platformRevenue: 0,
  growthRate: 0,
  companiesLastMonth: 0,
  companiesThisMonth: 0,
  revenueLastMonth: 0,
  loading: true,
};

interface TenantRow {
  id: string;
  status: string;
  activatedAt?: string;
  createdAt?: string;
}

function mapDocToTenantRow(snap: any): TenantRow {
  const data = snap.data() || {};
  return {
    id: snap.id,
    status: data.status || "",
    activatedAt: data.activatedAt || data.activated_at || undefined,
    createdAt: data.createdAt || data.created_at || undefined,
  };
}

export function usePlatformStats(): PlatformStats {
  const db = getDb();

  const tenantsQuery = useMemo(() => query(collection(db, "tenants")), [db]);

  const { data: companies = [], isLoading } = useFirestoreQuery<TenantRow>({
    queryKey: ["platform-stats"],
    collectionRef: tenantsQuery,
    mapDoc: mapDocToTenantRow,
    staleTime: 60 * 1000,
  });

  const stats = useMemo<PlatformStats>(() => {
    if (companies.length === 0 && isLoading) {
      return { ...EMPTY, loading: true };
    }

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalCompanies = companies.filter((c) => c.status !== "rejected").length;
    const activeCompanies = companies.filter(
      (c) => c.status === "active" && c.activatedAt
    ).length;

    const companiesLastMonth = companies.filter((c) => {
      if (!c.createdAt) return false;
      return new Date(c.createdAt) < startOfThisMonth;
    }).length;

    const companiesThisMonth = companies.filter((c) => {
      if (!c.createdAt) return false;
      return new Date(c.createdAt) >= startOfThisMonth;
    }).length;

    const growthRate =
      companiesLastMonth > 0
        ? ((totalCompanies - companiesLastMonth) / companiesLastMonth) * 100
        : totalCompanies > 0
          ? 100
          : 0;

    return {
      totalCompanies,
      activeCompanies,
      platformRevenue: 0,
      growthRate,
      companiesLastMonth,
      companiesThisMonth,
      revenueLastMonth: 0,
      loading: false,
    };
  }, [companies, isLoading]);

  return stats;
}
