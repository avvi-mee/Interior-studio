"use client";

import { getDb } from "@/lib/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { useFirestoreQuery } from "@/lib/firestoreQuery";

export interface Estimate {
  id: string;
  customerName: string;
  phoneNumber: string;
  email: string;
  type: string;
  amount: number;
  status: "pending" | "approved" | "contacted" | "rejected";
  createdAt: any;
  pdfLink?: string;
  tenantId: string;
}

function mapDoc(snap: any): Estimate {
  const data = snap.data();
  return {
    id: snap.id,
    customerName: data.customerName ?? data.customer_name ?? "",
    phoneNumber: data.phoneNumber ?? data.phone_number ?? "",
    email: data.email ?? "",
    type: data.type ?? data.segment ?? "",
    amount: data.totalAmount ?? data.total_amount ?? data.amount ?? 0,
    status: data.status || "pending",
    createdAt: data.createdAt ?? data.created_at,
    pdfLink: data.pdfUrl ?? data.pdf_url ?? data.pdfLink ?? undefined,
    tenantId: data.tenantId ?? "",
  };
}

export function useEstimates(tenantId: string | null) {
  const db = getDb();

  const { data: estimates = [], isLoading: loading } = useFirestoreQuery<Estimate>({
    queryKey: ["estimates", tenantId],
    collectionRef: query(
      collection(db, `tenants/${tenantId}/estimates`),
      orderBy("createdAt", "desc"),
      limit(200)
    ),
    mapDoc,
    enabled: !!tenantId,
  });

  return { estimates, loading };
}
