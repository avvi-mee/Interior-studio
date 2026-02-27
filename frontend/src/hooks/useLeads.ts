"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { createProjectFromLead } from "@/lib/services/projectService";

export interface Lead {
  id: string;
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  city?: string;
  message?: string;
  projectType: string;
  basics: { plan: string; carpetArea: number; bedrooms: number; bathrooms: number };
  items: any[];
  totalAmount: number;
  estimateId?: string;
  stage: "new" | "contacted" | "qualified" | "proposal_sent" | "negotiation" | "approved" | "converted" | "lost";
  temperature: "hot" | "warm" | "cold";
  score: number;
  lostReason?: string;
  assignedTo?: string;
  assignedToName?: string;
  nextFollowUp?: any;
  followUpCount: number;
  lastContactedAt?: any;
  projectId?: string;
  source: "website_estimate" | "consultation" | "manual" | "referral";
  createdAt: any;
  updatedAt?: any;
  emailSent: boolean;
  timeline: Array<{
    action: string;
    timestamp: any;
    updatedBy?: string;
    note?: string;
  }>;
}

export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  approved: number;
  converted: number;
  lost: number;
  hotCount: number;
  warmCount: number;
  coldCount: number;
  totalValue: number;
  conversionRate: number;
}

export function useLeads(tenantId: string | null) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LeadStats>({
    total: 0,
    new: 0,
    contacted: 0,
    qualified: 0,
    approved: 0,
    converted: 0,
    lost: 0,
    hotCount: 0,
    warmCount: 0,
    coldCount: 0,
    totalValue: 0,
    conversionRate: 0,
  });

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const leadsRef = collection(db, "leads");
    const q = query(leadsRef, where("tenantId", "==", tenantId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const leadsData = snapshot.docs.map((d) => ({
          id: d.id,
          stage: "new",
          temperature: "warm",
          score: 0,
          followUpCount: 0,
          emailSent: false,
          timeline: [],
          source: "website_estimate",
          ...d.data(),
        })) as Lead[];

        leadsData.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return bTime - aTime;
        });

        setLeads(leadsData);

        const total = leadsData.length;
        const newCount = leadsData.filter((l) => l.stage === "new").length;
        const contactedCount = leadsData.filter((l) => l.stage === "contacted").length;
        const qualifiedCount = leadsData.filter((l) => l.stage === "qualified").length;
        const approvedCount = leadsData.filter((l) => l.stage === "approved").length;
        const convertedCount = leadsData.filter((l) => l.stage === "converted").length;
        const lostCount = leadsData.filter((l) => l.stage === "lost").length;
        const hotCount = leadsData.filter((l) => l.temperature === "hot").length;
        const warmCount = leadsData.filter((l) => l.temperature === "warm").length;
        const coldCount = leadsData.filter((l) => l.temperature === "cold").length;
        const totalValue = leadsData.reduce((sum, l) => sum + (l.totalAmount || 0), 0);
        const conversionRate = total > 0 ? Math.round((convertedCount / total) * 100) : 0;

        setStats({
          total,
          new: newCount,
          contacted: contactedCount,
          qualified: qualifiedCount,
          approved: approvedCount,
          converted: convertedCount,
          lost: lostCount,
          hotCount,
          warmCount,
          coldCount,
          totalValue,
          conversionRate,
        });

        setLoading(false);
      },
      (error) => {
        console.error("Error fetching leads:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tenantId]);

  const updateLead = useCallback(
    async (leadId: string, updates: Partial<Lead>) => {
      try {
        const leadRef = doc(db, "leads", leadId);
        await updateDoc(leadRef, { ...updates, updatedAt: serverTimestamp() });
        return true;
      } catch (error) {
        console.error("Error updating lead:", error);
        return false;
      }
    },
    []
  );

  const addTimelineEvent = useCallback(
    async (leadId: string, action: string, note?: string) => {
      try {
        const leadRef = doc(db, "leads", leadId);
        await updateDoc(leadRef, {
          timeline: arrayUnion({
            action,
            timestamp: Timestamp.now(),
            note: note || null,
          }),
          updatedAt: serverTimestamp(),
        });
        return true;
      } catch (error) {
        console.error("Error adding timeline event:", error);
        return false;
      }
    },
    []
  );

  const assignLead = useCallback(
    async (leadId: string, employeeId: string, employeeName: string) => {
      try {
        const leadRef = doc(db, "leads", leadId);
        await updateDoc(leadRef, {
          assignedTo: employeeId,
          assignedToName: employeeName,
          updatedAt: serverTimestamp(),
          timeline: arrayUnion({
            action: `Assigned to ${employeeName}`,
            timestamp: Timestamp.now(),
          }),
        });
        return true;
      } catch (error) {
        console.error("Error assigning lead:", error);
        return false;
      }
    },
    []
  );

  const changeStage = useCallback(
    async (leadId: string, newStage: string, note?: string) => {
      try {
        const leadRef = doc(db, "leads", leadId);
        const updates: any = {
          stage: newStage,
          updatedAt: serverTimestamp(),
          timeline: arrayUnion({
            action: `Stage changed to ${newStage}`,
            timestamp: Timestamp.now(),
            note: note || null,
          }),
        };

        if (newStage === "contacted" || newStage === "qualified") {
          updates.lastContactedAt = serverTimestamp();
        }

        await updateDoc(leadRef, updates);

        // If approved, create project
        if (newStage === "approved" && tenantId) {
          const lead = leads.find((l) => l.id === leadId);
          if (lead) {
            try {
              await createProjectFromLead(lead, tenantId);
            } catch (err) {
              console.error("Error creating project from lead:", err);
            }
          }
        }

        return true;
      } catch (error) {
        console.error("Error changing stage:", error);
        return false;
      }
    },
    [tenantId, leads]
  );

  return { leads, stats, loading, updateLead, addTimelineEvent, assignLead, changeStage };
}
