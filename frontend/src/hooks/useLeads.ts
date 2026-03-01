"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import {
  collection,
  doc,
  query,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { useFirestoreQuery } from "@/lib/firestoreQuery";
import { createProjectFromLead } from "@/lib/services/projectService";
import { calculateLeadScore, LeadScoringInput } from "@/lib/services/leadScoringService";
import { hasAnyRole } from "@/lib/permissions";

export interface Lead {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  city?: string;
  stage: "new" | "contacted" | "qualified" | "proposal_sent" | "negotiation" | "won" | "lost";
  status?: "active" | "converted" | "closed";
  source: "website" | "consultation" | "referral" | "manual" | "import";
  score: number;
  temperature: "hot" | "warm" | "cold";
  estimatedValue: number;
  assignedTo?: string;
  customerId?: string | null;
  estimateId?: string;
  projectId?: string;
  nextFollowUp?: any;
  followUpCount: number;
  lastContactedAt?: any;
  lostReason?: string;
  notes?: string;
  createdAt: any;
  updatedAt?: any;
  timeline: Array<{
    action: string;
    summary: string;
    timestamp: any;
    actorId?: string;
  }>;
}

export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  proposal_sent: number;
  negotiation: number;
  won: number;
  lost: number;
  hotCount: number;
  warmCount: number;
  coldCount: number;
  totalValue: number;
  conversionRate: number;
}

// --- Stage Transition Map ---

export const VALID_TRANSITIONS: Record<string, string[]> = {
  new:            ["contacted", "lost"],
  contacted:      ["qualified", "lost"],
  qualified:      ["proposal_sent", "lost"],
  proposal_sent:  ["negotiation", "lost"],
  negotiation:    ["won", "lost"],
  won:            [],
  lost:           ["new"],
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// --- Assignment Enforcement ---

export function canModifyLead(
  lead: Pick<Lead, "assignedTo">,
  currentUserId: string | null,
  userRoles: string[]
): boolean {
  if (hasAnyRole(userRoles, ["owner"])) return true;
  if (hasAnyRole(userRoles, ["sales"])) {
    return !lead.assignedTo || lead.assignedTo === currentUserId;
  }
  return false;
}

// --- Helper: compute temperature from score ---

function computeTemperature(score: number): "hot" | "warm" | "cold" {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

// --- Helper: map Firestore doc to Lead ---

function mapDocToLead(id: string, data: any, activityLogs: any[] = []): Lead {
  const score = data.score ?? 0;
  return {
    id,
    tenantId: data.tenantId ?? "",
    name: data.name ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    city: data.city ?? undefined,
    stage: data.stage ?? "new",
    status: data.status ?? "active",
    source: data.source ?? "website",
    score,
    temperature: computeTemperature(score),
    estimatedValue: data.estimatedValue ?? 0,
    customerId: data.customerId ?? null,
    assignedTo: data.assignedTo ?? undefined,
    estimateId: data.estimateId ?? undefined,
    projectId: data.projectId ?? undefined,
    nextFollowUp: data.nextFollowUp ?? undefined,
    followUpCount: data.followUpCount ?? 0,
    lastContactedAt: data.lastContactedAt ?? undefined,
    lostReason: data.lostReason ?? undefined,
    notes: data.notes ?? undefined,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? undefined,
    timeline: activityLogs.map((e: any) => ({
      action: e.action ?? "",
      summary: e.summary ?? "",
      timestamp: e.createdAt ?? null,
      actorId: e.actorId ?? undefined,
    })),
  };
}

// --- Helper: compute stats from a leads array ---

function computeStats(mappedLeads: Lead[]): LeadStats {
  const total = mappedLeads.length;
  const wonCount = mappedLeads.filter((l) => l.stage === "won").length;
  return {
    total,
    new: mappedLeads.filter((l) => l.stage === "new").length,
    contacted: mappedLeads.filter((l) => l.stage === "contacted").length,
    qualified: mappedLeads.filter((l) => l.stage === "qualified").length,
    proposal_sent: mappedLeads.filter((l) => l.stage === "proposal_sent").length,
    negotiation: mappedLeads.filter((l) => l.stage === "negotiation").length,
    won: wonCount,
    lost: mappedLeads.filter((l) => l.stage === "lost").length,
    hotCount: mappedLeads.filter((l) => l.temperature === "hot").length,
    warmCount: mappedLeads.filter((l) => l.temperature === "warm").length,
    coldCount: mappedLeads.filter((l) => l.temperature === "cold").length,
    totalValue: mappedLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0),
    conversionRate: total > 0 ? Math.round((wonCount / total) * 100) : 0,
  };
}

const EMPTY_STATS: LeadStats = {
  total: 0,
  new: 0,
  contacted: 0,
  qualified: 0,
  proposal_sent: 0,
  negotiation: 0,
  won: 0,
  lost: 0,
  hotCount: 0,
  warmCount: 0,
  coldCount: 0,
  totalValue: 0,
  conversionRate: 0,
};

export function useLeads(tenantId: string | null) {
  const queryClient = useQueryClient();
  const qk = ["leads", tenantId] as const;
  const db = getDb();

  const leadsQuery = useMemo(() => {
    if (!tenantId) return null;
    return query(
      collection(db, `tenants/${tenantId}/leads`),
      orderBy("createdAt", "desc"),
      firestoreLimit(100)
    );
  }, [db, tenantId]);

  const { data: leads = [], isLoading: loading } = useFirestoreQuery<Lead>({
    queryKey: qk,
    collectionRef: leadsQuery!,
    mapDoc: (snap) => {
      const data = snap.data() || {};
      return mapDocToLead(snap.id, data);
    },
    enabled: !!tenantId && !!leadsQuery,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: qk }),
    [queryClient, qk]
  );

  // Derive stats from leads via useMemo
  const stats = useMemo<LeadStats>(() => {
    if (!leads || leads.length === 0) return EMPTY_STATS;
    return computeStats(leads);
  }, [leads]);

  // --- Score Recalculation Helper ---

  const recalculateScore = useCallback(async (lead: Lead) => {
    if (!tenantId) return;
    const input: LeadScoringInput = {
      totalAmount: lead.estimatedValue,
      stage: lead.stage,
      source: lead.source,
      email: lead.email,
      followUpCount: lead.followUpCount,
      createdAt: lead.createdAt,
      lastContactedAt: lead.lastContactedAt,
    };
    const { score } = calculateLeadScore(input);
    const db = getDb();
    await updateDoc(doc(db, `tenants/${tenantId}/leads`, lead.id), {
      score,
      updatedAt: serverTimestamp(),
    });
    invalidate();
  }, [tenantId, invalidate]);

  const updateLead = useCallback(
    async (
      leadId: string,
      updates: Partial<Lead>,
      currentUserId?: string | null,
      userRoles?: string[]
    ) => {
      if (!tenantId) return false;
      try {
        // Assignment enforcement when caller passes user context
        if (currentUserId !== undefined && userRoles) {
          const lead = leads.find((l) => l.id === leadId);
          if (lead && !canModifyLead(lead, currentUserId, userRoles)) return false;
        }

        // Fields that should never be written (read-only / computed)
        const readOnlyFields = new Set(["id", "timeline", "temperature", "tenantId"]);

        const dbUpdates: Record<string, any> = { updatedAt: serverTimestamp() };

        for (const [key, value] of Object.entries(updates)) {
          if (readOnlyFields.has(key)) continue;
          dbUpdates[key] = value;
        }

        const db = getDb();
        await updateDoc(doc(db, `tenants/${tenantId}/leads`, leadId), dbUpdates);
        invalidate();
        return true;
      } catch (error) {
        console.error("Error updating lead:", error);
        return false;
      }
    },
    [tenantId, leads, invalidate]
  );

  const addActivityLog = useCallback(
    async (
      leadId: string,
      action: "created" | "updated" | "deleted" | "status_changed" | "assigned" | "commented" | "uploaded" | "payment_recorded",
      summary: string,
      actorId?: string
    ) => {
      if (!tenantId) return false;
      try {
        const db = getDb();

        await addDoc(collection(db, `tenants/${tenantId}/leads/${leadId}/activityLog`), {
          action,
          summary,
          actorId: actorId || null,
          createdAt: serverTimestamp(),
        });

        // Also bump updatedAt on the lead
        await updateDoc(doc(db, `tenants/${tenantId}/leads`, leadId), {
          updatedAt: serverTimestamp(),
        });

        invalidate();
        return true;
      } catch (error) {
        console.error("Error adding activity log:", error);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  const assignLead = useCallback(
    async (leadId: string, userId: string) => {
      if (!tenantId) return false;
      try {
        const db = getDb();

        await updateDoc(doc(db, `tenants/${tenantId}/leads`, leadId), {
          assignedTo: userId,
          updatedAt: serverTimestamp(),
        });

        // Insert activity log
        await addDoc(collection(db, `tenants/${tenantId}/leads/${leadId}/activityLog`), {
          action: "assigned",
          summary: `Lead assigned to user ${userId}`,
          actorId: null,
          createdAt: serverTimestamp(),
        });

        // Recalculate score after assignment
        const lead = leads.find((l) => l.id === leadId);
        if (lead) {
          await recalculateScore(lead);
        }

        invalidate();
        return true;
      } catch (error) {
        console.error("Error assigning lead:", error);
        return false;
      }
    },
    [tenantId, leads, recalculateScore, invalidate]
  );

  const changeStage = useCallback(
    async (
      leadId: string,
      newStage: string,
      note?: string,
      currentUserId?: string | null,
      userRoles?: string[],
      tenantMeta?: { email?: string; businessName?: string }
    ) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return false;

      // Stage transition validation
      if (!isValidTransition(lead.stage, newStage)) return false;

      // Assignment enforcement (only when caller passes user context)
      if (currentUserId !== undefined && userRoles) {
        if (!canModifyLead(lead, currentUserId, userRoles)) return false;
        // Conversion to "won" is restricted to owner / project_manager
        if (newStage === "won" && !hasAnyRole(userRoles, ["owner", "project_manager"])) {
          return false;
        }
      }

      try {
        const db = getDb();

        const updates: Record<string, any> = {
          stage: newStage,
          updatedAt: serverTimestamp(),
        };

        if (newStage === "contacted" || newStage === "qualified") {
          updates.lastContactedAt = serverTimestamp();
        }

        if (newStage === "lost" && note) {
          updates.lostReason = note;
        }

        // Atomic: lead update + activity log
        const batch = writeBatch(db);
        batch.update(doc(db, `tenants/${tenantId}/leads`, leadId), updates);
        const logRef = doc(collection(db, `tenants/${tenantId}/leads/${leadId}/activityLog`));
        batch.set(logRef, {
          action: "status_changed",
          summary: `Stage changed to ${newStage}${note ? `: ${note}` : ""}`,
          actorId: currentUserId || null,
          createdAt: serverTimestamp(),
        });
        await batch.commit();

        // Double-conversion guard: skip createProjectFromLead if projectId exists
        if (newStage === "won" && tenantId && !lead.projectId) {
          try {
            await createProjectFromLead(lead, tenantId);

            // Fire-and-forget: notify owner and client of the conversion
            fetch("/api/send-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "lead_won",
                tenantId,
                tenantEmail: tenantMeta?.email ?? null,
                tenantBusinessName: tenantMeta?.businessName ?? null,
                leadName: lead.name,
                clientEmail: lead.email || null,
                phone: lead.phone || null,
                estimatedValue: lead.estimatedValue || 0,
              }),
            }).catch((err) => console.error("Lead won notification failed:", err));
          } catch (err) {
            console.error("Error creating project from lead:", err);
          }
        }

        // Recalculate score with new stage
        await recalculateScore({ ...lead, stage: newStage as Lead["stage"] });

        invalidate();
        return true;
      } catch (error) {
        console.error("Error changing stage:", error);
        return false;
      }
    },
    [tenantId, leads, recalculateScore, invalidate]
  );

  const createLead = useCallback(
    async (data: Omit<Lead, "id" | "createdAt" | "updatedAt" | "temperature" | "timeline">) => {
      if (!tenantId) return null;
      try {
        // Compute initial score (temperature is computed client-side from score)
        const input: LeadScoringInput = {
          totalAmount: data.estimatedValue,
          stage: data.stage,
          source: data.source,
          email: data.email,
          followUpCount: data.followUpCount,
          createdAt: null,
          lastContactedAt: null,
        };
        const { score } = calculateLeadScore(input);

        const db = getDb();

        const docRef = await addDoc(collection(db, `tenants/${tenantId}/leads`), {
          tenantId,
          name: data.name,
          email: data.email,
          phone: data.phone,
          city: data.city || null,
          stage: data.stage,
          source: data.source,
          score,
          estimatedValue: data.estimatedValue,
          estimateId: data.estimateId || null,
          assignedTo: data.assignedTo || null,
          nextFollowUp: data.nextFollowUp || null,
          followUpCount: data.followUpCount,
          lastContactedAt: data.lastContactedAt || null,
          projectId: data.projectId || null,
          lostReason: data.lostReason || null,
          notes: data.notes || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        invalidate();
        return docRef.id;
      } catch (error) {
        console.error("Error creating lead:", error);
        return null;
      }
    },
    [tenantId, invalidate]
  );

  return { leads, stats, loading, updateLead, addActivityLog, assignLead, changeStage, createLead, recalculateScore };
}
