"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { Lock, User, Briefcase } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFirebaseAuth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function TenantLoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { login, loading: designerLoading, error: designerError, isAuthenticated } = useTenantAuth();

    // Employee Login State
    const [employeeLoading, setEmployeeLoading] = useState(false);
    const [employeeError, setEmployeeError] = useState("");

    const router = useRouter();

    // Redirect if already logged in (Designer)
    useEffect(() => {
        if (isAuthenticated) {
            router.push("/dashboard");
        }
    }, [isAuthenticated, router]);

    // Check for employee session
    useEffect(() => {
        const empSession = sessionStorage.getItem("employeeSession");
        if (empSession) {
            router.push("/employee-dashboard");
        }
    }, [router]);

    const handleDesignerLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await login(email, password);
        if (success) {
            router.push("/dashboard");
        }
    };

    const handleEmployeeLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmployeeLoading(true);
        setEmployeeError("");

        const auth = getFirebaseAuth();
        try {
            // Step 1: Sign in with Firebase Auth to get an ID token
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const idToken = await userCredential.user.getIdToken();

            // Step 2: Server-side lookup — Admin SDK bypasses Firestore security rules
            const res = await fetch("/api/auth/employee-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setEmployeeError(data.error || "Login failed. Please try again.");
                await auth.signOut();
                return;
            }

            const { employee } = await res.json();
            sessionStorage.setItem("employeeSession", JSON.stringify(employee));
            router.push("/employee-dashboard");

        } catch (error: any) {
            console.error("Employee login error:", error);
            await auth.signOut().catch(() => {});
            if (
                error.code === "auth/user-not-found" ||
                error.code === "auth/wrong-password" ||
                error.code === "auth/invalid-credential"
            ) {
                setEmployeeError("Invalid email or password.");
            } else {
                setEmployeeError("Login failed. Please try again.");
            }
        } finally {
            setEmployeeLoading(false);
        }
    };

    if (isAuthenticated) return null;

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#0F172A]/10">
                        <Lock className="h-6 w-6 text-[#0F172A]" />
                    </div>
                    <CardTitle className="text-2xl">Client & Team Portal</CardTitle>
                    <CardDescription>
                        Secure access for designers and employees
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="designer" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                            <TabsTrigger value="designer">Designer</TabsTrigger>
                            <TabsTrigger value="employee">Employee</TabsTrigger>
                        </TabsList>

                        <TabsContent value="designer">
                            <form onSubmit={handleDesignerLogin} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="d-email">Designer Email</Label>
                                    <div className="relative">
                                        <Briefcase className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                        <Input
                                            id="d-email"
                                            className="pl-9"
                                            type="email"
                                            placeholder="designer@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            disabled={designerLoading}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="d-password">Password</Label>
                                        <Link href="/forgot-password" className="text-sm text-[#0F172A] hover:underline">
                                            Forgot password?
                                        </Link>
                                    </div>
                                    <Input
                                        id="d-password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={designerLoading}
                                    />
                                </div>
                                {designerError && (
                                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                                        {designerError}
                                    </div>
                                )}
                                <Button type="submit" className="w-full bg-[#0F172A]" disabled={designerLoading}>
                                    {designerLoading ? "Signing in..." : "Designer Sign In"}
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="employee">
                            <form onSubmit={handleEmployeeLogin} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="e-email">Employee Email</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                        <Input
                                            id="e-email"
                                            className="pl-9"
                                            type="email"
                                            placeholder="employee@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            disabled={employeeLoading}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="e-password">Access Password</Label>
                                    <Input
                                        id="e-password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={employeeLoading}
                                    />
                                </div>
                                {employeeError && (
                                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                                        {employeeError}
                                    </div>
                                )}
                                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={employeeLoading}>
                                    {employeeLoading ? "Verifying..." : "Employee Sign In"}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>

                    <div className="mt-6 pt-4 border-t border-gray-100 text-center text-sm">
                        <p className="text-muted-foreground">
                            Don't have an account?{" "}
                            <Link href="/signup" className="text-[#0F172A] hover:underline font-medium">
                                Create Designer Account
                            </Link>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div >
    );
}
