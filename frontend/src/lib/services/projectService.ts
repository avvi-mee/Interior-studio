import { db } from "@/lib/firebase";
import { collection, addDoc, doc, updateDoc, arrayUnion, serverTimestamp, Timestamp, getDocs, query, orderBy, limit } from "firebase/firestore";
import { getDefaultPhases, Phase } from "./taskTemplates";
import type { Lead } from "@/hooks/useLeads";
import type { Order } from "@/hooks/useOrders";

export interface Project {
  id: string;
  tenantId: string;
  leadId: string;
  estimateId?: string;
  customerId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCity?: string;
  projectType: string;
  plan: string;
  carpetArea: number;
  totalAmount: number;
  status: "planning" | "in_progress" | "on_hold" | "completed" | "cancelled";
  assignedTo?: string;
  assignedToName?: string;
  phases: Phase[];
  startDate?: any;
  expectedEndDate?: any;
  completedDate?: any;
  createdAt: any;
  updatedAt?: any;
  timeline: Array<{
    action: string;
    timestamp: any;
    updatedBy?: string;
    note?: string;
  }>;
  projectProgress?: number;
  healthStatus?: "on_track" | "at_risk" | "delayed";
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  entityType: "task" | "phase" | "project";
  entityId: string;
  performedBy?: string;
  timestamp: any;
}

export async function createProjectFromLead(lead: Lead, tenantId: string): Promise<string> {
  const phases = getDefaultPhases(lead.projectType);

  const projectData = {
    tenantId,
    leadId: lead.id,
    estimateId: lead.estimateId || null,
    customerId: lead.userId,
    clientName: lead.name,
    clientEmail: lead.email,
    clientPhone: lead.phone,
    clientCity: lead.city || null,
    projectType: lead.projectType,
    plan: lead.basics?.plan || "Standard",
    carpetArea: lead.basics?.carpetArea || 0,
    totalAmount: lead.totalAmount,
    status: "planning",
    phases,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    timeline: [{
      action: "Project created from approved lead",
      timestamp: Timestamp.now(),
      note: `Lead ID: ${lead.id}`,
    }],
  };

  const projectRef = await addDoc(collection(db, `tenants/${tenantId}/projects`), projectData);

  // Update lead to mark as converted
  const leadRef = doc(db, "leads", lead.id);
  await updateDoc(leadRef, {
    projectId: projectRef.id,
    stage: "converted",
    updatedAt: serverTimestamp(),
    timeline: arrayUnion({
      action: "Converted to project",
      timestamp: Timestamp.now(),
      note: `Project ID: ${projectRef.id}`,
    }),
  });

  return projectRef.id;
}

export async function createProjectFromOrder(order: Order, tenantId: string): Promise<string> {
  const phases = getDefaultPhases(order.segment || "Residential");

  const projectData = {
    tenantId,
    leadId: order.leadId || null,
    estimateId: order.id,
    customerId: order.customerId || null,
    clientName: order.customerInfo?.name || order.clientName || "Unknown",
    clientEmail: order.customerInfo?.email || order.clientEmail || "",
    clientPhone: order.customerInfo?.phone || order.clientPhone || "",
    clientCity: order.customerInfo?.city || null,
    projectType: order.segment || "Residential",
    plan: order.plan || "Standard",
    carpetArea: order.carpetArea || 0,
    totalAmount: order.totalAmount || 0,
    status: "planning",
    assignedTo: order.assignedTo || null,
    assignedToName: order.assignedToName || null,
    phases,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    timeline: [{
      action: "Project created from approved order",
      timestamp: Timestamp.now(),
      note: `Estimate ID: ${order.id}`,
    }],
  };

  const projectRef = await addDoc(collection(db, `tenants/${tenantId}/projects`), projectData);

  // Update the order to mark as converted
  const orderRef = doc(db, `tenants/${tenantId}/estimates`, order.id);
  await updateDoc(orderRef, {
    projectId: projectRef.id,
    stage: "converted",
    updatedAt: serverTimestamp(),
    timeline: arrayUnion({
      action: "Converted to project",
      timestamp: Timestamp.now(),
      note: `Project ID: ${projectRef.id}`,
    }),
  });

  return projectRef.id;
}

export async function logActivity(
  tenantId: string,
  projectId: string,
  entry: {
    action: string;
    entityType: "task" | "phase" | "project";
    entityId: string;
    performedBy?: string;
  }
) {
  await addDoc(
    collection(db, `tenants/${tenantId}/projects/${projectId}/activityLog`),
    { ...entry, timestamp: serverTimestamp() }
  );
}
