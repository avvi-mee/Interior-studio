"use client";

import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, limit as firestoreLimit } from "firebase/firestore";
import { DateRange, groupByTimeBucket, groupByMonth } from "@/lib/analyticsHelpers";
import { computeAgingBucket } from "@/lib/services/invoiceService";

// -- Interfaces --

export interface SalesAnalytics {
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  lostLeads: number;
  temperatureDistribution: { hot: number; warm: number; cold: number };
  avgLeadScore: number;
  avgConversionTimeDays: number;
  totalPipelineValue: number;
  funnelData: Array<{ stage: string; count: number }>;
  leadsOverTime: Array<{ date: string; count: number }>;
  sourceBreakdown: Array<{ source: string; count: number }>;
}

export interface ProjectAnalytics {
  activeProjects: number;
  completedProjects: number;
  delayedProjects: number;
  onTrackPercent: number;
  avgCompletionTimeDays: number;
  totalProjectValue: number;
  stageDistribution: Array<{ status: string; count: number }>;
  healthDistribution: Array<{ health: string; count: number }>;
  avgProjectProgress: number;
}

export interface FinancialAnalytics {
  totalInvoiced: number;
  totalReceived: number;
  outstanding: number;
  overdue: number;
  totalExpenses: number;
  totalPaidToVendors: number;
  netCashflow: number;
  revenueTrend: Array<{ month: string; invoiced: number; received: number }>;
  expenseTrend: Array<{ month: string; billed: number; paid: number }>;
  receivableAging: AgingBucket;
  payableAging: AgingBucket;
  collectionRate: number;
}

export interface AgingBucket {
  current: number;
  thirtyOne: number;
  sixtyOne: number;
  ninetyPlus: number;
}

export interface EmployeeMetrics {
  id: string;
  name: string;
  role: string;
  assignedLeads: number;
  convertedLeads: number;
  conversionRate: number;
  avgResponseTimeHours: number;
  tasksCompleted: number;
  overdueTasks: number;
  activeProjects: number;
  executionCompletionPercent: number;
}

export interface AnalyticsData {
  sales: SalesAnalytics;
  projects: ProjectAnalytics;
  financial: FinancialAnalytics;
  employees: EmployeeMetrics[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// -- Defaults --

const emptySales: SalesAnalytics = {
  totalLeads: 0, convertedLeads: 0, conversionRate: 0, lostLeads: 0,
  temperatureDistribution: { hot: 0, warm: 0, cold: 0 },
  avgLeadScore: 0, avgConversionTimeDays: 0, totalPipelineValue: 0,
  funnelData: [], leadsOverTime: [], sourceBreakdown: [],
};

const emptyProjects: ProjectAnalytics = {
  activeProjects: 0, completedProjects: 0, delayedProjects: 0,
  onTrackPercent: 0, avgCompletionTimeDays: 0, totalProjectValue: 0,
  stageDistribution: [], healthDistribution: [],
  avgProjectProgress: 0,
};

const emptyFinancial: FinancialAnalytics = {
  totalInvoiced: 0, totalReceived: 0, outstanding: 0, overdue: 0,
  totalExpenses: 0, totalPaidToVendors: 0, netCashflow: 0,
  revenueTrend: [], expenseTrend: [],
  receivableAging: { current: 0, thirtyOne: 0, sixtyOne: 0, ninetyPlus: 0 },
  payableAging: { current: 0, thirtyOne: 0, sixtyOne: 0, ninetyPlus: 0 },
  collectionRate: 0,
};

const FUNNEL_STAGES = [
  "new", "contacted", "qualified", "proposal_sent", "negotiation", "won", "lost",
];

// -- Helpers --

function toMs(val: any): number {
  if (!val) return 0;
  if (typeof val === "string") return new Date(val).getTime();
  if (val instanceof Date) return val.getTime();
  if (typeof val?.toMillis === "function") return val.toMillis();
  return 0;
}

function computeTemp(score: number): "hot" | "warm" | "cold" {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

// -- Internal data shape --

interface AnalyticsRawData {
  sales: SalesAnalytics;
  projects: ProjectAnalytics;
  financial: FinancialAnalytics;
  employees: EmployeeMetrics[];
}

// -- Hook --

export function useAnalytics(
  tenantId: string | null,
  dateRange: DateRange
): AnalyticsData {
  const queryClient = useQueryClient();
  const startMs = dateRange.start.getTime();
  const endMs = dateRange.end.getTime();
  const qk = ["analytics", tenantId, startMs, endMs] as const;

  const { data, isLoading: loading, error: queryError } = useQuery<AnalyticsRawData>({
    queryKey: qk,
    queryFn: async () => {
      const db = getDb();
      const startIso = dateRange.start.toISOString();
      const endIso = dateRange.end.toISOString();

      // Fetch collections with date filters pushed to Firestore — avoids full collection scans
      const [leadsSnap, projectsSnap, invoicesSnap, vendorBillsSnap, employeesSnap] = await Promise.all([
        getDocs(query(
          collection(db, `tenants/${tenantId}/leads`),
          where("createdAt", ">=", startIso),
          where("createdAt", "<=", endIso),
          orderBy("createdAt", "desc"),
          firestoreLimit(2000)
        )),
        getDocs(query(
          collection(db, `tenants/${tenantId}/projects`),
          where("createdAt", ">=", startIso),
          where("createdAt", "<=", endIso),
          orderBy("createdAt", "desc"),
          firestoreLimit(2000)
        )),
        getDocs(query(
          collection(db, `tenants/${tenantId}/invoices`),
          where("createdAt", ">=", startIso),
          where("createdAt", "<=", endIso),
          orderBy("createdAt", "desc"),
          firestoreLimit(2000)
        )),
        getDocs(query(
          collection(db, `tenants/${tenantId}/vendorBills`),
          where("createdAt", ">=", startIso),
          where("createdAt", "<=", endIso),
          orderBy("createdAt", "desc"),
          firestoreLimit(2000)
        )),
        getDocs(query(
          collection(db, `tenants/${tenantId}/employees`),
          firestoreLimit(200)
        )),
      ]);

      const leads = leadsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const projects = projectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const invoices = invoicesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const vendorBills = vendorBillsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const rawEmployees = employeesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // -- Sales Analytics --
      const totalLeads = leads.length;
      const wonLeads = leads.filter((l: any) => l.stage === "won");
      const lostLeads = leads.filter((l: any) => l.stage === "lost");
      const scores = leads.map((l: any) => l.score || 0);
      const avgScore = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
      const pipelineValue = leads
        .filter((l: any) => l.stage !== "won" && l.stage !== "lost")
        .reduce((sum: number, l: any) => sum + (Number(l.estimatedValue) || 0), 0);

      const temps = { hot: 0, warm: 0, cold: 0 };
      for (const l of leads) {
        const t = computeTemp((l as any).score || 0);
        temps[t]++;
      }

      const funnelMap = new Map<string, number>();
      for (const l of leads) {
        const stage = (l as any).stage || "new";
        funnelMap.set(stage, (funnelMap.get(stage) || 0) + 1);
      }
      const funnelData = FUNNEL_STAGES.map((stage) => ({
        stage,
        count: funnelMap.get(stage) || 0,
      }));

      const sourceMap = new Map<string, number>();
      for (const l of leads) {
        const src = (l as any).source || "other";
        sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
      }
      const sourceBreakdown = Array.from(sourceMap.entries()).map(([source, count]) => ({
        source,
        count,
      }));

      const leadsOverTime = groupByTimeBucket(
        leads.map((l: any) => ({ createdAt: l.createdAt })),
        dateRange
      );

      const sales: SalesAnalytics = {
        totalLeads,
        convertedLeads: wonLeads.length,
        conversionRate: totalLeads > 0 ? Math.round((wonLeads.length / totalLeads) * 100) : 0,
        lostLeads: lostLeads.length,
        temperatureDistribution: temps,
        avgLeadScore: Math.round(avgScore),
        avgConversionTimeDays: 0,
        totalPipelineValue: pipelineValue,
        funnelData,
        leadsOverTime,
        sourceBreakdown,
      };

      // -- Project Analytics --
      const activeProjects = projects.filter((p: any) => p.status === "in_progress").length;
      const completedProjects = projects.filter((p: any) => p.status === "completed").length;
      const totalProjectValue = projects.reduce((sum: number, p: any) => sum + (Number(p.contractValue) || 0), 0);
      const progresses = projects.map((p: any) => Number(p.progress) || 0);
      const avgProgress = progresses.length > 0 ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length) : 0;

      const statusMap = new Map<string, number>();
      for (const p of projects) {
        const s = (p as any).status || "planning";
        statusMap.set(s, (statusMap.get(s) || 0) + 1);
      }
      const stageDistribution = Array.from(statusMap.entries()).map(([status, count]) => ({
        status,
        count,
      }));

      const projectsAnalytics: ProjectAnalytics = {
        activeProjects,
        completedProjects,
        delayedProjects: 0,
        onTrackPercent: activeProjects > 0 ? 100 : 0,
        avgCompletionTimeDays: 0,
        totalProjectValue,
        stageDistribution,
        healthDistribution: [],
        avgProjectProgress: avgProgress,
      };

      // -- Financial Analytics --
      const totalInvoiced = invoices.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0);
      const totalReceived = invoices.reduce((sum: number, i: any) => sum + (Number(i.paidAmount) || 0), 0);
      const outstanding = totalInvoiced - totalReceived;
      const overdueAmount = invoices
        .filter((i: any) => {
          if (i.status === "paid") return false;
          const dueMs = toMs(i.dueDate);
          return dueMs > 0 && dueMs < Date.now();
        })
        .reduce((sum: number, i: any) => sum + ((Number(i.amount) || 0) - (Number(i.paidAmount) || 0)), 0);

      const totalExpenses = vendorBills.reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0);
      const totalPaidToVendors = vendorBills.reduce((sum: number, b: any) => sum + (Number(b.paidAmount) || 0), 0);

      // Aging buckets
      const receivableAging: AgingBucket = { current: 0, thirtyOne: 0, sixtyOne: 0, ninetyPlus: 0 };
      for (const inv of invoices) {
        if ((inv as any).status === "paid") continue;
        const balance = (Number((inv as any).amount) || 0) - (Number((inv as any).paidAmount) || 0);
        if (balance <= 0) continue;
        const bucket = computeAgingBucket((inv as any).dueDate);
        switch (bucket) {
          case "current": receivableAging.current += balance; break;
          case "31-60": receivableAging.thirtyOne += balance; break;
          case "61-90": receivableAging.sixtyOne += balance; break;
          case "90+": receivableAging.ninetyPlus += balance; break;
        }
      }

      const payableAging: AgingBucket = { current: 0, thirtyOne: 0, sixtyOne: 0, ninetyPlus: 0 };
      for (const bill of vendorBills) {
        if ((bill as any).status === "paid") continue;
        const balance = (Number((bill as any).amount) || 0) - (Number((bill as any).paidAmount) || 0);
        if (balance <= 0) continue;
        const bucket = computeAgingBucket((bill as any).dueDate);
        switch (bucket) {
          case "current": payableAging.current += balance; break;
          case "31-60": payableAging.thirtyOne += balance; break;
          case "61-90": payableAging.sixtyOne += balance; break;
          case "90+": payableAging.ninetyPlus += balance; break;
        }
      }

      const revenueTrend = groupByMonth(
        invoices.map((i: any) => ({
          createdAt: i.createdAt,
          invoiced: Number(i.amount) || 0,
          received: Number(i.paidAmount) || 0,
        })),
        ["invoiced", "received"]
      ) as Array<{ month: string; invoiced: number; received: number }>;

      const expenseTrend = groupByMonth(
        vendorBills.map((b: any) => ({
          createdAt: b.createdAt,
          billed: Number(b.amount) || 0,
          paid: Number(b.paidAmount) || 0,
        })),
        ["billed", "paid"]
      ) as Array<{ month: string; billed: number; paid: number }>;

      const financial: FinancialAnalytics = {
        totalInvoiced,
        totalReceived,
        outstanding,
        overdue: overdueAmount,
        totalExpenses,
        totalPaidToVendors,
        netCashflow: totalReceived - totalPaidToVendors,
        revenueTrend,
        expenseTrend,
        receivableAging,
        payableAging,
        collectionRate: totalInvoiced > 0 ? Math.round((totalReceived / totalInvoiced) * 100) : 0,
      };

      // -- Employee Metrics --
      const employees: EmployeeMetrics[] = rawEmployees
        .filter((e: any) => e.isActive !== false)
        .map((emp: any) => {
          const empId = emp.id;
          const assigned = leads.filter((l: any) => l.assignedTo === empId);
          const won = assigned.filter((l: any) => l.stage === "won");

          return {
            id: empId,
            name: emp.fullName || emp.name || "Unknown",
            role: (emp.roles && emp.roles[0]) || emp.role || "member",
            assignedLeads: assigned.length,
            convertedLeads: won.length,
            conversionRate: assigned.length > 0 ? Math.round((won.length / assigned.length) * 100) : 0,
            avgResponseTimeHours: 0,
            tasksCompleted: 0,
            overdueTasks: 0,
            activeProjects: 0,
            executionCompletionPercent: 0,
          };
        });

      return { sales, projects: projectsAnalytics, financial, employees };
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const refetch = useCallback(
    () => queryClient.invalidateQueries({ queryKey: qk }),
    [queryClient, qk]
  );

  return {
    sales: data?.sales ?? emptySales,
    projects: data?.projects ?? emptyProjects,
    financial: data?.financial ?? emptyFinancial,
    employees: data?.employees ?? [],
    loading,
    error: queryError ? (queryError as Error).message : null,
    refetch,
  };
}
