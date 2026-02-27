"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import {
  DateRange,
  groupByTimeBucket,
  groupByMonth,
} from "@/lib/analyticsHelpers";

// ── Interfaces ──────────────────────────────────────────────

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

// ── Computation Functions ───────────────────────────────────

const FUNNEL_STAGES = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "negotiation",
  "approved",
  "converted",
  "lost",
];

function computeSalesAnalytics(
  estimates: any[],
  dateRange: DateRange
): SalesAnalytics {
  const totalLeads = estimates.length;

  // Funnel
  const stageCounts = new Map<string, number>();
  for (const s of FUNNEL_STAGES) stageCounts.set(s, 0);
  for (const e of estimates) {
    const stage = e.stage || "new";
    stageCounts.set(stage, (stageCounts.get(stage) || 0) + 1);
  }
  const funnelData = FUNNEL_STAGES.map((stage) => ({
    stage,
    count: stageCounts.get(stage) || 0,
  }));

  const convertedLeads = stageCounts.get("converted") || 0;
  const lostLeads = stageCounts.get("lost") || 0;
  const conversionRate =
    totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  // Temperature
  let hot = 0, warm = 0, cold = 0;
  for (const e of estimates) {
    const temp = e.temperature || "warm";
    if (temp === "hot") hot++;
    else if (temp === "cold") cold++;
    else warm++;
  }

  // Avg score
  let totalScore = 0;
  let scoreCount = 0;
  for (const e of estimates) {
    if (e.score != null && e.score > 0) {
      totalScore += e.score;
      scoreCount++;
    }
  }
  const avgLeadScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

  // Avg conversion time
  let totalConversionDays = 0;
  let conversionCount = 0;
  for (const e of estimates) {
    if (e.stage === "converted" && e.createdAt) {
      const createdMs = e.createdAt?.toMillis
        ? e.createdAt.toMillis()
        : e.createdAt instanceof Date
        ? e.createdAt.getTime()
        : null;
      if (!createdMs) continue;

      // Look for conversion event in timeline
      let convertedMs: number | null = null;
      if (e.timeline && Array.isArray(e.timeline)) {
        for (const event of e.timeline) {
          const action = (event.action || "").toLowerCase();
          if (
            action.includes("converted") ||
            action.includes("stage changed to converted")
          ) {
            convertedMs = event.timestamp?.toMillis
              ? event.timestamp.toMillis()
              : event.timestamp instanceof Date
              ? event.timestamp.getTime()
              : null;
            break;
          }
        }
      }

      if (convertedMs) {
        const days = Math.ceil((convertedMs - createdMs) / 86400000);
        totalConversionDays += days;
        conversionCount++;
      }
    }
  }
  const avgConversionTimeDays =
    conversionCount > 0 ? Math.round(totalConversionDays / conversionCount) : 0;

  // Pipeline value
  const totalPipelineValue = estimates
    .filter((e) => e.stage !== "lost" && e.stage !== "converted")
    .reduce((sum, e) => sum + (e.totalAmount || e.estimatedAmount || 0), 0);

  // Leads over time
  const leadsOverTime = groupByTimeBucket(estimates, dateRange);

  // Source breakdown
  const sourceCounts = new Map<string, number>();
  for (const e of estimates) {
    const source = e.source || "Unknown";
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
  }
  const sourceBreakdown = Array.from(sourceCounts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalLeads,
    convertedLeads,
    conversionRate,
    lostLeads,
    temperatureDistribution: { hot, warm, cold },
    avgLeadScore,
    avgConversionTimeDays,
    totalPipelineValue,
    funnelData,
    leadsOverTime,
    sourceBreakdown,
  };
}

function computeProjectAnalytics(projects: any[]): ProjectAnalytics {
  const activeProjects = projects.filter(
    (p) => p.status === "planning" || p.status === "in_progress"
  ).length;
  const completedProjects = projects.filter(
    (p) => p.status === "completed"
  ).length;
  const delayedProjects = projects.filter(
    (p) => p.healthStatus === "delayed"
  ).length;
  const onTrackCount = projects.filter(
    (p) =>
      p.healthStatus === "on_track" &&
      (p.status === "planning" || p.status === "in_progress")
  ).length;
  const onTrackPercent =
    activeProjects > 0 ? Math.round((onTrackCount / activeProjects) * 100) : 0;

  // Avg completion time
  let totalDays = 0;
  let completedCount = 0;
  for (const p of projects) {
    if (p.completedDate && p.createdAt) {
      const createdMs = p.createdAt?.toMillis
        ? p.createdAt.toMillis()
        : p.createdAt instanceof Date
        ? p.createdAt.getTime()
        : null;
      const completedMs = p.completedDate?.toMillis
        ? p.completedDate.toMillis()
        : p.completedDate instanceof Date
        ? p.completedDate.getTime()
        : null;
      if (createdMs && completedMs) {
        totalDays += Math.ceil((completedMs - createdMs) / 86400000);
        completedCount++;
      }
    }
  }
  const avgCompletionTimeDays =
    completedCount > 0 ? Math.round(totalDays / completedCount) : 0;

  const totalProjectValue = projects.reduce(
    (sum, p) => sum + (p.totalAmount || 0),
    0
  );

  // Stage distribution
  const statusCounts = new Map<string, number>();
  for (const p of projects) {
    const status = p.status || "unknown";
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  }
  const stageDistribution = Array.from(statusCounts.entries()).map(
    ([status, count]) => ({ status, count })
  );

  // Health distribution
  const healthCounts = new Map<string, number>();
  for (const p of projects) {
    const health = p.healthStatus || "unknown";
    healthCounts.set(health, (healthCounts.get(health) || 0) + 1);
  }
  const healthDistribution = Array.from(healthCounts.entries()).map(
    ([health, count]) => ({ health, count })
  );

  return {
    activeProjects,
    completedProjects,
    delayedProjects,
    onTrackPercent,
    avgCompletionTimeDays,
    totalProjectValue,
    stageDistribution,
    healthDistribution,
  };
}

function computeAgingBucket(
  items: Array<{ amount: number; paidAmount: number; dueDate: any; status: string }>
): AgingBucket {
  const bucket: AgingBucket = { current: 0, thirtyOne: 0, sixtyOne: 0, ninetyPlus: 0 };
  const now = Date.now();
  for (const item of items) {
    const outstanding = (item.amount || 0) - (item.paidAmount || 0);
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
    if (daysOverdue <= 30) bucket.current += outstanding;
    else if (daysOverdue <= 60) bucket.thirtyOne += outstanding;
    else if (daysOverdue <= 90) bucket.sixtyOne += outstanding;
    else bucket.ninetyPlus += outstanding;
  }
  return bucket;
}

function computeFinancialAnalytics(
  invoices: any[],
  vendorBills: any[]
): FinancialAnalytics {
  const totalInvoiced = invoices.reduce((s, i) => s + (i.amount || 0), 0);
  const totalReceived = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
  const outstanding = totalInvoiced - totalReceived;
  const now = Date.now();
  const overdue = invoices
    .filter((i) => {
      if (i.status === "paid") return false;
      const dueMs = i.dueDate?.toMillis
        ? i.dueDate.toMillis()
        : i.dueDate instanceof Date
        ? i.dueDate.getTime()
        : null;
      return dueMs && dueMs < now;
    })
    .reduce((s, i) => s + ((i.amount || 0) - (i.paidAmount || 0)), 0);

  const totalExpenses = vendorBills.reduce((s, b) => s + (b.amount || 0), 0);
  const totalPaidToVendors = vendorBills.reduce(
    (s, b) => s + (b.paidAmount || 0),
    0
  );
  const netCashflow = totalReceived - totalPaidToVendors;

  // Revenue trend by month
  const invoicesByMonth = groupByMonth(
    invoices.map((i) => ({
      createdAt: i.createdAt,
      invoiced: i.amount || 0,
      received: i.paidAmount || 0,
    })),
    ["invoiced", "received"]
  ) as Array<{ month: string; invoiced: number; received: number }>;

  // Expense trend by month
  const expensesByMonth = groupByMonth(
    vendorBills.map((b) => ({
      createdAt: b.createdAt,
      billed: b.amount || 0,
      paid: b.paidAmount || 0,
    })),
    ["billed", "paid"]
  ) as Array<{ month: string; billed: number; paid: number }>;

  return {
    totalInvoiced,
    totalReceived,
    outstanding,
    overdue,
    totalExpenses,
    totalPaidToVendors,
    netCashflow,
    revenueTrend: invoicesByMonth,
    expenseTrend: expensesByMonth,
    receivableAging: computeAgingBucket(invoices),
    payableAging: computeAgingBucket(vendorBills),
  };
}

function computeEmployeePerformance(
  employees: any[],
  estimates: any[],
  projects: any[]
): EmployeeMetrics[] {
  return employees
    .filter((emp) => emp.isActive !== false)
    .map((emp) => {
      // Sales metrics
      const empEstimates = estimates.filter((e) => e.assignedTo === emp.id);
      const assignedLeads = empEstimates.length;
      const convertedLeads = empEstimates.filter(
        (e) => e.stage === "converted"
      ).length;
      const conversionRate =
        assignedLeads > 0
          ? Math.round((convertedLeads / assignedLeads) * 100)
          : 0;

      // Avg response time (createdAt to lastContactedAt)
      let totalResponseHours = 0;
      let responseCount = 0;
      for (const e of empEstimates) {
        if (e.lastContactedAt && e.createdAt) {
          const createdMs = e.createdAt?.toMillis
            ? e.createdAt.toMillis()
            : null;
          const contactedMs = e.lastContactedAt?.toMillis
            ? e.lastContactedAt.toMillis()
            : null;
          if (createdMs && contactedMs && contactedMs > createdMs) {
            totalResponseHours += (contactedMs - createdMs) / 3600000;
            responseCount++;
          }
        }
      }
      const avgResponseTimeHours =
        responseCount > 0
          ? Math.round(totalResponseHours / responseCount)
          : 0;

      // Project tasks
      let tasksCompleted = 0;
      let overdueTasks = 0;
      const now = Date.now();
      const empProjects = projects.filter((p) => p.assignedTo === emp.id);

      for (const project of projects) {
        if (project.phases && Array.isArray(project.phases)) {
          for (const phase of project.phases) {
            if (phase.tasks && Array.isArray(phase.tasks)) {
              for (const task of phase.tasks) {
                if (task.assignedTo === emp.id) {
                  if (task.status === "completed" || task.completed) {
                    tasksCompleted++;
                  }
                  if (task.dueDate) {
                    const dueMs = task.dueDate?.toMillis
                      ? task.dueDate.toMillis()
                      : null;
                    if (
                      dueMs &&
                      dueMs < now &&
                      task.status !== "completed" &&
                      !task.completed
                    ) {
                      overdueTasks++;
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Execution completion (for supervisors / project leads)
      let totalPhaseCompletion = 0;
      let phaseCount = 0;
      for (const p of empProjects) {
        if (p.projectProgress != null) {
          totalPhaseCompletion += p.projectProgress;
          phaseCount++;
        }
      }
      const executionCompletionPercent =
        phaseCount > 0 ? Math.round(totalPhaseCompletion / phaseCount) : 0;

      return {
        id: emp.id,
        name: emp.name || "Unknown",
        role: emp.role || "employee",
        assignedLeads,
        convertedLeads,
        conversionRate,
        avgResponseTimeHours,
        tasksCompleted,
        overdueTasks,
        activeProjects: empProjects.filter(
          (p) => p.status === "planning" || p.status === "in_progress"
        ).length,
        executionCompletionPercent,
      };
    });
}

// ── Hook ────────────────────────────────────────────────────

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
};

const emptyFinancial: FinancialAnalytics = {
  totalInvoiced: 0, totalReceived: 0, outstanding: 0, overdue: 0,
  totalExpenses: 0, totalPaidToVendors: 0, netCashflow: 0,
  revenueTrend: [], expenseTrend: [],
  receivableAging: { current: 0, thirtyOne: 0, sixtyOne: 0, ninetyPlus: 0 },
  payableAging: { current: 0, thirtyOne: 0, sixtyOne: 0, ninetyPlus: 0 },
};

export function useAnalytics(
  tenantId: string | null,
  dateRange: DateRange
): AnalyticsData {
  const [sales, setSales] = useState<SalesAnalytics>(emptySales);
  const [projects, setProjects] = useState<ProjectAnalytics>(emptyProjects);
  const [financial, setFinancial] = useState<FinancialAnalytics>(emptyFinancial);
  const [employees, setEmployees] = useState<EmployeeMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const startTs = Timestamp.fromDate(dateRange.start);
        const endTs = Timestamp.fromDate(dateRange.end);

        const [
          estimatesSnap,
          projectsSnap,
          employeesSnap,
          invoicesSnap,
          vendorBillsSnap,
        ] = await Promise.all([
          getDocs(
            query(
              collection(db, `tenants/${tenantId}/estimates`),
              where("createdAt", ">=", startTs),
              where("createdAt", "<=", endTs)
            )
          ),
          getDocs(
            query(
              collection(db, `tenants/${tenantId}/projects`),
              where("createdAt", ">=", startTs),
              where("createdAt", "<=", endTs)
            )
          ),
          getDocs(collection(db, `tenants/${tenantId}/employees`)),
          getDocs(
            query(
              collection(db, `tenants/${tenantId}/invoices`),
              where("createdAt", ">=", startTs),
              where("createdAt", "<=", endTs)
            )
          ),
          getDocs(
            query(
              collection(db, `tenants/${tenantId}/vendorBills`),
              where("createdAt", ">=", startTs),
              where("createdAt", "<=", endTs)
            )
          ),
        ]);

        if (cancelled) return;

        const estimatesDocs = estimatesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        const projectsDocs = projectsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        const employeesDocs = employeesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        const invoicesDocs = invoicesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        const vendorBillsDocs = vendorBillsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setSales(computeSalesAnalytics(estimatesDocs, dateRange));
        setProjects(computeProjectAnalytics(projectsDocs));
        setFinancial(computeFinancialAnalytics(invoicesDocs, vendorBillsDocs));
        setEmployees(
          computeEmployeePerformance(employeesDocs, estimatesDocs, projectsDocs)
        );
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          console.error("Analytics fetch error:", err);
          setError(err.message || "Failed to fetch analytics");
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [tenantId, dateRange.start.getTime(), dateRange.end.getTime(), fetchKey]);

  return { sales, projects, financial, employees, loading, error, refetch };
}
