"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFirebaseAuth, getDb } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { ShieldCheck, Mail, Lock, User, Loader2, ChevronLeft } from "lucide-react";

export default function AdminSignupPage() {
    const { user, isAuthenticated, loading: authLoading } = useAdminAuth();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (isAuthenticated && !authLoading) {
            router.push("/admin/dashboard");
        }
    }, [isAuthenticated, authLoading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (!formData.name || !formData.email || !formData.password) {
                setError("Please fill in all required fields");
                setLoading(false);
                return;
            }

            if (formData.password.length < 6) {
                setError("Password must be at least 6 characters");
                setLoading(false);
                return;
            }

            if (formData.password !== formData.confirmPassword) {
                setError("Passwords do not match");
                setLoading(false);
                return;
            }

            const auth = getFirebaseAuth();
            const db = getDb();

            // Create Firebase Auth account
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                formData.email,
                formData.password
            );

            // Create Super Admin record in 'users' collection
            await setDoc(doc(db, "users", userCredential.user.uid), {
                name: formData.name,
                email: formData.email,
                role: "superadmin",
                is_super_admin: true,
                created_at: new Date().toISOString(),
            });

            setSuccess(true);

            setTimeout(() => {
                router.push("/admin/dashboard");
            }, 2000);
        } catch (err: any) {
            console.error("Admin signup error:", err);
            if (err.code === "auth/email-already-in-use") {
                setError("This email is already registered as an admin.");
            } else {
                setError(err.message || "Failed to create admin account");
            }
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
                <Card className="w-full max-w-md border-t-4 border-t-green-500 shadow-2xl">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                            <ShieldCheck className="h-8 w-8 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-slate-900">Admin Registered!</CardTitle>
                        <CardDescription className="text-slate-500">
                            Your Super Admin account has been created successfully.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-sm text-slate-400 mb-6">
                            Redirecting you to the platform control center...
                        </p>
                        <div className="flex justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
            <div className="absolute top-8 left-8">
                <Link href="/admin/login" className="flex items-center text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back to Login
                </Link>
            </div>

            <Card className="w-full max-w-lg shadow-2xl border-none ring-1 ring-slate-200">
                <CardHeader className="space-y-1 text-center pb-8 border-b bg-white rounded-t-xl">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 shadow-lg">
                        <ShieldCheck className="h-7 w-7 text-blue-400" />
                    </div>
                    <CardTitle className="text-3xl font-extrabold tracking-tight text-slate-900">
                        Create Admin Account
                    </CardTitle>
                    <CardDescription className="text-slate-500 font-medium">
                        Establish your platform master credentials
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 gap-5">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-slate-700 font-semibold ml-1 text-sm">Full Name</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <Input
                                        id="name"
                                        placeholder="Admin Name"
                                        className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-700 font-semibold ml-1 text-sm">Work Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="admin@antigravity.com"
                                        className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-slate-700 font-semibold ml-1 text-sm">Password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="••••••••"
                                            className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword" className="text-slate-700 font-semibold ml-1 text-sm">Confirm</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                        <Input
                                            id="confirmPassword"
                                            type="password"
                                            placeholder="••••••••"
                                            className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                                            value={formData.confirmPassword}
                                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-lg bg-red-50 border border-red-100 p-4 text-sm text-red-600 font-medium animate-in fade-in slide-in-from-top-2">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-12 bg-slate-900 hover:bg-black text-white font-bold text-lg shadow-xl shadow-slate-200 transition-all active:scale-[0.98]"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span>Creating Master Account...</span>
                                </div>
                            ) : (
                                "Register Super Admin"
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-slate-500">
                            Already have an admin account?{" "}
                            <Link href="/admin/login" className="text-blue-600 hover:underline font-bold">
                                Sign In
                            </Link>
                        </p>
                    </div>

                    <div className="mt-10 flex flex-col items-center gap-2 opacity-30">
                        <div className="flex items-center text-[10px] text-slate-700 gap-1 uppercase tracking-[0.2em] font-black">
                            Security Protocol V2.0
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
