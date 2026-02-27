import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

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
  description?: string;
  createdAt: any;
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

export async function generateInvoiceNumber(tenantId: string): Promise<string> {
  const snapshot = await getDocs(
    query(collection(db, `tenants/${tenantId}/invoices`))
  );
  const nextNum = snapshot.size + 1;
  return `INV-${String(nextNum).padStart(3, "0")}`;
}

export async function createInvoice(
  tenantId: string,
  data: {
    projectId: string;
    clientId: string;
    clientName: string;
    amount: number;
    dueDate: Date;
    description?: string;
  }
): Promise<string> {
  const invoiceNumber = await generateInvoiceNumber(tenantId);
  const docRef = await addDoc(
    collection(db, `tenants/${tenantId}/invoices`),
    {
      tenantId,
      projectId: data.projectId,
      clientId: data.clientId,
      clientName: data.clientName,
      invoiceNumber,
      amount: data.amount,
      dueDate: Timestamp.fromDate(data.dueDate),
      status: "draft",
      paidAmount: 0,
      description: data.description || null,
      createdAt: serverTimestamp(),
    }
  );
  return docRef.id;
}

export async function updateInvoice(
  tenantId: string,
  invoiceId: string,
  updates: Partial<Pick<Invoice, "status" | "amount" | "dueDate" | "description">>
): Promise<void> {
  const ref = doc(db, `tenants/${tenantId}/invoices`, invoiceId);
  await updateDoc(ref, updates);
}

function computeInvoiceStatus(
  amount: number,
  paidAmount: number,
  dueDate: any
): Invoice["status"] {
  if (paidAmount >= amount) return "paid";
  if (paidAmount > 0) return "partial";
  const dueDateMs = dueDate?.toMillis
    ? dueDate.toMillis()
    : dueDate instanceof Date
    ? dueDate.getTime()
    : null;
  if (dueDateMs && dueDateMs < Date.now()) return "overdue";
  return "sent";
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
  // Add payment to subcollection
  await addDoc(
    collection(db, `tenants/${tenantId}/invoices/${invoiceId}/payments`),
    {
      amount: payment.amount,
      paidOn: Timestamp.fromDate(payment.paidOn),
      method: payment.method,
      reference: payment.reference || null,
      createdBy: payment.createdBy || null,
      createdAt: serverTimestamp(),
    }
  );

  // Get parent invoice and update
  const invoiceRef = doc(db, `tenants/${tenantId}/invoices`, invoiceId);
  const invoiceSnap = await getDoc(invoiceRef);
  if (!invoiceSnap.exists()) return;

  const invoiceData = invoiceSnap.data();
  const newPaidAmount = (invoiceData.paidAmount || 0) + payment.amount;
  const newStatus = computeInvoiceStatus(
    invoiceData.amount,
    newPaidAmount,
    invoiceData.dueDate
  );

  await updateDoc(invoiceRef, {
    paidAmount: newPaidAmount,
    status: newStatus,
    ...(newStatus === "paid" ? { paidAt: serverTimestamp() } : {}),
  });
}

export async function getInvoicePayments(
  tenantId: string,
  invoiceId: string
): Promise<Payment[]> {
  const snapshot = await getDocs(
    query(
      collection(db, `tenants/${tenantId}/invoices/${invoiceId}/payments`),
      orderBy("paidOn", "desc")
    )
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));
}
