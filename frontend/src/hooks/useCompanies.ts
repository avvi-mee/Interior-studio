"use client";

import { useState, useMemo } from "react";
import { getDb } from "@/lib/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Tenant } from "@/lib/firestoreHelpers";
import { useFirestoreQuery } from "@/lib/firestoreQuery";

function mapDocToTenant(snap: any): Tenant {
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

export function useCompanies() {
  const [searchQuery, setSearchQuery] = useState("");
  const db = getDb();

  const companiesQuery = useMemo(
    () => query(collection(db, "tenants"), orderBy("createdAt", "desc")),
    [db]
  );

  const { data: companies = [], isLoading: loading } = useFirestoreQuery<Tenant>({
    queryKey: ["companies"],
    collectionRef: companiesQuery,
    mapDoc: mapDocToTenant,
  });

  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.slug ?? "").toLowerCase().includes(q)
    );
  }, [searchQuery, companies]);

  return {
    companies: filteredCompanies,
    loading,
    searchQuery,
    setSearchQuery,
    totalCount: companies.length,
    filteredCount: filteredCompanies.length,
  };
}
