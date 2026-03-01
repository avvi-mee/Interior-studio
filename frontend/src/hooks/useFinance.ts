"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  limit as firestoreLimit,
  getDocs,
} from "firebase/firestore";
import { useFirestoreQuery } from "@/lib/firestoreQuery";
import {
  Invoice,
  AgingBucketLabel,
  computeAgingBucket,
  mapRowToInvoice,
  createInvoice as createInvoiceSvc,
  updateInvoice,
  addPaymentToInvoice,
} from "@/lib/services/invoiceService";
import {
  VendorBill,
  mapRowToVendorBill,
  createVendorBill as createVendorBillSvc,
  addPaymentToVendorBill,
} from "@/lib/services/vendorBillService";
import type { Payment } from "@/lib/services/invoiceService";
import type { VendorPayment } from "@/lib/services/vendorBillService";

// =============================================================================
// Firebase/Firestore migration:
//   - invoices stored at tenants/{tenantId}/invoices
//   - vendor bills stored at tenants/{tenantId}/vendorBills
//   - balance is computed client-side (amount - paidAmount)
//   - aging bucket computed client-side
// =============================================================================

export interface AgingBucket {
  current: number;   // 0-30 days
  thirtyOne: number; // 31-60 days
  sixtyOne: number;  // 61-90 days
  ninetyPlus: number; // 90+ days
}

export interface FinanceStats {
  totalReceivable: number;
  overdueReceivable: number;
  totalPayable: number;
  overduePayable: number;
  netPosition: number;
  receivableAging: AgingBucket;
  payableAging: AgingBucket;
}

export interface ProjectFinanceSummary {
  totalInvoiced: number;
  totalReceived: number;
  outstanding: number;
  totalVendorBills: number;
  totalPaidToVendors: number;
  remainingPayable: number;
  invoices: Invoice[];
  vendorBills: VendorBill[];
}

function parseDateMs(d: any): number | null {
  if (!d) return null;
  if (d instanceof Date) return d.getTime();
  if (typeof d === "string") {
    const ms = new Date(d).getTime();
    return isNaN(ms) ? null : ms;
  }
  if (typeof d?.toMillis === "function") return d.toMillis();
  return null;
}

function enrichOverdueStatus<T extends { id: string; status: string; paidAmount: number; amount: number; dueDate: any }>(
  items: T[],
  overdueStatus: string
): T[] {
  const now = Date.now();
  return items.map((item) => {
    if (item.paidAmount >= item.amount) return item;
    const dueDateMs = parseDateMs(item.dueDate);
    if (dueDateMs && dueDateMs < now && item.status !== "paid") {
      return { ...item, status: overdueStatus };
    }
    return item;
  });
}

function enrichAgingBucket<T extends { dueDate: any; paidAmount: number; amount: number }>(
  items: T[]
): (T & { agingBucket: AgingBucketLabel })[] {
  return items.map((item) => {
    if (item.paidAmount >= item.amount) {
      return { ...item, agingBucket: "current" as AgingBucketLabel };
    }
    return { ...item, agingBucket: computeAgingBucket(item.dueDate) };
  });
}

function computeAging(items: Array<{ amount: number; paidAmount: number; dueDate: any }>): AgingBucket {
  const bucket: AgingBucket = { current: 0, thirtyOne: 0, sixtyOne: 0, ninetyPlus: 0 };
  const now = Date.now();
  for (const item of items) {
    const outstanding = item.amount - item.paidAmount;
    if (outstanding <= 0) continue;
    const dueDateMs = parseDateMs(item.dueDate);
    if (!dueDateMs) {
      bucket.current += outstanding;
      continue;
    }
    const daysOverdue = Math.floor((now - dueDateMs) / 86400000);
    if (daysOverdue <= 30) bucket.current += outstanding;        // matches computeAgingBucket
    else if (daysOverdue <= 60) bucket.thirtyOne += outstanding; // 31-60 days past due
    else if (daysOverdue <= 90) bucket.sixtyOne += outstanding;  // 61-90 days past due
    else bucket.ninetyPlus += outstanding;                       // 90+ days past due
  }
  return bucket;
}

export function useFinance(tenantId: string | null) {
  const queryClient = useQueryClient();
  const qk = ["finance", tenantId] as const;
  const db = getDb();

  // Build Firestore queries for invoices and vendor bills
  const invoicesQuery = useMemo(() => {
    if (!tenantId) return null;
    return query(
      collection(db, `tenants/${tenantId}/invoices`),
      orderBy("createdAt", "desc"),
      firestoreLimit(100)
    );
  }, [db, tenantId]);

  const vendorBillsQuery = useMemo(() => {
    if (!tenantId) return null;
    return query(
      collection(db, `tenants/${tenantId}/vendorBills`),
      orderBy("createdAt", "desc"),
      firestoreLimit(100)
    );
  }, [db, tenantId]);

  // Fetch invoices
  const { data: rawInvoices = [], isLoading: loadingInvoices } = useFirestoreQuery<Invoice>({
    queryKey: ["finance-invoices", tenantId],
    collectionRef: invoicesQuery!,
    mapDoc: (snap) => mapRowToInvoice(snap.id, snap.data() || {}),
    enabled: !!tenantId && !!invoicesQuery,
  });

  // Fetch vendor bills
  const { data: rawVendorBills = [], isLoading: loadingBills } = useFirestoreQuery<VendorBill>({
    queryKey: ["finance-vendor-bills", tenantId],
    collectionRef: vendorBillsQuery!,
    mapDoc: (snap) => mapRowToVendorBill(snap.id, snap.data() || {}),
    enabled: !!tenantId && !!vendorBillsQuery,
  });

  const loading = loadingInvoices || loadingBills;

  // Enrich invoices and vendor bills with overdue status and aging buckets
  const invoices = useMemo(
    () => enrichAgingBucket(enrichOverdueStatus(rawInvoices, "overdue")),
    [rawInvoices]
  );

  const vendorBills = useMemo(
    () => enrichAgingBucket(enrichOverdueStatus(rawVendorBills, "overdue")),
    [rawVendorBills]
  );

  const invalidate = useCallback(
    () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoices", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["finance-vendor-bills", tenantId] });
    },
    [queryClient, tenantId]
  );

  // Finance stats
  const stats = useMemo<FinanceStats>(() => {
    const totalReceivable = invoices.reduce((s, i) => s + (i.amount - i.paidAmount), 0);
    const overdueReceivable = invoices
      .filter((i) => i.status === "overdue")
      .reduce((s, i) => s + (i.amount - i.paidAmount), 0);
    const totalPayable = vendorBills.reduce((s, b) => s + (b.amount - b.paidAmount), 0);
    const overduePayable = vendorBills
      .filter((b) => b.status === "overdue")
      .reduce((s, b) => s + (b.amount - b.paidAmount), 0);
    return {
      totalReceivable,
      overdueReceivable,
      totalPayable,
      overduePayable,
      netPosition: totalReceivable - totalPayable,
      receivableAging: computeAging(invoices),
      payableAging: computeAging(vendorBills),
    };
  }, [invoices, vendorBills]);

  // Per-project summary
  const getProjectFinanceSummary = useCallback(
    (projectId: string): ProjectFinanceSummary => {
      const projInvoices = invoices.filter((i) => i.projectId === projectId);
      const projBills = vendorBills.filter((b) => b.projectId === projectId);
      const totalInvoiced = projInvoices.reduce((s, i) => s + i.amount, 0);
      const totalReceived = projInvoices.reduce((s, i) => s + i.paidAmount, 0);
      const totalVendorBills = projBills.reduce((s, b) => s + b.amount, 0);
      const totalPaidToVendors = projBills.reduce((s, b) => s + b.paidAmount, 0);
      return {
        totalInvoiced,
        totalReceived,
        outstanding: totalInvoiced - totalReceived,
        totalVendorBills,
        totalPaidToVendors,
        remainingPayable: totalVendorBills - totalPaidToVendors,
        invoices: projInvoices,
        vendorBills: projBills,
      };
    },
    [invoices, vendorBills]
  );

  // Mutations
  const createInvoice = useCallback(
    async (data: {
      projectId: string;
      clientId: string;
      clientEmail: string;
      clientName: string;
      amount: number;
      dueDate: Date;
      description?: string;
    }) => {
      if (!tenantId) return;
      await createInvoiceSvc(tenantId, data);
      invalidate();
    },
    [tenantId, invalidate]
  );

  const updateInvoiceStatus = useCallback(
    async (invoiceId: string, status: Invoice["status"]) => {
      if (!tenantId) return;
      await updateInvoice(tenantId, invoiceId, { status });
      invalidate();
    },
    [tenantId, invalidate]
  );

  const recordInvoicePayment = useCallback(
    async (
      invoiceId: string,
      payment: {
        amount: number;
        paidOn: Date;
        method: Payment["method"];
        reference?: string;
        createdBy?: string;
      }
    ) => {
      if (!tenantId) return;
      await addPaymentToInvoice(tenantId, invoiceId, payment);
      invalidate();
    },
    [tenantId, invalidate]
  );

  const createVendorBill = useCallback(
    async (data: {
      projectId: string;
      vendorName: string;
      amount: number;
      dueDate: Date;
      description?: string;
    }) => {
      if (!tenantId) return;
      await createVendorBillSvc(tenantId, data);
      invalidate();
    },
    [tenantId, invalidate]
  );

  const recordVendorPayment = useCallback(
    async (
      billId: string,
      payment: {
        amount: number;
        paidOn: Date;
        method: VendorPayment["method"];
        reference?: string;
        createdBy?: string;
      }
    ) => {
      if (!tenantId) return;
      await addPaymentToVendorBill(tenantId, billId, payment);
      invalidate();
    },
    [tenantId, invalidate]
  );

  const sendPaymentReminder = useCallback(
    async (options?: { type?: "invoice" | "bill"; id?: string }) => {
      if (!tenantId) return { success: false };
      try {
        const res = await fetch("/api/payment-reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId,
            targetType: options?.type,
            targetId: options?.id,
          }),
        });
        return await res.json();
      } catch (error) {
        console.error("Error sending payment reminder:", error);
        return { success: false };
      }
    },
    [tenantId]
  );

  return {
    invoices,
    vendorBills,
    stats,
    loading,
    getProjectFinanceSummary,
    createInvoice,
    updateInvoiceStatus,
    recordInvoicePayment,
    createVendorBill,
    recordVendorPayment,
    sendPaymentReminder,
  };
}
