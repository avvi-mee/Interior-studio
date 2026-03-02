"use client";

import { useState, useEffect } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { getDb, getFirebaseAuth } from "@/lib/firebase";
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from "firebase/firestore";
import { Plus, Trash2, Edit, Loader2, KeyRound, ShieldCheck, ShieldOff, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const ROLE_OPTIONS = [
    { value: "sales", label: "Sales" },
    { value: "designer", label: "Designer" },
    { value: "project_manager", label: "Project Manager" },
    { value: "site_supervisor", label: "Site Supervisor" },
    { value: "accountant", label: "Accountant" },
] as const;

interface Employee {
    id: string;
    name: string;
    email: string;
    area: string;
    phone: string;
    totalWork: number;
    currentWork: string;
    upcomingWork?: string;
    role?: string;
    roles?: string[];
    primaryRole?: string;
    tenantId: string;
    createdAt?: string;
    hasLoginAccess: boolean;
}

export default function EmployeesPage() {
    const { tenant, loading: authLoading } = useTenantAuth();
    const { toast } = useToast();

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    // ── Edit Employee dialog ────────────────────────────────────────────────
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [editForm, setEditForm] = useState({
        name: "", email: "", area: "", phone: "",
        totalWork: 0, currentWork: "None", upcomingWork: "None",
        primaryRole: "designer" as string, roles: ["designer"] as string[],
    });

    // ── Grant Access dialog ─────────────────────────────────────────────────
    const [isAccessOpen, setIsAccessOpen] = useState(false);
    const [accessEmployee, setAccessEmployee] = useState<Employee | null>(null);
    const [accessPassword, setAccessPassword] = useState("");
    const [accessConfirm, setAccessConfirm] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [accessLoading, setAccessLoading] = useState(false);

    // ── Snapshot ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!tenant?.id) return;
        const db = getDb();
        // No orderBy — legacy docs use created_at (string) while new docs use
        // joinedAt (serverTimestamp). Firestore excludes docs missing the ordered
        // field, so omit ordering to show ALL employees.
        const q = query(collection(db, `tenants/${tenant.id}/employees`));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => {
                const r = d.data();
                return {
                    id: d.id,
                    name: r.full_name || r.fullName || r.name || "",
                    email: r.email || "",
                    area: r.area || "",
                    phone: r.phone || "",
                    totalWork: r.total_work || 0,
                    currentWork: r.current_work || "None",
                    upcomingWork: r.upcoming_work || "None",
                    role: r.role_names?.[0] || r.roles?.[0] || r.role || "designer",
                    roles: r.role_names || r.roles || (r.role ? [r.role] : []),
                    primaryRole: r.role_names?.[0] || r.roles?.[0] || r.role || "designer",
                    tenantId: r.tenant_id || r.tenantId || tenant.id,
                    createdAt: r.created_at || r.createdAt,
                    hasLoginAccess: !!(r.userId),
                };
            });
            // Sort client-side: most recent first, falling back across field variants
            list.sort((a, b) => {
                const ta = a.createdAt ? new Date(a.createdAt?.toDate?.() ?? a.createdAt).getTime() : 0;
                const tb = b.createdAt ? new Date(b.createdAt?.toDate?.() ?? b.createdAt).getTime() : 0;
                return tb - ta;
            });
            setEmployees(list);
            setLoading(false);
        });
        return () => unsub();
    }, [tenant?.id]);

    // ── Open Edit ────────────────────────────────────────────────────────────
    const openEdit = (emp?: Employee) => {
        if (emp) {
            setEditingEmployee(emp);
            setEditForm({
                name: emp.name, email: emp.email, area: emp.area, phone: emp.phone,
                totalWork: emp.totalWork, currentWork: emp.currentWork,
                upcomingWork: emp.upcomingWork || "None",
                primaryRole: emp.primaryRole || emp.role || "designer",
                roles: emp.roles || (emp.role ? [emp.role] : ["designer"]),
            });
        } else {
            setEditingEmployee(null);
            setEditForm({
                name: "", email: "", area: "", phone: "",
                totalWork: 0, currentWork: "None", upcomingWork: "None",
                primaryRole: "designer", roles: ["designer"],
            });
        }
        setIsEditOpen(true);
    };

    // ── Open Grant Access ────────────────────────────────────────────────────
    const openAccess = (emp: Employee) => {
        setAccessEmployee(emp);
        setAccessPassword("");
        setAccessConfirm("");
        setShowPwd(false);
        setShowConfirm(false);
        setIsAccessOpen(true);
    };

    // ── Submit Edit ──────────────────────────────────────────────────────────
    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenant?.id) return;
        try {
            const db = getDb();
            const payload = {
                area: editForm.area,
                total_work: editForm.totalWork,
                current_work: editForm.currentWork,
                upcoming_work: editForm.upcomingWork,
                is_active: true,
                name: editForm.name,
                full_name: editForm.name,
                email: editForm.email,
                phone: editForm.phone,
                role: editForm.primaryRole,
                roles: editForm.roles,
                role_names: editForm.roles,
                tenant_id: tenant.id,
            };

            if (editingEmployee) {
                await updateDoc(doc(db, `tenants/${tenant.id}/employees`, editingEmployee.id), payload);
                toast({ title: "Success", description: "Employee updated successfully." });
            } else {
                await addDoc(collection(db, `tenants/${tenant.id}/employees`), {
                    ...payload,
                    created_at: new Date().toISOString(),
                });
                toast({ title: "Employee added", description: "Use the key icon to grant login access." });
            }
            setIsEditOpen(false);
        } catch {
            toast({ title: "Error", description: "Failed to save employee.", variant: "destructive" });
        }
    };

    // ── Submit Grant Access ──────────────────────────────────────────────────
    const handleGrantAccess = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenant?.id || !accessEmployee) return;

        if (accessPassword.length < 6) {
            toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
            return;
        }
        if (accessPassword !== accessConfirm) {
            toast({ title: "Passwords don't match", description: "Please make sure both passwords are the same.", variant: "destructive" });
            return;
        }

        setAccessLoading(true);
        try {
            const idToken = await getFirebaseAuth().currentUser?.getIdToken();
            const res = await fetch("/api/auth/set-employee-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    tenantId: tenant.id,
                    email: accessEmployee.email,
                    password: accessPassword,
                }),
            });
            const result = await res.json();
            if (!res.ok) {
                toast({ title: "Failed", description: result.error || "Could not grant access.", variant: "destructive" });
                return;
            }
            toast({
                title: result.created ? "Access granted!" : "Password updated!",
                description: result.created
                    ? `${accessEmployee.name} can now log in with their email and the new password.`
                    : `${accessEmployee.name}'s password has been updated.`,
            });
            setIsAccessOpen(false);
        } catch {
            toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
        } finally {
            setAccessLoading(false);
        }
    };

    // ── Delete ───────────────────────────────────────────────────────────────
    const handleDelete = async (id: string) => {
        if (!tenant?.id || !confirm("Remove this team member?")) return;
        try {
            await deleteDoc(doc(getDb(), `tenants/${tenant.id}/employees`, id));
            toast({ title: "Removed", description: "Team member removed." });
        } catch {
            toast({ title: "Error", description: "Failed to remove.", variant: "destructive" });
        }
    };

    if (authLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
                    <p className="text-muted-foreground">Manage your team members and assign tasks.</p>
                </div>
                <Button onClick={() => openEdit()} className="bg-[#0F172A]">
                    <Plus className="mr-2 h-4 w-4" /> Add Employee
                </Button>
            </div>

            {/* ── Table ── */}
            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Area</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Current Work</TableHead>
                            <TableHead>Login Access</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                </TableCell>
                            </TableRow>
                        ) : employees.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    No employees found. Add one to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            employees.map((emp) => (
                                <TableRow key={emp.id}>
                                    <TableCell className="font-medium">
                                        <div>{emp.name}</div>
                                        <div className="text-xs text-gray-400">{emp.email}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {(emp.roles || [emp.role || "designer"]).map((r) => (
                                                <Badge key={r} variant="secondary" className="text-xs capitalize">
                                                    {r?.replace(/_/g, " ")}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>{emp.area}</TableCell>
                                    <TableCell>{emp.phone}</TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${emp.currentWork !== "None" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                                            {emp.currentWork}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {emp.hasLoginAccess ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                                <ShieldCheck className="h-3 w-3" />
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
                                                <ShieldOff className="h-3 w-3" />
                                                No Access
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                title={emp.hasLoginAccess ? "Manage / Reset Password" : "Grant Login Access"}
                                                className={emp.hasLoginAccess ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-amber-600 hover:text-amber-700 hover:bg-amber-50"}
                                                onClick={() => openAccess(emp)}
                                            >
                                                <KeyRound className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => openEdit(emp)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost" size="sm"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleDelete(emp.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* ── Edit / Add Employee Dialog ── */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingEmployee ? "Edit Employee" : "Add New Employee"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input id="name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="area">Area/Location</Label>
                                <Input id="area" value={editForm.area} onChange={(e) => setEditForm({ ...editForm, area: e.target.value })} required />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input id="phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email (Login ID)</Label>
                            <Input id="email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="primaryRole">Primary Role</Label>
                            <Select
                                value={editForm.primaryRole}
                                onValueChange={(value) => {
                                    const newRoles = editForm.roles.includes(value) ? editForm.roles : [...editForm.roles, value];
                                    setEditForm({ ...editForm, primaryRole: value, roles: newRoles });
                                }}
                            >
                                <SelectTrigger><SelectValue placeholder="Select role..." /></SelectTrigger>
                                <SelectContent>
                                    {ROLE_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Additional Roles</Label>
                            <div className="flex flex-wrap gap-2">
                                {ROLE_OPTIONS.filter(o => o.value !== editForm.primaryRole).map((opt) => {
                                    const isSel = editForm.roles.includes(opt.value);
                                    return (
                                        <button
                                            key={opt.value} type="button"
                                            onClick={() => {
                                                const nr = isSel ? editForm.roles.filter(r => r !== opt.value) : [...editForm.roles, opt.value];
                                                setEditForm({ ...editForm, roles: nr });
                                            }}
                                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${isSel ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="totalWork">Total Works</Label>
                                <Input id="totalWork" type="number" value={editForm.totalWork} onChange={(e) => setEditForm({ ...editForm, totalWork: parseInt(e.target.value) || 0 })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="currentWork">Current Work</Label>
                                <Input id="currentWork" value={editForm.currentWork} onChange={(e) => setEditForm({ ...editForm, currentWork: e.target.value })} />
                            </div>
                        </div>
                        {!editingEmployee && (
                            <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                                After adding, click the <KeyRound className="inline h-3 w-3" /> key icon to grant this employee login access.
                            </p>
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-[#0F172A]">{editingEmployee ? "Update Employee" : "Add Employee"}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Grant / Reset Access Dialog ── */}
            <Dialog open={isAccessOpen} onOpenChange={setIsAccessOpen}>
                <DialogContent className="sm:max-w-[380px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-amber-600" />
                            {accessEmployee?.hasLoginAccess ? "Manage Login Access" : "Grant Login Access"}
                        </DialogTitle>
                    </DialogHeader>

                    {accessEmployee && (
                        <form onSubmit={handleGrantAccess} className="space-y-5 pt-2">
                            {/* Employee info card */}
                            <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-[#0F172A] flex items-center justify-center text-white text-sm font-semibold shrink-0">
                                    {accessEmployee.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{accessEmployee.name}</p>
                                    <p className="text-xs text-gray-500">{accessEmployee.email}</p>
                                </div>
                                <div className="ml-auto">
                                    {accessEmployee.hasLoginAccess ? (
                                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                            <ShieldCheck className="h-3 w-3" /> Active
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                                            <ShieldOff className="h-3 w-3" /> No Access
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="acc-pwd">
                                    {accessEmployee.hasLoginAccess ? "New Password" : "Create Password"}
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="acc-pwd"
                                        type={showPwd ? "text" : "password"}
                                        autoComplete="new-password"
                                        placeholder="Minimum 6 characters"
                                        value={accessPassword}
                                        onChange={(e) => setAccessPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="pr-10"
                                    />
                                    <button type="button" tabIndex={-1} onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="acc-confirm">Confirm Password</Label>
                                <div className="relative">
                                    <Input
                                        id="acc-confirm"
                                        type={showConfirm ? "text" : "password"}
                                        autoComplete="new-password"
                                        placeholder="Re-enter password"
                                        value={accessConfirm}
                                        onChange={(e) => setAccessConfirm(e.target.value)}
                                        required
                                        className="pr-10"
                                    />
                                    <button type="button" tabIndex={-1} onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {accessConfirm && accessPassword !== accessConfirm && (
                                    <p className="text-xs text-red-500">Passwords don&apos;t match.</p>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                                <Button type="button" variant="outline" onClick={() => setIsAccessOpen(false)}>Cancel</Button>
                                <Button
                                    type="submit"
                                    disabled={accessLoading || !accessPassword || accessPassword !== accessConfirm}
                                    className="bg-green-600 hover:bg-green-700 text-white gap-2"
                                >
                                    {accessLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                    {accessEmployee.hasLoginAccess ? "Update Password" : "Grant Access"}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
