"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, MoreHorizontal, UserPlus } from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useConsultations, ConsultationRequest } from "@/hooks/useConsultations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { getDb } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

interface Employee {
    id: string;
    name: string;
}

export default function ConsultationRequestsPage() {
    const { tenant } = useTenantAuth();
    const { requests, stats, loading, updateRequest, convertToLead } = useConsultations(tenant?.id || null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [convertingId, setConvertingId] = useState<string | null>(null);

    const handleConvertToLead = useCallback(async (requestId: string) => {
        setConvertingId(requestId);
        try {
            await convertToLead(requestId);
        } catch (error) {
            console.error("Error converting:", error);
        } finally {
            setConvertingId(null);
        }
    }, [convertToLead]);

    useEffect(() => {
        const fetchEmployees = async () => {
            if (!tenant?.id) return;
            try {
                const db = getDb();
                const employeesRef = collection(db, `tenants/${tenant.id}/employees`);
                const empSnap = await getDocs(employeesRef);

                const empList = empSnap.docs.map(d => ({
                    id: d.id,
                    name: d.data().full_name || d.data().name || "Unknown",
                }));
                setEmployees(empList);
            } catch (error) {
                console.error("Error fetching employees:", error);
            }
        };
        fetchEmployees();
    }, [tenant?.id]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case "new": return "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-50";
            case "contacted": return "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-50 uppercase text-[10px] font-bold";
            case "closed": return "bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-50";
            default: return "bg-gray-100 text-gray-700 hover:bg-gray-100";
        }
    };

    const handleAssign = async (requestId: string, employeeId: string) => {
        await updateRequest(requestId, {
            assignedTo: employeeId,
            status: "contacted" // Auto-update status to contacted/in-progress
        });
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading requests...</div>;
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Consultation Requests</h1>
                <p className="text-gray-500 text-sm">Manage incoming design leads and requests</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="border-none shadow-sm bg-blue-50/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">New Requests</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-blue-600">{stats.new}</div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">In Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-gray-900">{stats.inProgress}</div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-green-50/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Conversion Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-green-600">{stats.conversionRate}%</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {requests.length === 0 ? (
                        <div className="p-12 text-center">
                            <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">No consultation requests yet</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50 hover:bg-transparent">
                                    <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Client Name</TableHead>
                                    <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Assigned To</TableHead>
                                    <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Phone</TableHead>
                                    <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Requirement</TableHead>
                                    <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Status</TableHead>
                                    <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Date</TableHead>
                                    <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requests.map((request) => (
                                    <TableRow key={request.id} className="hover:bg-gray-50">
                                        <TableCell>
                                            <p className="font-semibold text-gray-900">{request.clientName}</p>
                                            <Badge variant="secondary" className="bg-purple-50 text-purple-600 border-none uppercase text-[9px] font-bold px-2 py-0.5 mt-1">
                                                {request.source || "website"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="w-[180px]">
                                                <Select
                                                    value={request.assignedTo || "unassigned"}
                                                    onValueChange={(val) => handleAssign(request.id, val)}
                                                >
                                                    <SelectTrigger className="h-8 text-xs bg-white">
                                                        <SelectValue placeholder="Assign..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="unassigned" disabled>Assign to...</SelectItem>
                                                        {employees.map(emp => (
                                                            <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-gray-600 font-mono text-xs">
                                            {request.phone || "-"}
                                        </TableCell>
                                        <TableCell>
                                            <p className="text-sm text-gray-600 line-clamp-2 max-w-[250px]">{request.requirement}</p>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn("px-3 py-1 capitalize", getStatusColor(request.status))}>
                                                {request.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-gray-500 text-sm">
                                            {request.createdAt ? new Date(request.createdAt).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric"
                                            }) : "-"}
                                        </TableCell>
                                        <TableCell>
                                            {request.status !== "closed" && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs gap-1"
                                                    disabled={convertingId === request.id}
                                                    onClick={() => handleConvertToLead(request.id)}
                                                >
                                                    <UserPlus className="h-3 w-3" />
                                                    {convertingId === request.id ? "Converting..." : "Convert to Lead"}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
