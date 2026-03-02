"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDb } from "@/lib/firebase";
import {
    doc, getDoc, collection, onSnapshot, updateDoc, query, where, orderBy
} from "firebase/firestore";
import {
    Loader2, LogOut, Phone, MapPin, FileText, MessageSquare,
    Calendar, CheckCircle, TrendingUp, Briefcase, DollarSign,
    User, Flame, Thermometer, Snowflake, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface EmployeeData {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    area: string;
    phone: string;
    totalWork: number;
    currentWork: string;
    roles: string[];
}

interface AssignedOrder {
    id: string;
    clientName?: string;
    customerInfo?: { name: string; phone: string; city: string };
    plan?: string;
    totalAmount?: number;
    estimatedAmount?: number;
    status: string;
    assignedTo?: string;
    createdAt: any;
    timeline?: Array<{ status: string; timestamp: any; note?: string }>;
}

interface AssignedRequest {
    id: string;
    clientName: string;
    phone?: string;
    phoneNumber?: string;
    requirement: string;
    status: string;
    createdAt: any;
    assignedTo?: string;
    timeline?: Array<{ status: string; timestamp: any; note?: string }>;
}

interface AssignedLead {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    stage: string;
    temperature: "hot" | "warm" | "cold";
    estimatedValue?: number;
    assignedTo?: string;
    lastContactedAt?: any;
    createdAt: any;
    nextFollowUp?: any;
}

interface AssignedProject {
    id: string;
    clientName: string;
    projectName: string;
    status: string;
    startDate?: string;
    expectedEndDate?: string;
    totalAmount?: number;
    assignedDesigner?: string;
    assignedSupervisor?: string;
    assignedTo?: string;
    createdAt: any;
}

const ROLE_LABELS: Record<string, string> = {
    sales: "Sales",
    designer: "Designer",
    project_manager: "Project Manager",
    site_supervisor: "Site Supervisor",
    accountant: "Accountant",
};

const ROLE_COLORS: Record<string, string> = {
    sales: "bg-blue-600",
    designer: "bg-emerald-600",
    project_manager: "bg-purple-600",
    site_supervisor: "bg-orange-600",
    accountant: "bg-cyan-600",
};

const TEMP_COLORS: Record<string, string> = {
    hot: "bg-red-100 text-red-700",
    warm: "bg-orange-100 text-orange-700",
    cold: "bg-sky-100 text-sky-700",
};

const STAGE_COLORS: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    contacted: "bg-cyan-100 text-cyan-700",
    qualified: "bg-purple-100 text-purple-700",
    proposal_sent: "bg-indigo-100 text-indigo-700",
    negotiation: "bg-amber-100 text-amber-700",
    won: "bg-green-100 text-green-700",
    lost: "bg-red-100 text-red-700",
};

export default function EmployeeDashboard() {
    const router = useRouter();
    const [employee, setEmployee] = useState<EmployeeData | null>(null);
    const [brandName, setBrandName] = useState<string>("");
    const [loading, setLoading] = useState(true);

    // Role-specific data
    const [orders, setOrders] = useState<AssignedOrder[]>([]);
    const [requests, setRequests] = useState<AssignedRequest[]>([]);
    const [leads, setLeads] = useState<AssignedLead[]>([]);
    const [projects, setProjects] = useState<AssignedProject[]>([]);

    // Status update dialog
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [updateType, setUpdateType] = useState<"order" | "request">("order");
    const [newStatus, setNewStatus] = useState("");
    const [statusNote, setStatusNote] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        const sessionStr = sessionStorage.getItem("employeeSession");
        if (!sessionStr) { router.push("/login"); return; }

        let sessionData: { id: string; tenantId: string };
        try { sessionData = JSON.parse(sessionStr); }
        catch { router.push("/login"); return; }

        const { id, tenantId } = sessionData;
        const db = getDb();

        const empRef = doc(db, `tenants/${tenantId}/employees`, id);
        const empUnsub = onSnapshot(empRef, (snap) => {
            if (!snap.exists()) {
                sessionStorage.removeItem("employeeSession");
                router.push("/login");
                return;
            }
            const data = snap.data();
            const roles: string[] = data.roles ?? data.role_names ?? (data.role ? [data.role] : []);
            setEmployee({
                id: snap.id,
                tenantId,
                name: data.fullName ?? data.full_name ?? data.name ?? "",
                email: data.email ?? "",
                area: data.area ?? "",
                phone: data.phone ?? "",
                totalWork: data.total_work ?? 0,
                currentWork: data.current_work ?? "None",
                roles,
            });
            setLoading(false);
        });

        // Brand name
        getDoc(doc(db, `tenants/${tenantId}/pages/brand`)).then((snap) => {
            if (snap.exists()) {
                const c = snap.data().content || snap.data();
                setBrandName(c.brandName || "");
            }
        });

        // Estimates (designer / project_manager / site_supervisor)
        const ordersUnsub = onSnapshot(collection(db, `tenants/${tenantId}/estimates`), (snap) => {
            const all = snap.docs.map((d) => {
                const r = d.data();
                return {
                    id: d.id,
                    clientName: r.client_name,
                    customerInfo: r.customer_info,
                    plan: r.plan,
                    totalAmount: r.total_amount,
                    estimatedAmount: r.estimated_amount,
                    status: r.status,
                    assignedTo: r.assigned_to,
                    createdAt: r.created_at,
                    timeline: r.timeline || [],
                } as AssignedOrder;
            });
            setOrders(all.filter((o) => o.assignedTo === id));
        });

        // Consultations (sales / general)
        const requestsUnsub = onSnapshot(collection(db, `tenants/${tenantId}/consultations`), (snap) => {
            const all = snap.docs.map((d) => {
                const r = d.data();
                return {
                    id: d.id,
                    clientName: r.client_name || r.name,
                    phone: r.phone,
                    phoneNumber: r.phone_number,
                    requirement: r.requirement,
                    status: r.status,
                    createdAt: r.created_at,
                    assignedTo: r.assigned_to,
                    timeline: r.timeline || [],
                } as AssignedRequest;
            });
            setRequests(all.filter((r) => r.assignedTo === id));
        });

        // Leads (sales)
        const leadsUnsub = onSnapshot(
            query(collection(db, `tenants/${tenantId}/leads`), where("assignedTo", "==", id)),
            (snap) => {
                setLeads(snap.docs.map((d) => {
                    const r = d.data();
                    return {
                        id: d.id,
                        name: r.name ?? "",
                        phone: r.phone,
                        email: r.email,
                        stage: r.stage ?? "new",
                        temperature: r.temperature ?? "cold",
                        estimatedValue: r.estimatedValue,
                        assignedTo: r.assignedTo,
                        lastContactedAt: r.lastContactedAt,
                        createdAt: r.createdAt,
                        nextFollowUp: r.nextFollowUp,
                    } as AssignedLead;
                }));
            }
        );

        // Projects (project_manager / site_supervisor / designer)
        const projectsUnsub = onSnapshot(collection(db, `tenants/${tenantId}/projects`), (snap) => {
            const all = snap.docs.map((d) => {
                const r = d.data();
                return {
                    id: d.id,
                    clientName: r.clientName ?? "",
                    projectName: r.name ?? "",
                    status: r.status ?? "planning",
                    startDate: r.startDate,
                    expectedEndDate: r.targetEndDate,
                    totalAmount: r.contractValue,
                    assignedDesigner: r.designerId,
                    assignedSupervisor: r.supervisorId,
                    assignedTo: r.managerId,
                    createdAt: r.createdAt,
                } as AssignedProject;
            });
            setProjects(all.filter((p) =>
                p.assignedTo === id || p.assignedDesigner === id || p.assignedSupervisor === id
            ));
        });

        return () => {
            empUnsub();
            ordersUnsub();
            requestsUnsub();
            leadsUnsub();
            projectsUnsub();
        };
    }, [router]);

    const handleLogout = () => {
        sessionStorage.removeItem("employeeSession");
        router.push("/login");
    };

    const formatDate = (ts: any) => {
        if (!ts) return "-";
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        if (isNaN(d.getTime())) return "-";
        return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
    };

    const formatAmount = (v?: number) => {
        if (!v) return "-";
        return v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v.toLocaleString("en-IN")}`;
    };

    const openUpdateDialog = (item: any, type: "order" | "request") => {
        setSelectedItem(item);
        setUpdateType(type);
        setNewStatus(item.status);
        setStatusNote("");
        setIsDialogOpen(true);
    };

    const handleStatusUpdate = async () => {
        if (!employee || !selectedItem || !newStatus) return;
        setIsUpdating(true);
        try {
            const db = getDb();
            const col = updateType === "order" ? "estimates" : "consultations";
            const ref = doc(db, `tenants/${employee.tenantId}/${col}`, selectedItem.id);
            const snap = await getDoc(ref);
            const existing = snap.data()?.timeline || [];
            await updateDoc(ref, {
                status: newStatus,
                timeline: [...existing, {
                    status: newStatus,
                    timestamp: new Date().toISOString(),
                    updatedBy: employee.name,
                    note: statusNote,
                }],
            });
            setIsDialogOpen(false);
            setNewStatus("");
            setStatusNote("");
        } catch (e) {
            console.error("Error updating status:", e);
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }
    if (!employee) return null;

    const primaryRole = employee.roles[0] || "designer";
    const roleColor = ROLE_COLORS[primaryRole] || "bg-gray-700";

    // Build tabs based on assigned roles
    const tabs: Array<{ id: string; label: string; icon: React.ReactNode }> = [];
    if (employee.roles.includes("sales")) tabs.push({ id: "sales", label: "Sales", icon: <TrendingUp className="h-4 w-4" /> });
    if (employee.roles.includes("designer")) tabs.push({ id: "designer", label: "Designer", icon: <Briefcase className="h-4 w-4" /> });
    if (employee.roles.includes("project_manager")) tabs.push({ id: "project_manager", label: "Projects", icon: <Activity className="h-4 w-4" /> });
    if (employee.roles.includes("site_supervisor")) tabs.push({ id: "site_supervisor", label: "Site Work", icon: <MapPin className="h-4 w-4" /> });
    if (employee.roles.includes("accountant")) tabs.push({ id: "accountant", label: "Finance", icon: <DollarSign className="h-4 w-4" /> });
    // Fallback if no recognised role
    if (tabs.length === 0) tabs.push({ id: "general", label: "My Work", icon: <FileText className="h-4 w-4" /> });

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl ${roleColor} flex items-center justify-center text-white font-bold text-lg shadow`}>
                            {(brandName || "C").charAt(0)}
                        </div>
                        <div>
                            <h1 className="text-lg font-extrabold text-gray-900 leading-tight">
                                {brandName || "Company Dashboard"}
                            </h1>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                {employee.name} &middot; {employee.roles.map((r) => ROLE_LABELS[r] || r).join(", ")}
                            </div>
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleLogout} className="text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200">
                        <LogOut className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Logout</span>
                    </Button>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 space-y-6">
                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className={`${roleColor} border-none shadow text-white`}>
                        <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold">
                                {employee.roles.includes("sales") ? leads.length : orders.length}
                            </div>
                            <div className="text-xs opacity-80 mt-0.5 uppercase">
                                {employee.roles.includes("sales") ? "My Leads" : "Estimates"}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-white border shadow-sm">
                        <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-gray-900">{requests.length}</div>
                            <div className="text-xs text-gray-500 mt-0.5 uppercase">Inquiries</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-white border shadow-sm">
                        <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-gray-900">{employee.totalWork}</div>
                            <div className="text-xs text-gray-500 mt-0.5 uppercase">Completed</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-white border shadow-sm">
                        <CardContent className="p-4 text-center">
                            <div className="text-sm font-bold text-gray-900 truncate">{employee.area || "—"}</div>
                            <div className="text-xs text-gray-500 mt-0.5 uppercase">Area</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Role-based tabs */}
                <Tabs defaultValue={tabs[0].id} className="w-full">
                    <TabsList className={`bg-white border p-1 h-11 w-full justify-start gap-1 ${tabs.length > 3 ? "flex-wrap h-auto" : ""}`}>
                        {tabs.map((t) => (
                            <TabsTrigger
                                key={t.id}
                                value={t.id}
                                className="flex items-center gap-1.5 text-sm data-[state=active]:bg-gray-900 data-[state=active]:text-white rounded-md px-3"
                            >
                                {t.icon} {t.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {/* ── SALES DASHBOARD ── */}
                    <TabsContent value="sales" className="mt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-900">Sales Dashboard</h2>
                            <Badge className="bg-blue-600 text-white">{leads.length} leads</Badge>
                        </div>
                        {leads.length === 0 ? (
                            <EmptyState icon={<TrendingUp className="h-10 w-10 text-gray-300" />} message="No leads assigned yet." />
                        ) : (
                            <div className="space-y-3">
                                {leads.map((lead) => (
                                    <Card key={lead.id} className="border-l-4 border-l-blue-500 shadow-sm hover:shadow transition-all">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="h-9 w-9 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold shrink-0">
                                                        {lead.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-900">{lead.name}</p>
                                                        <p className="text-xs text-gray-500">{lead.phone || lead.email || "—"}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                    <Badge className={`text-[10px] border-none capitalize ${STAGE_COLORS[lead.stage] || "bg-gray-100 text-gray-700"}`}>
                                                        {lead.stage.replace(/_/g, " ")}
                                                    </Badge>
                                                    <div className="flex items-center gap-1">
                                                        {lead.temperature === "hot" && <Flame className="h-3.5 w-3.5 text-red-500" />}
                                                        {lead.temperature === "warm" && <Thermometer className="h-3.5 w-3.5 text-orange-500" />}
                                                        {lead.temperature === "cold" && <Snowflake className="h-3.5 w-3.5 text-sky-500" />}
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize border-none ${TEMP_COLORS[lead.temperature]}`}>
                                                            {lead.temperature}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                                                <span className="font-semibold text-gray-900">{formatAmount(lead.estimatedValue)}</span>
                                                {lead.lastContactedAt && (
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        Last contact: {formatDate(lead.lastContactedAt)}
                                                    </span>
                                                )}
                                                {lead.nextFollowUp && (
                                                    <span className="flex items-center gap-1 text-amber-600">
                                                        <Calendar className="h-3 w-3" />
                                                        Follow-up: {formatDate(lead.nextFollowUp)}
                                                    </span>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* ── DESIGNER DASHBOARD ── */}
                    <TabsContent value="designer" className="mt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-900">Designer Dashboard</h2>
                            <Badge className="bg-emerald-600 text-white">{orders.length} estimates</Badge>
                        </div>
                        {orders.length === 0 ? (
                            <EmptyState icon={<Briefcase className="h-10 w-10 text-gray-300" />} message="No estimates assigned yet." />
                        ) : (
                            <div className="space-y-4">
                                {orders.map((order) => (
                                    <EstimateCard key={order.id} order={order} onUpdate={(o) => openUpdateDialog(o, "order")} formatDate={formatDate} formatAmount={formatAmount} />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* ── PROJECT MANAGER DASHBOARD ── */}
                    <TabsContent value="project_manager" className="mt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-900">Project Manager Dashboard</h2>
                            <Badge className="bg-purple-600 text-white">{projects.length} projects</Badge>
                        </div>
                        <ProjectList projects={projects} formatDate={formatDate} formatAmount={formatAmount} />
                    </TabsContent>

                    {/* ── SITE SUPERVISOR DASHBOARD ── */}
                    <TabsContent value="site_supervisor" className="mt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-900">Site Supervisor Dashboard</h2>
                            <Badge className="bg-orange-600 text-white">{projects.length} projects</Badge>
                        </div>
                        <ProjectList projects={projects} formatDate={formatDate} formatAmount={formatAmount} />
                    </TabsContent>

                    {/* ── ACCOUNTANT DASHBOARD ── */}
                    <TabsContent value="accountant" className="mt-4">
                        <div className="mb-4">
                            <h2 className="text-lg font-bold text-gray-900">Finance Dashboard</h2>
                        </div>
                        <EmptyState icon={<DollarSign className="h-10 w-10 text-gray-300" />} message="Finance data will appear here." />
                    </TabsContent>

                    {/* ── GENERAL (fallback) ── */}
                    <TabsContent value="general" className="mt-4">
                        <div className="space-y-6">
                            <WorkSection
                                title={`Assigned Estimates (${orders.length})`}
                                empty={orders.length === 0}
                                emptyIcon={<FileText className="h-10 w-10 text-gray-300" />}
                                emptyMsg="No estimates assigned yet."
                            >
                                {orders.map((o) => (
                                    <EstimateCard key={o.id} order={o} onUpdate={(item) => openUpdateDialog(item, "order")} formatDate={formatDate} formatAmount={formatAmount} />
                                ))}
                            </WorkSection>
                            <WorkSection
                                title={`Assigned Inquiries (${requests.length})`}
                                empty={requests.length === 0}
                                emptyIcon={<MessageSquare className="h-10 w-10 text-gray-300" />}
                                emptyMsg="No inquiries assigned yet."
                            >
                                {requests.map((r) => (
                                    <RequestCard key={r.id} request={r} onUpdate={(item) => openUpdateDialog(item, "request")} formatDate={formatDate} />
                                ))}
                            </WorkSection>
                        </div>
                    </TabsContent>
                </Tabs>
            </main>

            {/* Status Update Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Update Status</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>New Status</Label>
                            <Select value={newStatus} onValueChange={setNewStatus}>
                                <SelectTrigger><SelectValue placeholder="Select status..." /></SelectTrigger>
                                <SelectContent>
                                    {updateType === "order" ? (
                                        <>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="running">Running / In Progress</SelectItem>
                                            <SelectItem value="on_hold">On Hold</SelectItem>
                                            <SelectItem value="successful">Successful / Completed</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                        </>
                                    ) : (
                                        <>
                                            <SelectItem value="new">New</SelectItem>
                                            <SelectItem value="contacted">Contacted</SelectItem>
                                            <SelectItem value="follow_up">Follow Up</SelectItem>
                                            <SelectItem value="converted">Converted</SelectItem>
                                            <SelectItem value="closed">Closed</SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Note / Comment</Label>
                            <Textarea
                                placeholder="Add a note..."
                                value={statusNote}
                                onChange={(e) => setStatusNote(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleStatusUpdate} disabled={isUpdating} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Save Update
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
    return (
        <div className="text-center py-14 bg-white rounded-xl border border-dashed border-gray-200">
            <div className="flex justify-center mb-3">{icon}</div>
            <p className="text-gray-500 text-sm">{message}</p>
        </div>
    );
}

function WorkSection({ title, empty, emptyIcon, emptyMsg, children }: {
    title: string; empty: boolean; emptyIcon: React.ReactNode; emptyMsg: string; children: React.ReactNode;
}) {
    return (
        <div>
            <h3 className="text-base font-semibold text-gray-800 mb-3">{title}</h3>
            {empty ? <EmptyState icon={emptyIcon} message={emptyMsg} /> : <div className="space-y-3">{children}</div>}
        </div>
    );
}

function EstimateCard({ order, onUpdate, formatDate, formatAmount }: {
    order: AssignedOrder;
    onUpdate: (o: AssignedOrder) => void;
    formatDate: (ts: any) => string;
    formatAmount: (v?: number) => string;
}) {
    const statusColor = order.status === "successful" || order.status === "completed"
        ? "border-l-green-500" : order.status === "running" ? "border-l-blue-500" : "border-l-gray-300";
    return (
        <Card className={`border-l-4 ${statusColor} shadow-sm hover:shadow transition-all`}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="font-semibold text-gray-900">{order.customerInfo?.name || order.clientName || "Unknown"}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            {order.customerInfo?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{order.customerInfo.phone}</span>}
                            {order.customerInfo?.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{order.customerInfo.city}</span>}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <Badge className={`text-[10px] capitalize ${order.status === "successful" ? "bg-green-100 text-green-700" : order.status === "running" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"} border-none`}>
                            {order.status}
                        </Badge>
                        <span className="text-xs font-bold text-emerald-700">{formatAmount(order.totalAmount || order.estimatedAmount)}</span>
                    </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400">Created {formatDate(order.createdAt)}</span>
                    <Button size="sm" onClick={() => onUpdate(order)} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                        Update Status
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function RequestCard({ request, onUpdate, formatDate }: {
    request: AssignedRequest;
    onUpdate: (r: AssignedRequest) => void;
    formatDate: (ts: any) => string;
}) {
    return (
        <Card className="border-l-4 border-l-blue-400 shadow-sm hover:shadow transition-all">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="font-semibold text-gray-900">{request.clientName}</p>
                        {(request.phone || request.phoneNumber) && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3" />{request.phone || request.phoneNumber}
                            </p>
                        )}
                        {request.requirement && (
                            <p className="text-xs text-gray-600 italic mt-1 bg-gray-50 p-1.5 rounded">{request.requirement}</p>
                        )}
                    </div>
                    <Badge className={`text-[10px] capitalize shrink-0 ${request.status === "converted" || request.status === "closed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"} border-none`}>
                        {request.status}
                    </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400">Received {formatDate(request.createdAt)}</span>
                    <Button size="sm" onClick={() => onUpdate(request)} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                        Update Status
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function ProjectList({ projects, formatDate, formatAmount }: {
    projects: AssignedProject[];
    formatDate: (ts: any) => string;
    formatAmount: (v?: number) => string;
}) {
    if (projects.length === 0) {
        return <EmptyState icon={<Activity className="h-10 w-10 text-gray-300" />} message="No projects assigned yet." />;
    }
    return (
        <div className="space-y-3">
            {projects.map((p) => (
                <Card key={p.id} className="shadow-sm hover:shadow transition-all">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-semibold text-gray-900">{p.projectName || p.clientName}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{p.clientName}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                                <Badge className={`text-[10px] capitalize border-none ${p.status === "completed" ? "bg-green-100 text-green-700" : p.status === "active" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                                    {p.status}
                                </Badge>
                                {p.totalAmount && <span className="text-xs font-bold text-gray-900">{formatAmount(p.totalAmount)}</span>}
                            </div>
                        </div>
                        <div className="mt-2 flex gap-4 text-xs text-gray-400">
                            {p.startDate && <span>Start: {formatDate(p.startDate)}</span>}
                            {p.expectedEndDate && <span>Due: {formatDate(p.expectedEndDate)}</span>}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
