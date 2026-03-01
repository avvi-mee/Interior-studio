"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, Download, Calendar, Loader2, Activity, CreditCard, IndianRupee, FileText } from "lucide-react";
import { usePublicWebsiteConfig } from "@/hooks/useWebsiteConfig";
import { useStorefrontOrders } from "@/hooks/useStorefrontOrders";
import { useClientInvoices } from "@/hooks/useClientInvoices";
import { useRouter } from "next/navigation";
import { generateEstimatePDF } from "@/lib/generateEstimatePdf";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function UserDashboard({ params }: { params: Promise<{ tenantId: string }> }) {
    const { tenantId } = use(params);
    const { config } = usePublicWebsiteConfig(tenantId);
    const router = useRouter();

    const [user, setUser] = useState<{ email: string; name: string; idToken?: string | null } | null>(null);
    const [trackingOrder, setTrackingOrder] = useState<any>(null);
    const [isTrackingOpen, setIsTrackingOpen] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    // Track which order cards have their Documents section expanded
    const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

    useEffect(() => {
        // Retrieve session
        const storedUser = localStorage.getItem(`storefront_user_${tenantId}`);
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        } else {
            router.push(`/${tenantId}`);
        }
    }, [tenantId, router]);

    const { orders: realOrders, loading } = useStorefrontOrders({
        tenantId,
        userEmail: user?.email || null,
        idToken: user?.idToken || null,
    });

    const { invoices, summary: paymentSummary } = useClientInvoices({
        tenantId,
        userEmail: user?.email || null,
        idToken: user?.idToken || null,
    });

    // Orders that have a projectSummary (synced from project execution engine)
    const ordersWithProject = realOrders.filter((o: any) => o.projectSummary);

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'approved': return 'bg-green-100 text-green-800 border-green-200';
            case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
            case 'running': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'planning': return 'bg-gray-100 text-gray-800 border-gray-200';
            case 'on_hold': return 'bg-orange-100 text-orange-800 border-orange-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'pending': return <Clock className="h-4 w-4 mr-1" />;
            case 'approved': return <CheckCircle className="h-4 w-4 mr-1" />;
            case 'completed': return <Package className="h-4 w-4 mr-1" />;
            case 'rejected': return <XCircle className="h-4 w-4 mr-1" />;
            case 'running': return <Clock className="h-4 w-4 mr-1" />;
            case 'in_progress': return <Clock className="h-4 w-4 mr-1" />;
            default: return <Clock className="h-4 w-4 mr-1" />;
        }
    }

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "-";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return "";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString("en-US", {
            hour: '2-digit', minute: '2-digit'
        });
    };

    const formatAmount = (amount: number | undefined) => {
        if (amount === undefined || amount === null) return "-";
        return `₹${amount.toLocaleString('en-IN')}`;
    };

    const handleTrackOrder = (order: any) => {
        setTrackingOrder(order);
        setIsTrackingOpen(true);
    };

    const handleDownloadEstimate = async (order: any) => {
        setDownloadingId(order.id);
        try {
            await generateEstimatePDF(order.id, config?.brandName || "Company", {
                download: true,
                uploadToStorage: false,
                tenantId: order.tenantId
            });
        } catch (error) {
            console.error("Error downloading estimate:", error);
            alert("Failed to download estimate PDF");
        } finally {
            setDownloadingId(null);
        }
    };

    const toggleDocs = (orderId: string) => {
        setExpandedDocs((prev) => {
            const next = new Set(prev);
            if (next.has(orderId)) next.delete(orderId);
            else next.add(orderId);
            return next;
        });
    };

    const getHealthColor = (health: string) => {
        switch (health) {
            case 'on_track': return 'bg-green-100 text-green-800';
            case 'at_risk': return 'bg-yellow-100 text-yellow-800';
            case 'delayed': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getHealthLabel = (health: string) => {
        switch (health) {
            case 'on_track': return 'On Track';
            case 'at_risk': return 'At Risk';
            case 'delayed': return 'Delayed';
            default: return health;
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">My Account</h1>
                    <p className="text-gray-500 mt-1">Manage your orders and view their status (Real-time).</p>
                </div>
                <Link href={`/${tenantId}`}>
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Store
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Sidebar */}
                <div className="md:col-span-1 space-y-4">
                    <Card className="border-none shadow-sm bg-gray-50">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl">
                                    {user?.name?.charAt(0) || "U"}
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">{user?.name || "User"}</p>
                                    <p className="text-xs text-gray-500">{user?.email}</p>
                                </div>
                            </div>
                            <nav className="space-y-1">
                                <Button variant="secondary" className="w-full justify-start bg-white shadow-sm font-medium">
                                    <Package className="mr-2 h-4 w-4" />
                                    My Orders
                                </Button>
                            </nav>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content */}
                <div className="md:col-span-3 space-y-6">
                    {/* Project Progress Section */}
                    {ordersWithProject.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-blue-600" />
                                    Project Progress
                                </CardTitle>
                                <CardDescription>Track the progress of your active projects.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {ordersWithProject.map((order: any) => {
                                    const ps = order.projectSummary;
                                    return (
                                        <div key={order.id} className="border rounded-lg p-4 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">
                                                        {order.plan ? `${order.plan} Plan` : (order.segment || "Project")}
                                                    </h3>
                                                    <p className="text-xs text-gray-500">Order #{order.id}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge className={getStatusColor(ps.status || 'planning')}>
                                                        {(ps.status || 'planning').replace(/_/g, ' ')}
                                                    </Badge>
                                                    <Badge className={getHealthColor(ps.healthStatus || 'on_track')}>
                                                        {getHealthLabel(ps.healthStatus || 'on_track')}
                                                    </Badge>
                                                </div>
                                            </div>

                                            {/* Overall progress bar */}
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-sm text-gray-600">Overall Progress</span>
                                                    <span className="text-sm font-bold text-gray-900">{ps.projectProgress || 0}%</span>
                                                </div>
                                                <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all"
                                                        style={{ width: `${ps.projectProgress || 0}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Phase milestones */}
                                            {ps.phases && ps.phases.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phases</p>
                                                    <div className="space-y-2">
                                                        {ps.phases
                                                            .sort((a: any, b: any) => a.order - b.order)
                                                            .map((phase: any, idx: number) => (
                                                                <div key={idx} className="flex items-center gap-3">
                                                                    {/* Numbered circle */}
                                                                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                                                        phase.status === 'completed'
                                                                            ? 'bg-green-500 text-white'
                                                                            : phase.status === 'in_progress'
                                                                            ? 'bg-blue-500 text-white'
                                                                            : 'bg-gray-200 text-gray-500'
                                                                    }`}>
                                                                        {phase.status === 'completed' ? (
                                                                            <CheckCircle className="h-4 w-4" />
                                                                        ) : (
                                                                            phase.order
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className={`text-sm ${
                                                                                phase.status === 'completed' ? 'text-gray-400' : 'text-gray-900'
                                                                            }`}>
                                                                                {phase.name}
                                                                            </span>
                                                                            <span className="text-xs text-gray-500">{phase.progressPercentage || 0}%</span>
                                                                        </div>
                                                                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                                                                            <div
                                                                                className={`h-full rounded-full transition-all ${
                                                                                    phase.status === 'completed'
                                                                                        ? 'bg-green-500'
                                                                                        : 'bg-blue-500'
                                                                                }`}
                                                                                style={{ width: `${phase.progressPercentage || 0}%` }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    {/* Payment Summary */}
                    {invoices.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5 text-emerald-600" />
                                    Payment Summary
                                </CardTitle>
                                <CardDescription>Your invoices and payment history.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {/* Summary Cards */}
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                                        <p className="text-xs text-gray-500 uppercase tracking-wider">Total Invoiced</p>
                                        <p className="text-xl font-bold text-gray-900 mt-1">{formatAmount(paymentSummary.totalInvoiced)}</p>
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-4 text-center">
                                        <p className="text-xs text-green-600 uppercase tracking-wider">Paid</p>
                                        <p className="text-xl font-bold text-green-700 mt-1">{formatAmount(paymentSummary.totalPaid)}</p>
                                    </div>
                                    <div className={`rounded-lg p-4 text-center ${paymentSummary.outstanding > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                                        <p className={`text-xs uppercase tracking-wider ${paymentSummary.outstanding > 0 ? 'text-red-600' : 'text-gray-500'}`}>Outstanding</p>
                                        <p className={`text-xl font-bold mt-1 ${paymentSummary.outstanding > 0 ? 'text-red-700' : 'text-gray-900'}`}>{formatAmount(paymentSummary.outstanding)}</p>
                                    </div>
                                </div>

                                {/* Invoice List */}
                                <div className="space-y-3">
                                    {invoices.map((inv) => {
                                        const outstanding = inv.amount - inv.paidAmount;
                                        const isPaid = outstanding <= 0;
                                        const dueDate = inv.dueDate?.toDate ? inv.dueDate.toDate() : new Date(inv.dueDate);
                                        const isOverdue = !isPaid && dueDate.getTime() < Date.now();

                                        return (
                                            <div key={inv.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm font-semibold text-gray-900">{inv.invoiceNumber}</span>
                                                        <Badge variant="outline" className={
                                                            isPaid ? 'bg-green-100 text-green-800 border-green-200' :
                                                            isOverdue ? 'bg-red-100 text-red-800 border-red-200' :
                                                            'bg-yellow-100 text-yellow-800 border-yellow-200'
                                                        }>
                                                            {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-gray-500">
                                                        Due: {formatDate(inv.dueDate)}
                                                        {inv.description && ` · ${inv.description}`}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-gray-900">{formatAmount(inv.amount)}</p>
                                                    {!isPaid && (
                                                        <p className="text-xs text-red-600">
                                                            <IndianRupee className="inline h-3 w-3" />
                                                            {(outstanding).toLocaleString('en-IN')} due
                                                        </p>
                                                    )}
                                                    {isPaid && (
                                                        <p className="text-xs text-green-600">Fully paid</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Order History */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Order History</CardTitle>
                            <CardDescription>View all your past estimates and orders.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {loading ? (
                                    <div className="text-center py-12 text-gray-400">Loading orders...</div>
                                ) : (
                                    <>
                                        {realOrders.map((order) => (
                                            <div key={order.id} className="flex flex-col p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-gray-900">
                                                                {order.plan ? `${order.plan} Plan` : (order.segment || "Estimate")}
                                                            </span>
                                                            <Badge variant="outline" className={getStatusColor(order.status || 'pending')}>
                                                                {getStatusIcon(order.status || 'pending')}
                                                                {order.status || 'pending'}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-sm text-gray-500">Order ID: {order.id} &bull; {formatDate(order.createdAt)}</p>
                                                        <p className="text-sm text-gray-600 mt-1 max-w-md">
                                                            {order.carpetArea ? `${order.carpetArea} sqft` : ''}
                                                            {order.segment ? ` • ${order.segment}` : ''}
                                                        </p>
                                                    </div>
                                                    <div className="text-right sm:text-right flex flex-col items-end gap-2">
                                                        <p className="font-bold text-gray-900">
                                                            {formatAmount(order.totalAmount || order.estimatedAmount)}
                                                        </p>
                                                        <div className="flex flex-wrap gap-2 justify-end">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleDownloadEstimate(order)}
                                                                disabled={downloadingId === order.id}
                                                                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                                            >
                                                                {downloadingId === order.id ? (
                                                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                                                ) : (
                                                                    <Download className="mr-1 h-3 w-3" />
                                                                )}
                                                                Download Estimate
                                                            </Button>
                                                            <Link href={`/${tenantId}/book-consultation`}>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="text-orange-600 border-orange-200 hover:bg-orange-50"
                                                                >
                                                                    <Calendar className="mr-1 h-3 w-3" />
                                                                    Book Consultation
                                                                </Button>
                                                            </Link>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleTrackOrder(order)}
                                                                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                                            >
                                                                Track Order
                                                            </Button>
                                                            {order.attachments && order.attachments.length > 0 && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => toggleDocs(order.id)}
                                                                    className="text-violet-600 border-violet-200 hover:bg-violet-50"
                                                                >
                                                                    <FileText className="mr-1 h-3 w-3" />
                                                                    {order.attachments.length} Document{order.attachments.length !== 1 ? "s" : ""}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Collapsible documents list */}
                                                {order.attachments && order.attachments.length > 0 && expandedDocs.has(order.id) && (
                                                    <div className="mt-4 pt-4 border-t space-y-2">
                                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                            Drawings &amp; Documents
                                                        </p>
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            {order.attachments.map((att, idx) => (
                                                                <a
                                                                    key={idx}
                                                                    href={att.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2 p-2.5 rounded-lg border border-violet-100 bg-violet-50 hover:bg-violet-100 transition-colors group"
                                                                >
                                                                    <FileText className="h-4 w-4 text-violet-500 shrink-0" />
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-violet-700">
                                                                            {att.name || "Attachment"}
                                                                        </p>
                                                                        {att.taskName && (
                                                                            <p className="text-xs text-gray-500 truncate">{att.taskName}</p>
                                                                        )}
                                                                    </div>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {realOrders.length === 0 && (
                                            <div className="text-center py-12">
                                                <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                                <h3 className="text-lg font-medium text-gray-900">No orders found</h3>
                                                <p className="text-gray-500 mt-2">You haven&apos;t placed any orders yet.</p>
                                                <Link href={`/${tenantId}/estimate`}>
                                                    <Button className="mt-4" style={{ backgroundColor: config?.primaryColor }}>
                                                        Create New Estimate
                                                    </Button>
                                                </Link>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={isTrackingOpen} onOpenChange={setIsTrackingOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Order Tracking</DialogTitle>
                        <DialogDescription>
                            Timeline for Order #{trackingOrder?.id}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        <div className="relative pl-4 border-l-2 border-gray-200 space-y-6">
                            {/* Created Node */}
                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-green-500 border-2 border-white"></div>
                                <div className="flex flex-col">
                                    <p className="text-sm font-bold text-gray-900">Order Placed</p>
                                    <p className="text-xs text-gray-500">
                                        {formatDate(trackingOrder?.createdAt)} {formatTime(trackingOrder?.createdAt)}
                                    </p>
                                </div>
                            </div>

                            {/* Dynamic Timeline */}
                            {trackingOrder?.timeline?.map((event: any, idx: number) => (
                                <div key={idx} className="relative">
                                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-blue-500 border-2 border-white"></div>
                                    <div className="flex flex-col">
                                        <p className="text-sm font-bold text-gray-900 capitalize text-pretty">
                                            {event.status?.replace(/_/g, " ")}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {formatDate(event.timestamp)} {formatTime(event.timestamp)}
                                        </p>
                                        {event.note && (
                                            <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-1 border border-gray-100 italic">
                                                &quot;{event.note}&quot;
                                            </p>
                                        )}
                                        {event.updatedBy && (
                                            <p className="text-[10px] text-gray-400 mt-0.5">Updated by {event.updatedBy}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
