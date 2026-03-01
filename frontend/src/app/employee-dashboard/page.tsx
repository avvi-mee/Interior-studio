"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDb } from "@/lib/firebase";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot, updateDoc } from "firebase/firestore";
import { Loader2, LogOut, Briefcase, Phone, MapPin, User, CheckCircle, Clock, FileText, MessageSquare, Calendar, ChevronRight, Activity, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface EmployeeData {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    area: string;
    phone: string;
    totalWork: number;
    currentWork: string;
    upcomingWork?: string;
}

interface DesignerInfo {
    brandName?: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
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
    timeline?: Array<{ status: string; timestamp: any; note?: string }>;
}



export default function EmployeeDashboard() {
    const router = useRouter();
    const [employee, setEmployee] = useState<EmployeeData | null>(null);
    const [designer, setDesigner] = useState<DesignerInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<AssignedOrder[]>([]);
    const [requests, setRequests] = useState<AssignedRequest[]>([]);


    // Status Update State
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [updateType, setUpdateType] = useState<'order' | 'request'>('order');
    const [newStatus, setNewStatus] = useState("");
    const [statusNote, setStatusNote] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Conversion State


    useEffect(() => {
        // 1. Get Session
        const sessionStr = sessionStorage.getItem("employeeSession");
        if (!sessionStr) {
            router.push("/login");
            return;
        }

        let sessionData;
        try {
            sessionData = JSON.parse(sessionStr);
        } catch (e) {
            router.push("/login");
            return;
        }

        const { id, tenantId } = sessionData;
        const db = getDb();

        // 2. Fetch Employee Data
        const fetchEmployee = async () => {
            try {
                const empRef = doc(db, `tenants/${tenantId}/employees`, id);
                const empSnap = await getDoc(empRef);

                if (!empSnap.exists()) {
                    sessionStorage.removeItem("employeeSession");
                    router.push("/login");
                    return;
                }

                const data = empSnap.data();
                setEmployee({
                    id: empSnap.id,
                    tenantId: tenantId,
                    name: data.full_name || data.name || "",
                    email: data.email || "",
                    area: data.area || "",
                    phone: data.phone || "",
                    totalWork: data.total_work || 0,
                    currentWork: data.current_work || "None",
                    upcomingWork: data.upcoming_work,
                });
            } catch (error) {
                console.error("Error fetching employee:", error);
                sessionStorage.removeItem("employeeSession");
                router.push("/login");
            }
        };

        // 3. Fetch Designer Info (brand page config)
        const fetchDesigner = async () => {
            try {
                const brandRef = doc(db, `tenants/${tenantId}/pages/brand`);
                const brandSnap = await getDoc(brandRef);

                if (brandSnap.exists()) {
                    const c = brandSnap.data().content || brandSnap.data();
                    setDesigner({
                        brandName: c.brandName || "",
                        phone: c.phone || "",
                        email: c.email || "",
                        logoUrl: c.logoUrl || "",
                    });
                }
            } catch (err) {
                console.error("Error loading designer info", err);
            } finally {
                setLoading(false);
            }
        };

        fetchEmployee();
        fetchDesigner();

        // 4. Realtime subscription for employee doc
        const empUnsub = onSnapshot(doc(db, `tenants/${tenantId}/employees`, id), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setEmployee({
                    id: snap.id,
                    tenantId: tenantId,
                    name: data.full_name || data.name || "",
                    email: data.email || "",
                    area: data.area || "",
                    phone: data.phone || "",
                    totalWork: data.total_work || 0,
                    currentWork: data.current_work || "None",
                    upcomingWork: data.upcoming_work,
                });
            }
        });

        // 5. Realtime subscription for estimates (orders)
        const estimatesRef = collection(db, `tenants/${tenantId}/estimates`);
        const ordersUnsub = onSnapshot(estimatesRef, (snap) => {
            const allOrds = snap.docs.map(d => {
                const row = d.data();
                return {
                    id: d.id,
                    clientName: row.client_name,
                    customerInfo: row.customer_info,
                    plan: row.plan,
                    totalAmount: row.total_amount,
                    estimatedAmount: row.estimated_amount,
                    status: row.status,
                    assignedTo: row.assigned_to,
                    createdAt: row.created_at,
                    timeline: row.timeline || [],
                } as AssignedOrder;
            });

            const myOrds = allOrds.filter(o => o.assignedTo === id);
            myOrds.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            setOrders(myOrds);
        });

        // 6. Realtime subscription for consultations (requests)
        const consultationsRef = collection(db, `tenants/${tenantId}/consultations`);
        const requestsUnsub = onSnapshot(consultationsRef, (snap) => {
            const allReqs = snap.docs.map(d => {
                const row = d.data();
                return {
                    id: d.id,
                    clientName: row.client_name || row.name,
                    phone: row.phone,
                    phoneNumber: row.phone_number,
                    requirement: row.requirement,
                    status: row.status,
                    createdAt: row.created_at,
                    timeline: row.timeline || [],
                    assignedTo: row.assigned_to,
                };
            });
            const myReqs = allReqs.filter((r: any) => r.assignedTo === id);
            myReqs.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            setRequests(myReqs as AssignedRequest[]);
        });

        return () => {
            empUnsub();
            ordersUnsub();
            requestsUnsub();
        };
    }, [router]);

    const handleLogout = () => {
        sessionStorage.removeItem("employeeSession");
        router.push("/login");
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "-";
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return "-";
        return date.toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric"
        });
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return "";
        return date.toLocaleTimeString("en-US", {
            hour: '2-digit', minute: '2-digit'
        });
    };

    const handleStatusUpdate = async () => {
        if (!employee || !selectedItem || !newStatus) return;
        setIsUpdating(true);

        try {
            const db = getDb();
            const collectionName = updateType === 'order' ? 'estimates' : 'consultations';

            const nowISO = new Date().toISOString();
            const timelineEntry = {
                status: newStatus,
                timestamp: nowISO,
                updatedBy: employee.name,
                note: statusNote,
            };

            // Get current timeline
            const itemRef = doc(db, `tenants/${employee.tenantId}/${collectionName}`, selectedItem.id);
            const currentSnap = await getDoc(itemRef);
            const existingTimeline = currentSnap.data()?.timeline || [];

            await updateDoc(itemRef, {
                status: newStatus,
                timeline: [...existingTimeline, timelineEntry],
            });

            // Also update team member's current work if status is active
            const empRef = doc(db, `tenants/${employee.tenantId}/employees`, employee.id);
            if (newStatus === 'running' || newStatus === 'in_progress' || newStatus === 'contacted') {
                await updateDoc(empRef, {
                    current_work: updateType === 'order'
                        ? (selectedItem.customerInfo?.name || "Order Task")
                        : (selectedItem.clientName || "Request Task"),
                });
            }
            // If completed, clear current work
            if (newStatus === 'completed' || newStatus === 'closed' || newStatus === 'successful') {
                await updateDoc(empRef, {
                    current_work: "None",
                    total_work: (employee.totalWork || 0) + 1,
                });
            }

            setIsDialogOpen(false);
            setNewStatus("");
            setStatusNote("");
        } catch (error) {
            console.error("Error updating status:", error);
        } finally {
            setIsUpdating(false);
        }
    };



    const openUpdateDialog = (item: any, type: 'order' | 'request') => {
        setSelectedItem(item);
        setUpdateType(type);
        setNewStatus(item.status);
        // If it's a lead, status might be e.g. "site_visit".
        setNewStatus(item.status);
        setStatusNote("");
        setIsDialogOpen(true);
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (!employee) return null;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header - PROMINENT BRANDING */}
            <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {designer?.logoUrl ? (
                            <img src={designer.logoUrl} alt="Logo" className="h-12 w-12 object-contain" />
                        ) : (
                            <div className="h-12 w-12 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
                                {designer?.brandName?.charAt(0) || "C"}
                            </div>
                        )}
                        <div>
                            <h1 className="text-xl md:text-2xl font-extrabold text-gray-900 tracking-tight">
                                {designer?.brandName || "Company Dashboard"}
                            </h1>
                            <div className="flex items-center text-xs text-gray-500 font-medium">
                                <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                                Employee Portal • {employee.name}
                            </div>
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleLogout} className="text-gray-600 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
                        <LogOut className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Logout</span>
                    </Button>
                </div>
            </header>

            {/* DEBUG INFO - TEMPORARY */}
            <div className="bg-yellow-50 border-b border-yellow-200 p-2 text-xs font-mono text-yellow-800">
                <div className="max-w-7xl mx-auto flex flex-wrap gap-4">
                    <span><strong>Tenant ID:</strong> {employee.tenantId}</span>
                    <span><strong>Employee ID:</strong> {employee.id}</span>
                </div>
            </div>

            <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 space-y-8">

                {/* Status Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-emerald-600 border-none shadow-md text-white">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-bold">{orders.length}</span>
                            <span className="text-xs uppercase opacity-80 mt-1">Estimates</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-600 border-none shadow-md text-white">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-bold">{requests.length}</span>
                            <span className="text-xs uppercase opacity-80 mt-1">Inquiries</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-white border shadow-sm">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-bold text-gray-900">{employee.totalWork}</span>
                            <span className="text-xs uppercase text-gray-500 mt-1">Completed</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-white border shadow-sm">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-xl font-bold text-gray-900 truncate w-full">{employee.area}</span>
                            <span className="text-xs uppercase text-gray-500 mt-1">Area</span>
                        </CardContent>
                    </Card>
                </div>

                {/* Work Dashboard */}
                <div className="space-y-6">
                    <Tabs defaultValue="orders" className="w-full">
                        <TabsList className="bg-white border w-full justify-start p-1 h-12">
                            <TabsTrigger value="orders" className="flex-1 max-w-[200px] data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:border-emerald-200 border border-transparent">
                                Assigned Estimates ({orders.length})
                            </TabsTrigger>
                            <TabsTrigger value="requests" className="flex-1 max-w-[200px] data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 border border-transparent">
                                Assigned Inquiries ({requests.length})
                            </TabsTrigger>
                        </TabsList>

                        {/* ORDERS TAB */}
                        <TabsContent value="orders" className="mt-6 space-y-6">
                            {orders.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-lg border border-dashed">
                                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                    <p className="text-gray-500">No estimates assigned yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {orders.map(order => (
                                        <Card key={order.id} className="overflow-hidden border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-all">
                                            <CardHeader className="pb-3 bg-gray-50/50 border-b border-gray-100">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Badge variant="outline" className="bg-white">
                                                                #{order.id.slice(0, 8)}
                                                            </Badge>
                                                            <Badge className={
                                                                order.status === 'completed' || order.status === 'successful' ? 'bg-green-600' :
                                                                    order.status === 'running' ? 'bg-blue-600' : 'bg-gray-600'
                                                            }>
                                                                {order.status}
                                                            </Badge>
                                                        </div>
                                                        <CardTitle className="text-lg">
                                                            {order.customerInfo?.name || order.clientName || "Unknown Client"}
                                                        </CardTitle>
                                                    </div>
                                                    <Button onClick={() => openUpdateDialog(order, 'order')} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                                                        Update Status
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="pt-6">
                                                <div className="grid md:grid-cols-3 gap-8">
                                                    <div className="space-y-4 md:col-span-1">
                                                        <h4 className="font-semibold text-gray-900 border-b pb-2 mb-2">Details</h4>
                                                        <div className="space-y-2 text-sm">
                                                            <div className="flex items-center text-gray-600">
                                                                <Phone className="h-4 w-4 mr-2" /> {order.customerInfo?.phone || "-"}
                                                            </div>
                                                            <div className="flex items-center text-gray-600">
                                                                <MapPin className="h-4 w-4 mr-2" /> {order.customerInfo?.city || "-"}
                                                            </div>
                                                            <div className="flex items-center text-gray-600">
                                                                <FileText className="h-4 w-4 mr-2" /> {order.plan} Plan
                                                            </div>
                                                            <div className="pt-2 font-bold text-lg text-emerald-700">
                                                                {(order.totalAmount || order.estimatedAmount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* TIMELINE VIEW */}
                                                    <div className="md:col-span-2">
                                                        <h4 className="font-semibold text-gray-900 border-b pb-2 mb-4">Tracking History</h4>
                                                        <div className="relative pl-4 border-l-2 border-gray-200 space-y-6">
                                                            {/* Initial Assignment */}
                                                            <div className="relative">
                                                                <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-gray-300 border-2 border-white"></div>
                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                                                    <p className="text-sm font-medium text-gray-900">Task Assigned</p>
                                                                    <div className="text-xs text-gray-400">
                                                                        {formatDate(order.createdAt)} • {formatTime(order.createdAt)}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Dynamic Timeline */}
                                                            {order.timeline?.map((event, idx) => (
                                                                <div key={idx} className="relative">
                                                                    <div className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white ${event.status === 'completed' || event.status === 'successful' ? 'bg-green-500' : 'bg-blue-500'
                                                                        }`}></div>
                                                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                                                        <div>
                                                                            <p className="text-sm font-bold text-gray-900 capitalize">{event.status}</p>
                                                                            {event.note && (
                                                                                <p className="text-xs text-gray-500 mt-1 max-w-md bg-gray-50 p-2 rounded">
                                                                                    "{event.note}"
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-xs text-gray-400 whitespace-nowrap">
                                                                            {formatDate(event.timestamp)} • {formatTime(event.timestamp)}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        {/* REQUESTS TAB */}
                        <TabsContent value="requests" className="mt-6 space-y-6">
                            {requests.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-lg border border-dashed">
                                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                    <p className="text-gray-500">No inquiries assigned yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {requests.map(request => (
                                        <Card key={request.id} className="overflow-hidden border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
                                            <CardHeader className="pb-3 bg-gray-50/50 border-b border-gray-100">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Badge variant="secondary" className="bg-purple-50 text-purple-700">
                                                                INQUIRY
                                                            </Badge>
                                                            <Badge className={
                                                                request.status === 'closed' || request.status === 'converted' ? 'bg-green-600' :
                                                                    request.status === 'contacted' ? 'bg-blue-600' : 'bg-gray-600'
                                                            }>
                                                                {request.status}
                                                            </Badge>
                                                        </div>
                                                        <CardTitle className="text-lg">
                                                            {request.clientName}
                                                        </CardTitle>
                                                    </div>
                                                    <Button onClick={() => openUpdateDialog(request, 'request')} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                                                        Update Status
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="pt-6">
                                                <div className="grid md:grid-cols-3 gap-8">
                                                    <div className="space-y-4 md:col-span-1">
                                                        <h4 className="font-semibold text-gray-900 border-b pb-2 mb-2">Details</h4>
                                                        <div className="space-y-2 text-sm">
                                                            <div className="flex items-center text-gray-600">
                                                                <Phone className="h-4 w-4 mr-2" /> {request.phone || request.phoneNumber || "-"}
                                                            </div>
                                                            <div className="mt-3">
                                                                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Requirement</p>
                                                                <p className="text-gray-700 italic bg-gray-50 p-2 rounded text-sm">{request.requirement}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* TIMELINE VIEW */}
                                                    <div className="md:col-span-2">
                                                        <h4 className="font-semibold text-gray-900 border-b pb-2 mb-4">Tracking History</h4>
                                                        <div className="relative pl-4 border-l-2 border-gray-200 space-y-6">
                                                            {/* Initial Assignment */}
                                                            <div className="relative">
                                                                <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-gray-300 border-2 border-white"></div>
                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                                                    <p className="text-sm font-medium text-gray-900">Inquiry Received</p>
                                                                    <div className="text-xs text-gray-400">
                                                                        {formatDate(request.createdAt)} • {formatTime(request.createdAt)}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Dynamic Timeline */}
                                                            {request.timeline?.map((event, idx) => (
                                                                <div key={idx} className="relative">
                                                                    <div className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white ${event.status === 'closed' || event.status === 'converted' ? 'bg-green-500' : 'bg-blue-500'
                                                                        }`}></div>
                                                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                                                        <div>
                                                                            <p className="text-sm font-bold text-gray-900 capitalize">{event.status}</p>
                                                                            {event.note && (
                                                                                <p className="text-xs text-gray-500 mt-1 max-w-md bg-gray-50 p-2 rounded">
                                                                                    "{event.note}"
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-xs text-gray-400 whitespace-nowrap">
                                                                            {formatDate(event.timestamp)} • {formatTime(event.timestamp)}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </main>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Status</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>New Status</Label>
                            <Select value={newStatus} onValueChange={setNewStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {updateType === 'order' ? (
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
                                placeholder="Add a note about this update..."
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
