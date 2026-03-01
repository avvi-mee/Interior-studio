import { getDb } from "@/lib/firebase";
import {
  doc,
  addDoc,
  collection,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { getDefaultPhases } from "./taskTemplates";
import type { Lead } from "@/hooks/useLeads";
import type { Order } from "@/hooks/useOrders";

export interface Project {
  id: string;
  tenantId: string;
  leadId: string;
  customerId?: string | null;
  estimateId?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCity?: string;
  totalAmount: number;
  status: "planning" | "in_progress" | "on_hold" | "completed" | "cancelled";
  assignedTo?: string;
  projectName?: string;
  assignedDesigner?: string;
  assignedSupervisor?: string;
  phases: import("./taskTemplates").Phase[];
  startDate?: string;
  expectedEndDate?: string;
  completedDate?: string;
  createdAt: string;
  updatedAt?: string;
  timeline: Array<{
    id: string;
    action: string;
    timestamp: string;
    updatedBy?: string;
    note?: string;
  }>;
  projectProgress?: number;
  healthStatus?: "on_track" | "at_risk" | "delayed";
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  performedBy?: string;
  performedByName?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export async function createProjectFromLead(lead: Lead, tenantId: string): Promise<string> {
  if (lead.projectId) {
    return lead.projectId;
  }

  const db = getDb();
  const phases = getDefaultPhases("Residential");
  const clientName = lead.name;

  // 1. Create project document
  const projectRef = await addDoc(collection(db, `tenants/${tenantId}/projects`), {
    leadId: lead.id,
    customerId: lead.customerId || null,
    estimateId: lead.estimateId || null,
    name: `${clientName} - Interior`,
    clientName,
    clientEmail: lead.email,
    clientPhone: lead.phone,
    clientCity: lead.city || null,
    contractValue: lead.estimatedValue || 0,
    status: "planning",
    progress: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const projectId = projectRef.id;

  // 2. Insert phases and tasks using batch
  const batch = writeBatch(db);

  for (const phase of phases) {
    const phaseRef = doc(collection(db, `tenants/${tenantId}/projects/${projectId}/phases`));
    batch.set(phaseRef, {
      name: phase.name,
      sortOrder: phase.order,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    if (phase.tasks && phase.tasks.length > 0) {
      for (let idx = 0; idx < phase.tasks.length; idx++) {
        const task = phase.tasks[idx];
        const taskRef = doc(collection(db, `tenants/${tenantId}/projects/${projectId}/tasks`));
        batch.set(taskRef, {
          phaseId: phaseRef.id,
          name: task.name,
          sortOrder: idx + 1,
          status: "pending",
          progress: 0,
          createdAt: serverTimestamp(),
        });
      }
    }
  }

  // 3. Include lead update in the batch (atomic with phases/tasks)
  batch.update(doc(db, `tenants/${tenantId}/leads`, lead.id), {
    projectId,
    stage: "won",
    status: "converted",
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  // 4. Insert activity logs (fire-and-forget)
  await Promise.allSettled([
    addDoc(collection(db, `tenants/${tenantId}/projects/${projectId}/activityLog`), {
      entityType: "lead",
      entityId: lead.id,
      action: "status_changed",
      summary: `Converted to project ${projectId}`,
      createdAt: serverTimestamp(),
    }),
    addDoc(collection(db, `tenants/${tenantId}/projects/${projectId}/activityLog`), {
      entityType: "project",
      entityId: projectId,
      action: "created",
      summary: `Project created from won lead ${lead.id}`,
      createdAt: serverTimestamp(),
    }),
  ]);

  return projectId;
}

export async function createProjectFromOrder(order: Order, tenantId: string): Promise<string> {
  const db = getDb();
  const phases = getDefaultPhases(order.segment || "Residential");
  const clientName = order.customerName || order.clientName || "Unknown";

  // 1. Create project document
  const projectRef = await addDoc(collection(db, `tenants/${tenantId}/projects`), {
    leadId: null,
    estimateId: order.id,
    name: `${clientName} - ${order.segment || "Interior"}`,
    clientName,
    clientEmail: order.customerEmail || order.clientEmail || "",
    clientPhone: order.customerPhone || order.clientPhone || "",
    clientCity: order.customerCity || null,
    contractValue: order.totalAmount || 0,
    status: "planning",
    managerId: order.assignedTo || null,
    progress: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const projectId = projectRef.id;

  // 2. Insert phases, tasks, and estimate update using batch (atomic)
  const batch = writeBatch(db);

  for (const phase of phases) {
    const phaseRef = doc(collection(db, `tenants/${tenantId}/projects/${projectId}/phases`));
    batch.set(phaseRef, {
      name: phase.name,
      sortOrder: phase.order,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    if (phase.tasks && phase.tasks.length > 0) {
      for (let idx = 0; idx < phase.tasks.length; idx++) {
        const task = phase.tasks[idx];
        const taskRef = doc(collection(db, `tenants/${tenantId}/projects/${projectId}/tasks`));
        batch.set(taskRef, {
          phaseId: phaseRef.id,
          name: task.name,
          sortOrder: idx + 1,
          status: "pending",
          progress: 0,
          createdAt: serverTimestamp(),
        });
      }
    }
  }

  // 3. Include estimate status update in the batch (atomic)
  batch.update(doc(db, `tenants/${tenantId}/estimates`, order.id), {
    status: "approved",
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  // 4. Insert activity logs (fire-and-forget)
  await Promise.allSettled([
    addDoc(collection(db, `tenants/${tenantId}/projects/${projectId}/activityLog`), {
      entityType: "estimate",
      entityId: order.id,
      action: "status_changed",
      summary: `Converted to project ${projectId}`,
      createdAt: serverTimestamp(),
    }),
    addDoc(collection(db, `tenants/${tenantId}/projects/${projectId}/activityLog`), {
      entityType: "project",
      entityId: projectId,
      action: "created",
      summary: `Project created from approved order ${order.id}`,
      createdAt: serverTimestamp(),
    }),
  ]);

  return projectId;
}

export async function logActivity(
  tenantId: string,
  projectId: string,
  entry: {
    action: string;
    entityType: string;
    entityId: string;
    performedBy?: string;
    performedByName?: string;
    metadata?: Record<string, any>;
  }
) {
  const db = getDb();
  await addDoc(collection(db, `tenants/${tenantId}/projects/${projectId}/activityLog`), {
    entityType: entry.entityType,
    entityId: entry.entityId || projectId,
    action: "updated",
    summary: entry.action,
    actorId: entry.performedBy || null,
    metadata: entry.metadata || null,
    createdAt: serverTimestamp(),
  });
}
