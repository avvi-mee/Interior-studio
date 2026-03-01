"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  Eye,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  Activity,
  X,
  User,
  Package,
  Briefcase,
  IndianRupee,
  Paperclip,
  MessageSquare,
  Send,
} from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useProjects, Project } from "@/hooks/useProjects";
import { useFinance } from "@/hooks/useFinance";
import { useEmployees } from "@/hooks/useEmployees";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActivityLogEntry } from "@/lib/services/projectService";

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  on_hold: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const HEALTH_COLORS: Record<string, string> = {
  on_track: "bg-green-100 text-green-700",
  at_risk: "bg-yellow-100 text-yellow-700",
  delayed: "bg-red-100 text-red-700",
};

const HEALTH_LABELS: Record<string, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  delayed: "Delayed",
};

const TASK_STATUS_OPTIONS = ["pending", "in_progress", "completed"] as const;

export default function ProjectsPage() {
  const { tenant } = useTenantAuth();
  const tenantId = tenant?.id || null;
  const {
    projects, stats, loading,
    updateProject, updatePhase, updateTask, fetchActivityLog,
    addTaskAttachment, addTaskComment, assignRole,
  } = useProjects(tenantId);
  const { getProjectFinanceSummary } = useFinance(tenantId);
  const { employees } = useEmployees(tenantId);
  const currentUser = useCurrentUser();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "phases" | "activity" | "finance">("overview");

  // Comment panel state
  const [openCommentTaskId, setOpenCommentTaskId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentIsInternal, setCommentIsInternal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFileUpload, setPendingFileUpload] = useState<{ projectId: string; phaseId: string; taskId: string } | null>(null);

  const searchLower = searchQuery.toLowerCase();
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.clientName.toLowerCase().includes(searchLower) ||
      p.projectName?.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { roles, employeeId } = currentUser;
  const isProjectOwner = roles.includes("owner") || roles.includes("project_manager");
  const visibleProjects = useMemo(() => {
    if (isProjectOwner) return filteredProjects;
    return filteredProjects.filter(
      (p) =>
        p.assignedTo       === employeeId ||
        p.assignedDesigner === employeeId ||
        p.assignedSupervisor === employeeId
    );
  }, [filteredProjects, isProjectOwner, employeeId]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString("en-IN", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
    });
  };

  const formatAmount = (amount: number | undefined) => {
    if (!amount) return "₹0";
    return amount >= 100000
      ? `₹${(amount / 100000).toFixed(1)}L`
      : `₹${amount.toLocaleString("en-IN")}`;
  };

  const openDetails = async (project: Project) => {
    setSelectedProject(project);
    setIsDetailsOpen(true);
    setActiveTab("overview");
    setExpandedPhases(new Set());
    setOpenCommentTaskId(null);
    const log = await fetchActivityLog(project.id);
    setActivityLog(log);
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    await updateProject(projectId, { status: newStatus as Project["status"] });
    if (selectedProject?.id === projectId) {
      setSelectedProject({ ...selectedProject, status: newStatus as Project["status"] });
    }
  };

  const handleTaskStatusChange = async (
    projectId: string,
    phaseId: string,
    taskId: string,
    newStatus: string
  ) => {
    await updateTask(projectId, phaseId, taskId, { status: newStatus as any });
  };

  const handleTaskProgressChange = async (
    projectId: string,
    phaseId: string,
    taskId: string,
    progress: number
  ) => {
    await updateTask(projectId, phaseId, taskId, { progress });
  };

  const handleAssignProject = async (projectId: string, employeeId: string) => {
    await updateProject(projectId, { assignedTo: employeeId });
    if (selectedProject?.id === projectId) {
      setSelectedProject({ ...selectedProject, assignedTo: employeeId });
    }
  };

  const handleAssignRole = async (
    role: "designer" | "supervisor" | "manager",
    employeeId: string
  ) => {
    if (!selectedProject) return;
    const member = employees.find(e => e.id === employeeId);
    const memberName = member?.name || "Unknown";
    const memberEmail = member?.email;
    await assignRole(selectedProject.id, role, employeeId, memberName, memberEmail);
  };

  const handleFileUpload = (projectId: string, phaseId: string, taskId: string) => {
    setPendingFileUpload({ projectId, phaseId, taskId });
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingFileUpload) return;
    const { projectId, phaseId, taskId } = pendingFileUpload;
    const uploadedBy = currentUser.employeeId || currentUser.firebaseUser?.uid || "unknown";
    await addTaskAttachment(projectId, phaseId, taskId, file, uploadedBy);
    setPendingFileUpload(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddComment = async (projectId: string, phaseId: string, taskId: string) => {
    if (!commentText.trim()) return;
    const authorId = currentUser.employeeId || currentUser.firebaseUser?.uid || "unknown";
    const authorName = currentUser.firebaseUser?.displayName || "Admin";
    await addTaskComment(projectId, phaseId, taskId, commentText.trim(), authorId, authorName, commentIsInternal);
    setCommentText("");
    setCommentIsInternal(false);
  };

  // Keep selectedProject in sync with live data
  useEffect(() => {
    if (selectedProject) {
      const updated = projects.find((p) => p.id === selectedProject.id);
      if (updated) setSelectedProject(updated);
    }
  }, [projects]);

  const financeSummary = selectedProject ? getProjectFinanceSummary(selectedProject.id) : null;

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading projects...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Hidden file input for attachments */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={onFileSelected}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500">Manage ongoing projects converted from approved leads</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Planning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-600">{stats.planning}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-blue-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-green-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-yellow-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">At Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats.atRisk}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-red-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Delayed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.delayed}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-orange-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Overdue Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.totalOverdueTasks}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by client name or project type..."
            className="pl-10 bg-white border-gray-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-white">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Projects Table */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {visibleProjects.length === 0 ? (
            <div className="p-12 text-center">
              <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No projects found</p>
              <p className="text-xs text-gray-400 mt-1">Projects are auto-created when leads are approved</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-transparent">
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Project</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Client</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Status</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Health</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Progress</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Assigned To</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Created</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleProjects.map((project) => (
                  <TableRow key={project.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openDetails(project)}>
                    <TableCell>
                      <div className="font-semibold text-gray-900">{project.projectName || project.clientName}</div>
                      <div className="text-xs text-gray-500">{project.status}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-900">{project.clientName}</div>
                      <div className="text-xs text-gray-500">{project.clientPhone}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px] border-none", STATUS_COLORS[project.status])}>
                        {STATUS_LABELS[project.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px] border-none", HEALTH_COLORS[project.healthStatus || "on_track"])}>
                        {HEALTH_LABELS[project.healthStatus || "on_track"]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              (project.projectProgress || 0) >= 80 ? "bg-green-500" :
                              (project.projectProgress || 0) >= 40 ? "bg-blue-500" :
                              "bg-orange-500"
                            )}
                            style={{ width: `${project.projectProgress || 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600">{project.projectProgress || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {project.assignedTo ? (
                        <div className="flex items-center gap-1.5">
                          <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                            {(employees.find(e => e.id === project.assignedTo)?.name || "?").charAt(0)}
                          </div>
                          <span className="text-sm text-gray-700">{employees.find(e => e.id === project.assignedTo)?.name || "Unassigned"}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {formatDate(project.createdAt)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => openDetails(project)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Project Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-[900px] h-[90vh] overflow-hidden flex flex-col">
          {selectedProject && (
            <>
              {/* Header */}
              <div className="shrink-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedProject.projectName || `${selectedProject.clientName}'s Project`}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={cn("text-[10px] border-none", STATUS_COLORS[selectedProject.status])}>
                      {STATUS_LABELS[selectedProject.status]}
                    </Badge>
                    <Badge className={cn("text-[10px] border-none", HEALTH_COLORS[selectedProject.healthStatus || "on_track"])}>
                      {HEALTH_LABELS[selectedProject.healthStatus || "on_track"]}
                    </Badge>
                    <span className="text-xs text-gray-500">{selectedProject.projectProgress || 0}% complete</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedProject.status}
                    onValueChange={(val) => handleStatusChange(selectedProject.id, val)}
                  >
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <DialogClose asChild>
                    <button className="rounded-full p-1.5 hover:bg-gray-100 transition-colors">
                      <X className="h-5 w-5 text-gray-500" />
                    </button>
                  </DialogClose>
                </div>
              </div>

              {/* Tabs */}
              <div className="shrink-0 px-6 border-b flex gap-1">
                {(["overview", "phases", "activity", "finance"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2",
                      activeTab === tab
                        ? "border-[#0F172A] text-[#0F172A]"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6">
                {/* Overview Tab */}
                {activeTab === "overview" && (
                  <>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
                        <User className="h-4 w-4 text-gray-500" />
                        Client Information
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Name</p>
                          <p className="text-sm font-medium text-gray-900">{selectedProject.clientName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Phone</p>
                          <p className="text-sm font-medium text-gray-900">{selectedProject.clientPhone}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Email</p>
                          <p className="text-sm font-medium text-gray-900">{selectedProject.clientEmail}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">City</p>
                          <p className="text-sm font-medium text-gray-900">{selectedProject.clientCity || "-"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-xs text-blue-600 uppercase mb-1">Project Name</p>
                        <p className="font-bold text-blue-900">{selectedProject.projectName || "-"}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase mb-1">Start Date</p>
                        <p className="font-bold text-gray-900">{formatDate(selectedProject.startDate)}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase mb-1">Target End Date</p>
                        <p className="font-bold text-gray-900">{formatDate(selectedProject.expectedEndDate)}</p>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-600 font-medium mb-1">Project Budget</p>
                          <div className="text-3xl font-bold text-blue-900">{formatAmount(selectedProject.totalAmount)}</div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-blue-600 mb-1">Assigned To</p>
                          <Select
                            value={selectedProject.assignedTo || "unassigned"}
                            onValueChange={(val) => val !== "unassigned" && handleAssignProject(selectedProject.id, val)}
                          >
                            <SelectTrigger className="h-8 w-[160px] text-xs bg-white">
                              <SelectValue>
                                {employees.find(e => e.id === selectedProject.assignedTo)?.name || "Unassigned"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned" disabled>Assign to...</SelectItem>
                              {employees.filter((e) => e.isActive).map((emp) => (
                                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Role Assignment Grid */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
                        <Briefcase className="h-4 w-4 text-gray-500" />
                        Role Assignments
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Designer</p>
                          <Select
                            value={selectedProject.assignedDesigner || "unassigned"}
                            onValueChange={(val) => val !== "unassigned" && handleAssignRole("designer", val)}
                          >
                            <SelectTrigger className="h-8 text-xs bg-white">
                              <SelectValue>
                                {employees.find(e => e.id === selectedProject.assignedDesigner)?.name || "Unassigned"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned" disabled>Assign designer...</SelectItem>
                              {employees
                                .filter((e) => e.isActive && (e.role === "designer" || e.roles?.includes("designer")))
                                .map((emp) => (
                                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Supervisor</p>
                          <Select
                            value={selectedProject.assignedSupervisor || "unassigned"}
                            onValueChange={(val) => val !== "unassigned" && handleAssignRole("supervisor", val)}
                          >
                            <SelectTrigger className="h-8 text-xs bg-white">
                              <SelectValue>
                                {employees.find(e => e.id === selectedProject.assignedSupervisor)?.name || "Unassigned"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned" disabled>Assign supervisor...</SelectItem>
                              {employees
                                .filter((e) => e.isActive && (e.role === "site_supervisor" || e.roles?.includes("site_supervisor")))
                                .map((emp) => (
                                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Manager</p>
                          <Select
                            value={selectedProject.assignedTo || "unassigned"}
                            onValueChange={(val) => val !== "unassigned" && handleAssignRole("manager", val)}
                          >
                            <SelectTrigger className="h-8 text-xs bg-white">
                              <SelectValue>
                                {employees.find(e => e.id === selectedProject.assignedTo)?.name || "Unassigned"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned" disabled>Assign manager...</SelectItem>
                              {employees
                                .filter((e) => e.isActive && (e.role === "manager" || e.roles?.includes("manager")))
                                .map((emp) => (
                                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                        <span className="text-sm font-bold text-gray-900">{selectedProject.projectProgress || 0}%</span>
                      </div>
                      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all"
                          style={{ width: `${selectedProject.projectProgress || 0}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Phases Tab */}
                {activeTab === "phases" && (
                  <div className="space-y-3">
                    {selectedProject.phases.map((phase) => (
                      <div key={phase.id} className="border rounded-lg overflow-hidden">
                        <button
                          onClick={() => togglePhase(phase.id)}
                          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {expandedPhases.has(phase.id) ? (
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-500" />
                            )}
                            <span className="font-semibold text-gray-900">{phase.name}</span>
                            <Badge className={cn("text-[10px] border-none", STATUS_COLORS[phase.status])}>
                              {STATUS_LABELS[phase.status] || phase.status}
                            </Badge>
                            {phase.isDelayed && (
                              <Badge className="text-[10px] border-none bg-red-100 text-red-700">Delayed</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${phase.progressPercentage || 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-600 w-8">{phase.progressPercentage || 0}%</span>
                          </div>
                        </button>

                        {expandedPhases.has(phase.id) && (
                          <div className="p-4 space-y-2">
                            {phase.tasks.map((task) => (
                              <div key={task.id} className="bg-white border rounded-md">
                                <div className="flex items-center justify-between p-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    {task.status === "completed" ? (
                                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                                    ) : task.isOverdue ? (
                                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                                    ) : task.status === "in_progress" ? (
                                      <Clock className="h-4 w-4 text-blue-500 shrink-0" />
                                    ) : (
                                      <div className="h-4 w-4 rounded-full border-2 border-gray-300 shrink-0" />
                                    )}
                                    <span className={cn(
                                      "text-sm truncate",
                                      task.status === "completed" ? "text-gray-400 line-through" : "text-gray-900"
                                    )}>
                                      {task.name}
                                    </span>
                                    {task.isOverdue && (
                                      <Badge className="text-[10px] border-none bg-red-100 text-red-700 shrink-0">Overdue</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {/* Progress slider */}
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={10}
                                        value={task.progress ?? 0}
                                        onChange={(e) =>
                                          handleTaskProgressChange(
                                            selectedProject.id,
                                            phase.id,
                                            task.id,
                                            Number(e.target.value)
                                          )
                                        }
                                        className="w-16 h-1.5 accent-blue-600"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <span className="text-[10px] font-medium text-gray-500 w-7">{task.progress ?? 0}%</span>
                                    </div>

                                    {/* Attachment button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleFileUpload(selectedProject.id, phase.id, task.id);
                                      }}
                                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                                      title="Upload file"
                                    >
                                      <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                                    </button>

                                    {/* Comment toggle */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenCommentTaskId(
                                          openCommentTaskId === task.id ? null : task.id
                                        );
                                      }}
                                      className="p-1 hover:bg-gray-100 rounded transition-colors relative"
                                      title="Comments"
                                    >
                                      <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                                      {(task.comments?.length || 0) > 0 && (
                                        <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-blue-500 text-white text-[8px] rounded-full flex items-center justify-center">
                                          {task.comments.length}
                                        </span>
                                      )}
                                    </button>

                                    {task.dueDate && (
                                      <span className="text-xs text-gray-400">{formatDate(task.dueDate)}</span>
                                    )}
                                    <Select
                                      value={task.status}
                                      onValueChange={(val) => handleTaskStatusChange(selectedProject.id, phase.id, task.id, val)}
                                    >
                                      <SelectTrigger className="h-7 w-[120px] text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {TASK_STATUS_OPTIONS.map((s) => (
                                          <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                {/* Attachments list */}
                                {(task.attachments?.length || 0) > 0 && (
                                  <div className="px-3 pb-2 flex flex-wrap gap-2">
                                    {task.attachments.map((att, idx) => (
                                      <a
                                        key={idx}
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded"
                                      >
                                        <Paperclip className="h-3 w-3" />
                                        {att.name}
                                      </a>
                                    ))}
                                  </div>
                                )}

                                {/* Comment panel */}
                                {openCommentTaskId === task.id && (
                                  <div className="border-t px-3 py-3 space-y-2 bg-gray-50/50">
                                    {(task.comments?.length || 0) > 0 && (
                                      <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {task.comments.map((c) => (
                                          <div key={c.id} className="text-xs">
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-gray-900">{c.authorName}</span>
                                              {c.isInternal && (
                                                <Badge className="text-[8px] border-none bg-yellow-100 text-yellow-700 px-1 py-0">Internal</Badge>
                                              )}
                                              <span className="text-gray-400">{formatDateTime(c.createdAt)}</span>
                                            </div>
                                            <p className="text-gray-700 mt-0.5">{c.text}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                      <Input
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        placeholder="Add a comment..."
                                        className="h-7 text-xs flex-1"
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleAddComment(selectedProject.id, phase.id, task.id);
                                          }
                                        }}
                                      />
                                      <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer whitespace-nowrap">
                                        <input
                                          type="checkbox"
                                          checked={commentIsInternal}
                                          onChange={(e) => setCommentIsInternal(e.target.checked)}
                                          className="h-3 w-3"
                                        />
                                        Internal
                                      </label>
                                      <button
                                        onClick={() => handleAddComment(selectedProject.id, phase.id, task.id)}
                                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                                      >
                                        <Send className="h-3.5 w-3.5 text-blue-600" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Activity Tab */}
                {activeTab === "activity" && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
                      <Activity className="h-4 w-4 text-gray-500" />
                      Activity Log
                    </div>
                    {/* Project timeline from embedded array */}
                    <div className="relative pl-4 border-l-2 border-gray-200 space-y-4 mb-6">
                      {selectedProject.timeline?.map((event, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-blue-500 border-2 border-white"></div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{event.action}</p>
                              {event.note && (
                                <p className="text-xs text-gray-500 mt-0.5 italic">&quot;{event.note}&quot;</p>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(event.timestamp)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Activity log from subcollection */}
                    {activityLog.length > 0 && (
                      <>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Detailed Activity</h4>
                        <div className="space-y-2">
                          {activityLog.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between bg-gray-50 rounded-md p-3">
                              <div>
                                <p className="text-sm text-gray-900">{entry.action}</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-gray-500 capitalize">{entry.entityType}</p>
                                  {entry.performedByName && (
                                    <span className="text-xs text-gray-400">by {entry.performedByName}</span>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs text-gray-400">{formatDateTime(entry.timestamp)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Finance Tab */}
                {activeTab === "finance" && financeSummary && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-xs text-green-600 uppercase mb-1">Total Invoiced</p>
                        <p className="text-xl font-bold text-green-900">{formatAmount(financeSummary.totalInvoiced)}</p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-xs text-blue-600 uppercase mb-1">Received</p>
                        <p className="text-xl font-bold text-blue-900">{formatAmount(financeSummary.totalReceived)}</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-xs text-orange-600 uppercase mb-1">Outstanding</p>
                        <p className="text-xl font-bold text-orange-900">{formatAmount(financeSummary.outstanding)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase mb-1">Vendor Bills</p>
                        <p className="text-xl font-bold text-gray-900">{formatAmount(financeSummary.totalVendorBills)}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase mb-1">Paid to Vendors</p>
                        <p className="text-xl font-bold text-gray-900">{formatAmount(financeSummary.totalPaidToVendors)}</p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <p className="text-xs text-red-600 uppercase mb-1">Remaining Payable</p>
                        <p className="text-xl font-bold text-red-900">{formatAmount(financeSummary.remainingPayable)}</p>
                      </div>
                    </div>

                    {financeSummary.invoices.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Invoices</h4>
                        <div className="space-y-2">
                          {financeSummary.invoices.map((inv) => (
                            <div key={inv.id} className="flex items-center justify-between bg-gray-50 rounded-md p-3">
                              <div>
                                <span className="text-sm font-medium text-gray-900">{inv.invoiceNumber}</span>
                                <span className="text-xs text-gray-500 ml-2">{inv.clientName}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold">{formatAmount(inv.amount)}</span>
                                <Badge className={cn("text-[10px] border-none", STATUS_COLORS[inv.status] || "bg-gray-100 text-gray-700")}>
                                  {inv.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {financeSummary.vendorBills.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Vendor Bills</h4>
                        <div className="space-y-2">
                          {financeSummary.vendorBills.map((bill) => (
                            <div key={bill.id} className="flex items-center justify-between bg-gray-50 rounded-md p-3">
                              <div>
                                <span className="text-sm font-medium text-gray-900">{bill.vendorName}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold">{formatAmount(bill.amount)}</span>
                                <Badge className={cn("text-[10px] border-none", STATUS_COLORS[bill.status] || "bg-gray-100 text-gray-700")}>
                                  {bill.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {financeSummary.invoices.length === 0 && financeSummary.vendorBills.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        <IndianRupee className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm">No financial records for this project yet</p>
                        <p className="text-xs mt-1">Create invoices and vendor bills from the Finance page</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
