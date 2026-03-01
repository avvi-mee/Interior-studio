import { getDb } from "@/lib/firebase";
import {
  doc,
  getDocs,
  updateDoc,
  collection,
  query,
  orderBy,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

export type AgingBucketLabel = "current" | "31-60" | "61-90" | "90+";

export interface Invoice {
  id: string;
  tenantId: string;
  projectId: string;
  clientId: string;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: any;
  status: "draft" | "sent" | "partial" | "paid" | "overdue";
  paidAmount: number;
  agingBucket?: AgingBucketLabel;
  description?: string;
  createdAt: any;
  updatedAt?: any;
  paidAt?: any;
}

export interface Payment {
  id: string;
  amount: number;
  paidOn: any;
  method: "cash" | "bank_transfer" | "upi" | "cheque" | "card" | "other";
  reference?: string;
  createdBy?: string;
  createdAt: any;
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

export function computeAgingBucket(dueDate: any): AgingBucketLabel {
  const now = Date.now();
  const dueDateMs = parseDateMs(dueDate);
  if (!dueDateMs) return "current";
  const daysOverdue = Math.floor((now - dueDateMs) / 86400000);
  if (daysOverdue <= 30) return "current";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

export function mapRowToInvoice(id: string, data: any): Invoice {
  return {
    id,
    tenantId: data.tenantId || "",
    projectId: data.projectId || "",
    clientId: data.clientId || "",
    clientName: data.clientName || "",
    invoiceNumber: data.invoiceNumber || "",
    amount: Number(data.amount) || 0,
    dueDate: data.dueDate,
    status: data.status || "draft",
    paidAmount: Number(data.paidAmount) || 0,
    agingBucket: "current" as AgingBucketLabel,
    description: data.notes || data.description,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    paidAt: data.paidAt,
  };
}

export async function generateInvoiceNumber(tenantId: string): Promise<string> {
  const db = getDb();
  const counterRef = doc(db, `tenants/${tenantId}/counters/invoices`);

  const newNumber = await runTransaction(db, async (tx) => {
    const counterDoc = await tx.get(counterRef);
    const lastNumber = counterDoc.exists() ? (counterDoc.data()?.lastNumber ?? 0) : 0;
    const nextNum = lastNumber + 1;
    tx.set(counterRef, { lastNumber: nextNum, prefix: "INV" }, { merge: true });
    return nextNum;
  });

  return `INV-${String(newNumber).padStart(5, "0")}`;
}

export async function createInvoice(
  tenantId: string,
  data: {
    projectId: string;
    clientId: string;
    clientEmail: string;    // customer email — used by /api/my-invoices for email-based filtering
    clientName: string;
    amount: number;
    dueDate: Date;
    description?: string;
  }
): Promise<string> {
  const db = getDb();
  const counterRef = doc(db, `tenants/${tenantId}/counters/invoices`);

  // Atomic: generate invoice number + duplicate check + create invoice
  const invoiceId = await runTransaction(db, async (tx) => {
    // Generate invoice number inside the transaction
    const counterDoc = await tx.get(counterRef);
    const lastNumber = counterDoc.exists() ? (counterDoc.data()?.lastNumber ?? 0) : 0;
    const nextNum = lastNumber + 1;
    tx.set(counterRef, { lastNumber: nextNum, prefix: "INV" }, { merge: true });
    const invoiceNumber = `INV-${String(nextNum).padStart(5, "0")}`;

    // Create invoice with a pre-generated doc ref
    const invoiceRef = doc(collection(db, `tenants/${tenantId}/invoices`));
    const now = new Date().toISOString();
    tx.set(invoiceRef, {
      tenantId: tenantId,
      projectId: data.projectId,
      clientId: data.clientId || null,        // customer Firebase UID (may be null for legacy projects)
      clientEmail: data.clientEmail || null,   // used by /api/my-invoices email-based filter
      clientName: data.clientName,
      invoiceNumber,
      amount: data.amount,
      paidAmount: 0,
      balance: data.amount,
      dueDate: data.dueDate.toISOString().split("T")[0],
      status: "sent",
      notes: data.description || null,
      createdAt: now,
      updatedAt: now,
    });

    return invoiceRef.id;
  });

  return invoiceId;
}

export async function updateInvoice(
  tenantId: string,
  invoiceId: string,
  updates: Partial<Pick<Invoice, "status" | "amount" | "dueDate" | "description">>
): Promise<void> {
  const db = getDb();
  const dbUpdates: Record<string, any> = { updatedAt: serverTimestamp() };
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
  if (updates.dueDate !== undefined) {
    dbUpdates.dueDate =
      updates.dueDate instanceof Date
        ? updates.dueDate.toISOString().split("T")[0]
        : updates.dueDate;
  }
  if (updates.description !== undefined) dbUpdates.notes = updates.description;

  await updateDoc(doc(db, `tenants/${tenantId}/invoices`, invoiceId), dbUpdates);
}

export async function addPaymentToInvoice(
  tenantId: string,
  invoiceId: string,
  payment: {
    amount: number;
    paidOn: Date;
    method: Payment["method"];
    reference?: string;
    createdBy?: string;
  }
): Promise<void> {
  const db = getDb();
  const invoiceRef = doc(db, `tenants/${tenantId}/invoices`, invoiceId);

  await runTransaction(db, async (tx) => {
    const invSnap = await tx.get(invoiceRef);
    if (!invSnap.exists()) throw new Error("Invoice not found");

    const invData = invSnap.data()!;
    const newPaid = (invData.paidAmount ?? 0) + payment.amount;
    if (Math.round(newPaid * 100) > Math.round(invData.amount * 100)) throw new Error("Payment exceeds invoice amount");

    const paymentRef = doc(collection(invoiceRef, "payments"));
    tx.set(paymentRef, {
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference || null,
      paidAt: payment.paidOn.toISOString(),
      recordedBy: payment.createdBy || null,
      createdAt: new Date().toISOString(),
    });

    tx.update(invoiceRef, {
      paidAmount: newPaid,
      balance: invData.amount - newPaid,
      status: newPaid >= invData.amount ? "paid" : "partial",
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function getInvoicePayments(
  tenantId: string,
  invoiceId: string
): Promise<Payment[]> {
  const db = getDb();
  const paymentsSnap = await getDocs(
    query(
      collection(db, `tenants/${tenantId}/invoices/${invoiceId}/payments`),
      orderBy("paidAt", "desc")
    )
  );

  return paymentsSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      amount: Number(data.amount),
      paidOn: data.paidAt,
      method: data.method,
      reference: data.reference,
      createdAt: data.createdAt,
    };
  });
}
