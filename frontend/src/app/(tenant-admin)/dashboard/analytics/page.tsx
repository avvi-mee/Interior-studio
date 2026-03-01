"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAnalytics } from "@/hooks/useAnalytics";
import {
  TimePreset,
  DateRange,
  getDateRangeForPreset,
  formatCurrency,
} from "@/lib/analyticsHelpers";
import TimeFilter from "@/components/analytics/TimeFilter";
import SalesFunnel from "@/components/analytics/charts/SalesFunnel";
import DistributionPie from "@/components/analytics/charts/DistributionPie";
import TrendLine from "@/components/analytics/charts/TrendLine";
import DistributionBar from "@/components/analytics/charts/DistributionBar";
import AgingChart from "@/components/analytics/charts/AgingChart";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Briefcase,
  IndianRupee,
  Target,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ShieldAlert,
} from "lucide-react";

export default function AnalyticsPage() {
  const { tenant, isAuthenticated, loading: authLoading } = useTenantAuth();
  const currentUser = useCurrentUser();
  const router = useRouter();

  const [preset, setPreset] = useState<TimePreset>("this_month");
  const [dateRange, setDateRange] = useState<DateRange>(
    getDateRangeForPreset("this_month")
  );

  const { sales, projects, financial, employees, loading, error } =
    useAnalytics(tenant?.id || null, dateRange);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleTimeChange = (newPreset: TimePreset, newRange: DateRange) => {
    setPreset(newPreset);
    setDateRange(newRange);
  };

  if (!currentUser.loading && !currentUser.can("view_analytics")) {
    return (
      <div className="p-12 text-center">
        <ShieldAlert className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
        <p className="text-sm text-gray-500 mt-1">You don&apos;t have permission to view analytics.</p>
        <p className="text-xs text-gray-400 mt-2">Contact your admin to request access.</p>
      </div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-indigo mx-auto mb-4"></div>
          <div className="text-sm text-muted-foreground">Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (!tenant) return null;

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-4" />
          <div className="text-sm text-red-500">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground">
            Track performance across sales, projects, finances, and team.
          </p>
        </div>
        <TimeFilter
          value={preset}
          dateRange={dateRange}
          onChange={handleTimeChange}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sales">
        <TabsList className="grid w-full grid-cols-4 max-w-md">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        {/* ─── Sales Tab ─── */}
        <TabsContent value="sales" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              label="Total Leads"
              value={sales.totalLeads}
              icon={<Target className="h-5 w-5 text-gray-300" />}
            />
            <KPICard
              label="Converted Leads"
              value={sales.convertedLeads}
              icon={<CheckCircle className="h-5 w-5 text-green-300" />}
            />
            <KPICard
              label="Conversion Rate"
              value={`${sales.conversionRate}%`}
              icon={<TrendingUp className="h-5 w-5 text-blue-300" />}
            />
            <KPICard
              label="Pipeline Value"
              value={formatCurrency(sales.totalPipelineValue)}
              icon={<IndianRupee className="h-5 w-5 text-gray-300" />}
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid gap-4 md:grid-cols-3">
            <KPICard
              label="Avg Lead Score"
              value={sales.avgLeadScore}
              icon={<Target className="h-5 w-5 text-gray-300" />}
            />
            <KPICard
              label="Avg Conversion Time"
              value={`${sales.avgConversionTimeDays} days`}
              icon={<Clock className="h-5 w-5 text-gray-300" />}
            />
            <KPICard
              label="Lost Leads"
              value={sales.lostLeads}
              icon={<XCircle className="h-5 w-5 text-red-300" />}
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Sales Funnel">
              <SalesFunnel data={sales.funnelData} />
            </ChartCard>
            <ChartCard title="Lead Temperature">
              <DistributionPie
                data={[
                  {
                    name: "Hot",
                    value: sales.temperatureDistribution.hot,
                    color: "#EF4444",
                  },
                  {
                    name: "Warm",
                    value: sales.temperatureDistribution.warm,
                    color: "#F59E0B",
                  },
                  {
                    name: "Cold",
                    value: sales.temperatureDistribution.cold,
                    color: "#3B82F6",
                  },
                ]}
              />
            </ChartCard>
          </div>

          {/* Leads Over Time */}
          <ChartCard title="Leads Over Time">
            <TrendLine
              data={sales.leadsOverTime}
              xKey="date"
              lines={[{ key: "count", color: "#3B82F6", name: "Leads" }]}
            />
          </ChartCard>

          {/* Source Breakdown */}
          <ChartCard title="Lead Source Breakdown">
            <DistributionBar
              data={sales.sourceBreakdown.map((s, i) => ({
                label: formatSourceLabel(s.source),
                value: s.count,
                color: SOURCE_COLORS[i % SOURCE_COLORS.length],
              }))}
            />
          </ChartCard>
        </TabsContent>

        {/* ─── Projects Tab ─── */}
        <TabsContent value="projects" className="space-y-6 mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <KPICard
              label="Active Projects"
              value={projects.activeProjects}
              icon={<Briefcase className="h-5 w-5 text-blue-300" />}
            />
            <KPICard
              label="Completed"
              value={projects.completedProjects}
              icon={<CheckCircle className="h-5 w-5 text-green-300" />}
            />
            <KPICard
              label="Delayed"
              value={projects.delayedProjects}
              icon={<AlertCircle className="h-5 w-5 text-red-300" />}
              danger={projects.delayedProjects > 0}
            />
            <KPICard
              label="On-track"
              value={`${projects.onTrackPercent}%`}
              icon={<TrendingUp className="h-5 w-5 text-green-300" />}
            />
            <KPICard
              label="Avg Progress"
              value={`${projects.avgProjectProgress}%`}
              icon={<Target className="h-5 w-5 text-blue-300" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <KPICard
              label="Avg Completion Time"
              value={`${projects.avgCompletionTimeDays} days`}
              icon={<Clock className="h-5 w-5 text-gray-300" />}
            />
            <KPICard
              label="Total Project Value"
              value={formatCurrency(projects.totalProjectValue)}
              icon={<IndianRupee className="h-5 w-5 text-gray-300" />}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Stage Distribution">
              <DistributionBar
                data={projects.stageDistribution.map((s) => ({
                  label: formatStatusLabel(s.status),
                  value: s.count,
                  color: STATUS_COLORS[s.status] || "#94A3B8",
                }))}
              />
            </ChartCard>
            <ChartCard title="Health Distribution">
              <DistributionPie
                data={projects.healthDistribution.map((h) => ({
                  name: formatHealthLabel(h.health),
                  value: h.count,
                  color: HEALTH_COLORS[h.health] || "#94A3B8",
                }))}
              />
            </ChartCard>
          </div>
        </TabsContent>

        {/* ─── Financial Tab ─── */}
        <TabsContent value="financial" className="space-y-6 mt-6">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
            <KPICard
              label="Total Invoiced"
              value={formatCurrency(financial.totalInvoiced)}
              icon={<IndianRupee className="h-5 w-5 text-gray-300" />}
            />
            <KPICard
              label="Total Received"
              value={formatCurrency(financial.totalReceived)}
              icon={<TrendingUp className="h-5 w-5 text-green-300" />}
            />
            <KPICard
              label="Outstanding"
              value={formatCurrency(financial.outstanding)}
              icon={<Clock className="h-5 w-5 text-yellow-300" />}
            />
            <KPICard
              label="Overdue"
              value={formatCurrency(financial.overdue)}
              icon={<AlertCircle className="h-5 w-5 text-red-300" />}
              danger={financial.overdue > 0}
            />
            <KPICard
              label="Net Cashflow"
              value={formatCurrency(financial.netCashflow)}
              icon={
                financial.netCashflow >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-300" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-300" />
                )
              }
              positive={financial.netCashflow >= 0}
            />
            <KPICard
              label="Collection Rate"
              value={`${financial.collectionRate}%`}
              icon={<Target className="h-5 w-5 text-blue-300" />}
            />
          </div>

          {/* Revenue Trend */}
          <ChartCard title="Revenue Trend">
            <TrendLine
              data={financial.revenueTrend}
              xKey="month"
              lines={[
                { key: "invoiced", color: "#3B82F6", name: "Invoiced" },
                { key: "received", color: "#10B981", name: "Received" },
              ]}
              formatYAxis={(v) => formatCurrency(v)}
            />
          </ChartCard>

          {/* Expense Trend */}
          <ChartCard title="Expense Trend">
            <TrendLine
              data={financial.expenseTrend}
              xKey="month"
              lines={[
                { key: "billed", color: "#F59E0B", name: "Billed" },
                { key: "paid", color: "#EF4444", name: "Paid" },
              ]}
              formatYAxis={(v) => formatCurrency(v)}
            />
          </ChartCard>

          {/* Aging */}
          <ChartCard title="Receivable vs Payable Aging">
            <AgingChart
              receivable={financial.receivableAging}
              payable={financial.payableAging}
            />
          </ChartCard>
        </TabsContent>

        {/* ─── Team Tab ─── */}
        <TabsContent value="team" className="space-y-6 mt-6">
          {/* Employee Table */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-[var(--border)] py-4 px-6">
              <CardTitle className="text-sm font-bold text-foreground">
                Employee Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned Leads</TableHead>
                    <TableHead>Converted</TableHead>
                    <TableHead>Conv. Rate</TableHead>
                    <TableHead>Avg Response</TableHead>
                    <TableHead>Tasks Done</TableHead>
                    <TableHead>Overdue</TableHead>
                    <TableHead className="pr-6">Active Projects</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-12 text-muted-foreground text-sm"
                      >
                        No employee data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="pl-6 font-medium">
                          {emp.name}
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {emp.role}
                        </TableCell>
                        <TableCell>{emp.assignedLeads}</TableCell>
                        <TableCell>{emp.convertedLeads}</TableCell>
                        <TableCell>
                          <span
                            className={
                              emp.conversionRate >= 30
                                ? "text-green-400 font-bold"
                                : ""
                            }
                          >
                            {emp.conversionRate}%
                          </span>
                        </TableCell>
                        <TableCell>
                          {emp.avgResponseTimeHours > 0
                            ? `${emp.avgResponseTimeHours}h`
                            : "-"}
                        </TableCell>
                        <TableCell>{emp.tasksCompleted}</TableCell>
                        <TableCell>
                          <span
                            className={
                              emp.overdueTasks > 0
                                ? "text-red-400 font-bold"
                                : ""
                            }
                          >
                            {emp.overdueTasks}
                          </span>
                        </TableCell>
                        <TableCell className="pr-6">
                          {emp.activeProjects}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Team Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Top Performers by Conversions">
              <DistributionBar
                data={[...employees]
                  .sort((a, b) => b.convertedLeads - a.convertedLeads)
                  .slice(0, 8)
                  .map((emp) => ({
                    label: emp.name.split(" ")[0],
                    value: emp.convertedLeads,
                    color: "#10B981",
                  }))}
              />
            </ChartCard>
            <ChartCard title="Task Completion Comparison">
              <DistributionBar
                data={[...employees]
                  .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
                  .slice(0, 8)
                  .map((emp) => ({
                    label: emp.name.split(" ")[0],
                    value: emp.tasksCompleted,
                    color: "#3B82F6",
                  }))}
              />
            </ChartCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Helper Components ───────────────────────────────────────

function KPICard({
  label,
  value,
  icon,
  danger,
  positive,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  danger?: boolean;
  positive?: boolean;
}) {
  return (
    <Card className={danger ? "border-red-500/20 bg-red-500/[0.03]" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle
          className={`text-[10px] font-bold uppercase tracking-wider ${
            danger ? "text-red-400" : "text-muted-foreground"
          }`}
        >
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div
          className={`text-3xl font-bold ${
            danger
              ? "text-red-400"
              : positive === false
              ? "text-red-400"
              : positive
              ? "text-green-400"
              : "text-foreground"
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="border-b border-[var(--border)] py-4 px-6">
        <CardTitle className="text-sm font-bold text-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}

// ── Label Formatters ────────────────────────────────────────

const SOURCE_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
];

const STATUS_COLORS: Record<string, string> = {
  planning: "#3B82F6",
  in_progress: "#F59E0B",
  completed: "#10B981",
  on_hold: "#94A3B8",
  cancelled: "#EF4444",
};

const HEALTH_COLORS: Record<string, string> = {
  on_track: "#10B981",
  at_risk: "#F59E0B",
  delayed: "#EF4444",
  unknown: "#94A3B8",
};

function formatSourceLabel(source: string): string {
  return source
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatHealthLabel(health: string): string {
  return health
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
