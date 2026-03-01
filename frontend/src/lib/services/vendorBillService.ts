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
import type { AgingBucketLabel } from "./invoiceService";
import { computeAgingBucket } from "./invoiceService";

export { computeAgingBucket };

export interface VendorBill {
  id: string;
  tenantId: string;
  projectId: string;
  vendorName: string;
  amount: number;
  dueDate: any;
  status: "pending" | "partial" | "paid" | "overdue";
  paidAmount: number;
  agingBucket?: AgingBucketLabel;
  description?: string;
  category?: string;
  projectPhaseId?: string;
  createdAt: any;
  updatedAt?: any;
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

export function mapRowToVendorBill(id: string, data: any): VendorBill {
  return {
    id,
    tenantId: data.tenantId || "",
    projectId: data.projectId || "",
    vendorName: data.vendorName || "",
    amount: Number(data.amount) || 0,
    dueDate: data.dueDate,
    status: data.status || "pending",
    paidAmount: Number(data.paidAmount) || 0,
    agingBucket: "current" as AgingBucketLabel,
    description: data.description || data.notes,
    category: data.category,
    projectPhaseId: data.projectPhaseId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    paidAt: data.paidAt,
  };
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
  const db = getDb();

  // Use a dedup lock doc to prevent race conditions.
  // The lock doc ID is deterministic — concurrent identical requests will
  // contend on the same document inside the transaction.
  const dedupKey = `dedup_${data.projectId}_${data.vendorName}_${data.amount}`;
  const dedupRef = doc(db, `tenants/${tenantId}/vendorBills`, dedupKey);

  const billId = await runTransaction(db, async (tx) => {
    const dedupSnap = await tx.get(dedupRef);
    if (dedupSnap.exists()) {
      const dedupData = dedupSnap.data();
      const createdMs = new Date(dedupData.createdAt).getTime();
      if (createdMs > 0 && Date.now() - createdMs < 60000) {
        throw new Error("Duplicate vendor bill detected. An identical bill was just created.");
      }
    }

    const billRef = doc(collection(db, `tenants/${tenantId}/vendorBills`));
    const now = new Date().toISOString();
    tx.set(billRef, {
      tenantId: tenantId,
      projectId: data.projectId,
      vendorName: data.vendorName,
      amount: data.amount,
      dueDate: data.dueDate.toISOString().split("T")[0],
      status: "pending",
      paidAmount: 0,
      balance: data.amount,
      description: data.description || null,
      createdAt: now,
      updatedAt: now,
    });

    // Update dedup lock timestamp
    tx.set(dedupRef, { createdAt: now, billId: billRef.id });

    return billRef.id;
  });

  return billId;
}

export async function updateVendorBill(
  tenantId: string,
  billId: string,
  updates: Partial<
    Pick<VendorBill, "status" | "amount" | "dueDate" | "description" | "vendorName">
  >
): Promise<void> {
  const db = getDb();
  const dbUpdates: Record<string, any> = { updatedAt: serverTimestamp() };
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
  if (updates.vendorName !== undefined) dbUpdates.vendorName = updates.vendorName;
  if (updates.dueDate !== undefined) {
    dbUpdates.dueDate =
      updates.dueDate instanceof Date
        ? updates.dueDate.toISOString().split("T")[0]
        : updates.dueDate;
  }
  if (updates.description !== undefined) dbUpdates.description = updates.description;

  await updateDoc(doc(db, `tenants/${tenantId}/vendorBills`, billId), dbUpdates);
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
  const db = getDb();
  const billRef = doc(db, `tenants/${tenantId}/vendorBills`, billId);

  await runTransaction(db, async (tx) => {
    const billSnap = await tx.get(billRef);
    if (!billSnap.exists()) throw new Error("Vendor bill not found");

    const billData = billSnap.data()!;
    const newPaid = (billData.paidAmount ?? 0) + payment.amount;
    if (Math.round(newPaid * 100) > Math.round(billData.amount * 100)) throw new Error("Payment exceeds bill amount");

    const paymentRef = doc(collection(billRef, "payments"));
    tx.set(paymentRef, {
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference || null,
      paidAt: payment.paidOn.toISOString(),
      recordedBy: payment.createdBy || null,
      createdAt: new Date().toISOString(),
    });

    tx.update(billRef, {
      paidAmount: newPaid,
      balance: billData.amount - newPaid,
      status: newPaid >= billData.amount ? "paid" : "partial",
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function getVendorBillPayments(
  tenantId: string,
  billId: string
): Promise<VendorPayment[]> {
  const db = getDb();
  const paymentsSnap = await getDocs(
    query(
      collection(db, `tenants/${tenantId}/vendorBills/${billId}/payments`),
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
