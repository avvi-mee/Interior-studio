"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, DollarSign, TrendingUp, CheckCircle2 } from "lucide-react";
import { usePlatformStats } from "@/hooks/usePlatformStats";
import { usePendingApprovals } from "@/hooks/usePendingApprovals";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { useState } from "react";

export default function SuperAdminDashboard() {
    const stats = usePlatformStats();
    const { approvals, loading: approvalsLoading, handleApprove, handleReject } = usePendingApprovals();
    const { activities, loading: activitiesLoading } = useRecentActivity(5);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const onApprove = async (companyId: string) => {
        setProcessingId(companyId);
        try {
            await handleApprove(companyId);
        } catch (error) {
            console.error("Failed to approve company:", error);
        } finally {
            setProcessingId(null);
        }
    };

    const onReject = async (companyId: string) => {
        setProcessingId(companyId);
        try {
            await handleReject(companyId);
        } catch (error) {
            console.error("Failed to reject company:", error);
        } finally {
            setProcessingId(null);
        }
    };

    // Format date for display
    const formatDate = (timestamp: any) => {
        if (!timestamp?.toDate) return "-";
        return timestamp.toDate().toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Platform Overview</h2>
                <p className="text-muted-foreground">
                    Monitor and manage all companies on the platform.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {stats.loading ? (
                            <div className="text-2xl font-bold">Loading...</div>
                        ) : (
                            <>
                                <div className="text-2xl font-bold">{stats.totalCompanies}</div>
                                <p className="text-xs text-muted-foreground">
                                    {stats.companiesThisMonth > 0
                                        ? `+${stats.companiesThisMonth} registered this month`
                                        : "No new registrations this month"}
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Companies</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {stats.loading ? (
                            <div className="text-2xl font-bold">Loading...</div>
                        ) : (
                            <>
                                <div className="text-2xl font-bold">{stats.activeCompanies}</div>
                                <p className="text-xs text-muted-foreground">
                                    {stats.totalCompanies > 0
                                        ? `${Math.round((stats.activeCompanies / stats.totalCompanies) * 100)}% activation rate`
                                        : "No companies yet"}
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {stats.loading ? (
                            <div className="text-2xl font-bold">Loading...</div>
                        ) : (
                            <>
                                <div className="text-2xl font-bold">
                                    ₹{stats.platformRevenue.toLocaleString('en-IN')}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Sum of all approved estimates
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Company Growth Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {stats.loading ? (
                            <div className="text-2xl font-bold">Loading...</div>
                        ) : (
                            <>
                                <div className="text-2xl font-bold">
                                    {stats.growthRate > 0 ? "+" : ""}
                                    {stats.growthRate.toFixed(1)}%
                                </div>
                                <p className="text-xs text-muted-foreground">Monthly company onboarding growth</p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Pending Approvals & Recent Activity */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Pending Company Approvals</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {approvalsLoading ? (
                            <div className="text-sm text-muted-foreground">Loading approvals...</div>
                        ) : approvals.length === 0 ? (
                            <div className="text-sm text-muted-foreground">No pending approvals</div>
                        ) : (
                            <div className="space-y-4">
                                {approvals.map((approval) => (
                                    <div key={approval.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                                        <div>
                                            <p className="font-medium">{approval.name}</p>
                                            <p className="text-sm text-muted-foreground">{approval.email}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Registered: {formatDate(approval.createdAt)}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => onReject(approval.id)}
                                                disabled={processingId === approval.id}
                                            >
                                                {processingId === approval.id ? "..." : "Reject"}
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => onApprove(approval.id)}
                                                disabled={processingId === approval.id}
                                            >
                                                {processingId === approval.id ? "..." : "Approve"}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {activitiesLoading ? (
                            <div className="text-sm text-muted-foreground">Loading activities...</div>
                        ) : activities.length === 0 ? (
                            <div className="text-sm text-muted-foreground">No recent activity</div>
                        ) : (
                            <div className="space-y-3 text-sm">
                                {activities.map((activity) => (
                                    <div key={activity.id} className="flex justify-between">
                                        <span className="text-muted-foreground">{activity.description}</span>
                                        <span className="font-medium">{activity.relativeTime}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
