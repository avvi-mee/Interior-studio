"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Briefcase, User, Search, CheckCircle2 } from "lucide-react";
import { getDb } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface TenantInfo {
    id: string;
    name: string;
    ownerName: string;
    email: string;
}

export default function EmployeeRegisterPage() {
    const router = useRouter();
    const { toast } = useToast();

    // Step 1: Find Designer
    const [designerEmail, setDesignerEmail] = useState("");
    const [searching, setSearching] = useState(false);
    const [foundTenant, setFoundTenant] = useState<TenantInfo | null>(null);
    const [searchError, setSearchError] = useState("");

    // Step 2: Register Details
    const [registerStep, setRegisterStep] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        area: "",
        password: "",
        confirmPassword: ""
    });
    const [loading, setLoading] = useState(false);

    const handleSearchDesigner = async (e: React.FormEvent) => {
        e.preventDefault();
        setSearching(true);
        setSearchError("");
        setFoundTenant(null);

        try {
            const db = getDb();
            const tenantsRef = collection(db, "tenants");
            const tenantQuery = query(tenantsRef, where("email", "==", designerEmail), limit(1));
            const tenantSnap = await getDocs(tenantQuery);

            if (tenantSnap.empty) {
                setSearchError("No designer found with this email.");
            } else {
                const tenantDoc = tenantSnap.docs[0];
                const data = tenantDoc.data();
                setFoundTenant({
                    id: tenantDoc.id,
                    name: data.name,
                    ownerName: data.name,
                    email: data.email,
                });
            }
        } catch (error) {
            console.error("Error searching tenant:", error);
            setSearchError("Error searching for designer. Please try again.");
        } finally {
            setSearching(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!foundTenant) return;

        if (formData.password !== formData.confirmPassword) {
            toast({
                title: "Passwords do not match",
                description: "Please check your password confirmation.",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);

        try {
            // Call API route to create employee with proper Firebase Auth account
            const response = await fetch("/api/employee-register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tenantId: foundTenant.id,
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    area: formData.area,
                    password: formData.password,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Registration failed");
            }

            toast({
                title: "Registration Successful",
                description: "Your account has been created. You can now login.",
            });

            setTimeout(() => {
                router.push("/login");
            }, 1000);
        } catch (error: any) {
            console.error("Registration error:", error);
            toast({
                title: "Registration Failed",
                description: error.message || "Something went wrong. Please try again.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
            <Card className="w-full max-w-lg">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                        <User className="h-6 w-6 text-emerald-600" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">Employee Registration</CardTitle>
                    <CardDescription>
                        Join a designer's team and manage your work
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                    {/* Step 1: Find Designer */}
                    {!registerStep && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-blue-50 p-4 rounded-md border border-blue-100 text-sm text-blue-800">
                                <p className="font-medium mb-1">Find your Team Lead</p>
                                <p>Enter the email address of the Designer you work for to connect your account.</p>
                            </div>

                            <form onSubmit={handleSearchDesigner} className="space-y-3">
                                <div className="space-y-2">
                                    <Label htmlFor="designer-email">Designer's Email</Label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Briefcase className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                            <Input
                                                id="designer-email"
                                                className="pl-9"
                                                type="email"
                                                placeholder="designer@company.com"
                                                value={designerEmail}
                                                onChange={(e) => setDesignerEmail(e.target.value)}
                                                required
                                                disabled={searching}
                                            />
                                        </div>
                                        <Button type="submit" disabled={searching || !designerEmail}>
                                            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    {searchError && <p className="text-sm text-red-500 mt-1">{searchError}</p>}
                                </div>
                            </form>

                            {foundTenant && (
                                <div className="mt-4 border rounded-lg p-4 bg-gray-50 flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-gray-900">{foundTenant.name || "Unnamed Business"}</p>
                                        <p className="text-sm text-gray-500">{foundTenant.ownerName}</p>
                                        <p className="text-xs text-gray-400">{foundTenant.email}</p>
                                    </div>
                                    <Button
                                        onClick={() => setRegisterStep(true)}
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                    >
                                        Join Team
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Register Form */}
                    {registerStep && foundTenant && (
                        <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in slide-in-from-right-8 duration-500">
                            <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-md text-sm mb-4">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Joining: <strong>{foundTenant.name}</strong></span>
                                <Button
                                    variant="link"
                                    className="ml-auto h-auto p-0 text-emerald-800 underline"
                                    onClick={() => setRegisterStep(false)}
                                >
                                    Change
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="area">Area/Location</Label>
                                    <Input
                                        id="area"
                                        value={formData.area}
                                        onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="reg-email">Your Email (Login ID)</Label>
                                <Input
                                    id="reg-email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirm-password">Confirm PW</Label>
                                    <Input
                                        id="confirm-password"
                                        type="password"
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2" disabled={loading}>
                                {loading ? "Creating Account..." : "Create Account"}
                            </Button>
                        </form>
                    )}

                    <div className="mt-6 pt-4 border-t border-gray-100 text-center text-sm">
                        <p className="text-muted-foreground">
                            Already have an account?{" "}
                            <Link href="/login" className="text-emerald-600 hover:underline font-medium">
                                Back to Login
                            </Link>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function Loader2({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    )
}
