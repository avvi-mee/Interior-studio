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

export interface VendorBill {
  id: string;
  tenantId: string;
  projectId: string;
  vendorName: string;
  amount: number;
  dueDate: any;
  status: "pending" | "partial" | "paid" | "overdue";
  paidAmount: number;
  description?: string;
  createdAt: any;
  paidAt?: any;
}

export interface VendorPayment {
  id: string;
  amount: number;
  paidOn: any;
  method: "cash" | "bank_transfer" | "upi" | "cheque" | "card" | "other";
  reference?: string;
  createdBy?: string;
  createdAt: any;
}

export async function createVendorBill(
  tenantId: string,
  data: {
    projectId: string;
    vendorName: string;
    amount: number;
    dueDate: Date;
    description?: string;
  }
): Promise<string> {
  const docRef = await addDoc(
    collection(db, `tenants/${tenantId}/vendorBills`),
    {
      tenantId,
      projectId: data.projectId,
      vendorName: data.vendorName,
      amount: data.amount,
      dueDate: Timestamp.fromDate(data.dueDate),
      status: "pending",
      paidAmount: 0,
      description: data.description || null,
      createdAt: serverTimestamp(),
    }
  );
  return docRef.id;
}

export async function updateVendorBill(
  tenantId: string,
  billId: string,
  updates: Partial<Pick<VendorBill, "status" | "amount" | "dueDate" | "description" | "vendorName">>
): Promise<void> {
  const ref = doc(db, `tenants/${tenantId}/vendorBills`, billId);
  await updateDoc(ref, updates);
}

function computeBillStatus(
  amount: number,
  paidAmount: number,
  dueDate: any
): VendorBill["status"] {
  if (paidAmount >= amount) return "paid";
  if (paidAmount > 0) return "partial";
  const dueDateMs = dueDate?.toMillis
    ? dueDate.toMillis()
    : dueDate instanceof Date
    ? dueDate.getTime()
    : null;
  if (dueDateMs && dueDateMs < Date.now()) return "overdue";
  return "pending";
}

export async function addPaymentToVendorBill(
  tenantId: string,
  billId: string,
  payment: {
    amount: number;
    paidOn: Date;
    method: VendorPayment["method"];
    reference?: string;
    createdBy?: string;
  }
): Promise<void> {
  await addDoc(
    collection(db, `tenants/${tenantId}/vendorBills/${billId}/payments`),
    {
      amount: payment.amount,
      paidOn: Timestamp.fromDate(payment.paidOn),
      method: payment.method,
      reference: payment.reference || null,
      createdBy: payment.createdBy || null,
      createdAt: serverTimestamp(),
    }
  );

  const billRef = doc(db, `tenants/${tenantId}/vendorBills`, billId);
  const billSnap = await getDoc(billRef);
  if (!billSnap.exists()) return;

  const billData = billSnap.data();
  const newPaidAmount = (billData.paidAmount || 0) + payment.amount;
  const newStatus = computeBillStatus(
    billData.amount,
    newPaidAmount,
    billData.dueDate
  );

  await updateDoc(billRef, {
    paidAmount: newPaidAmount,
    status: newStatus,
    ...(newStatus === "paid" ? { paidAt: serverTimestamp() } : {}),
  });
}

export async function getVendorBillPayments(
  tenantId: string,
  billId: string
): Promise<VendorPayment[]> {
  const snapshot = await getDocs(
    query(
      collection(db, `tenants/${tenantId}/vendorBills/${billId}/payments`),
      orderBy("paidOn", "desc")
    )
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as VendorPayment));
}
