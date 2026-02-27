"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import {
  Invoice,
  createInvoice as createInvoiceSvc,
  updateInvoice,
  addPaymentToInvoice,
} from "@/lib/services/invoiceService";
import {
  VendorBill,
  createVendorBill as createVendorBillSvc,
  addPaymentToVendorBill,
} from "@/lib/services/vendorBillService";
import type { Payment } from "@/lib/services/invoiceService";
import type { VendorPayment } from "@/lib/services/vendorBillService";

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

function enrichOverdueStatus<T extends { status: string; paidAmount: number; amount: number; dueDate: any }>(
  items: T[],
  overdueStatus: string
): T[] {
  const now = Date.now();
  return items.map((item) => {
    if (item.paidAmount >= item.amount) return item;
    const dueDateMs = item.dueDate?.toMillis
      ? item.dueDate.toMillis()
      : item.dueDate instanceof Date
      ? item.dueDate.getTime()
      : null;
    if (dueDateMs && dueDateMs < now && item.status !== "paid") {
      return { ...item, status: overdueStatus };
    }
    return item;
  });
}

function computeAging(items: Array<{ amount: number; paidAmount: number; dueDate: any }>): AgingBucket {
  const bucket: AgingBucket = { current: 0, thirtyOne: 0, sixtyOne: 0, ninetyPlus: 0 };
  const now = Date.now();
  for (const item of items) {
    const outstanding = item.amount - item.paidAmount;
    if (outstanding <= 0) continue;
    const dueDateMs = item.dueDate?.toMillis
      ? item.dueDate.toMillis()
      : item.dueDate instanceof Date
      ? item.dueDate.getTime()
      : null;
    if (!dueDateMs) {
      bucket.current += outstanding;
      continue;
    }
    const daysOverdue = Math.floor((now - dueDateMs) / 86400000);
    if (daysOverdue <= 0) bucket.current += outstanding;
    else if (daysOverdue <= 30) bucket.current += outstanding;
    else if (daysOverdue <= 60) bucket.thirtyOne += outstanding;
    else if (daysOverdue <= 90) bucket.sixtyOne += outstanding;
    else bucket.ninetyPlus += outstanding;
  }
  return bucket;
}

export function useFinance(tenantId: string | null) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
  const [loading, setLoading] = useState(true);

  // Listen to invoices
  useEffect(() => {
    if (!tenantId) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, `tenants/${tenantId}/invoices`),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));
      setInvoices(enrichOverdueStatus(docs, "overdue"));
      setLoading(false);
    });
    return () => unsub();
  }, [tenantId]);

  // Listen to vendor bills
  useEffect(() => {
    if (!tenantId) {
      setVendorBills([]);
      return;
    }
    const q = query(
      collection(db, `tenants/${tenantId}/vendorBills`),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as VendorBill));
      setVendorBills(enrichOverdueStatus(docs, "overdue"));
    });
    return () => unsub();
  }, [tenantId]);

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
      clientName: string;
      amount: number;
      dueDate: Date;
      description?: string;
    }) => {
      if (!tenantId) return;
      await createInvoiceSvc(tenantId, data);
    },
    [tenantId]
  );

  const updateInvoiceStatus = useCallback(
    async (invoiceId: string, status: Invoice["status"]) => {
      if (!tenantId) return;
      await updateInvoice(tenantId, invoiceId, { status });
    },
    [tenantId]
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
    },
    [tenantId]
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
    },
    [tenantId]
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
  };
}
