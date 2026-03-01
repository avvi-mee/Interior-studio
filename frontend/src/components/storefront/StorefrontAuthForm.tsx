"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus, LogIn, ArrowLeft, Eye, EyeOff, Mail, CheckCircle2 } from "lucide-react";

type AuthMode = "login" | "signup";
type SignupStep = "details" | "otp";

interface StorefrontAuthFormProps {
    tenantSlug: string;
    intent: "dashboard" | "estimate";
    websiteConfig: {
        primaryColor?: string;
        secondaryColor?: string;
        buttonRadius?: number;
        businessName?: string;
    } | null;
    /** Optional override: redirect here after auth instead of the intent default */
    redirectUrl?: string;
}

export function StorefrontAuthForm({ tenantSlug, intent, websiteConfig, redirectUrl }: StorefrontAuthFormProps) {
    const router = useRouter();

    const primaryColor = websiteConfig?.primaryColor || "#0F172A";
    const secondaryColor = websiteConfig?.secondaryColor || "#1E293B";
    const buttonRadius = websiteConfig?.buttonRadius || 12;

    const [mode, setMode] = useState<AuthMode>(intent === "dashboard" ? "login" : "signup");
    const [signupStep, setSignupStep] = useState<SignupStep>("details");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [otpCode, setOtpCode] = useState("");
    const [resendTimer, setResendTimer] = useState(0);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const finalRedirectUrl = redirectUrl
        ?? (intent === "estimate" ? `/${tenantSlug}/estimate/review` : `/${tenantSlug}/dashboard`);

    // Countdown timer for OTP resend
    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    // Redirect if already logged in
    useEffect(() => {
        const stored = localStorage.getItem(`storefront_user_${tenantSlug}`);
        if (stored) {
            try {
                const u = JSON.parse(stored);
                if (u.isLoggedIn) router.replace(finalRedirectUrl);
            } catch { }
        }
    }, [tenantSlug, router, finalRedirectUrl]);

    const storeSession = (uid: string, userName: string, userEmail: string, userPhone: string, idToken: string | null) => {
        const session = {
            uid,
            phone: userPhone,
            name: userName,
            email: userEmail,
            isLoggedIn: true,
            loginTime: Date.now(),
            idToken: idToken ?? null,  // NOTE: expires in 1 hour; refresh deferred to Phase 6
        };
        localStorage.setItem(`storefront_user_${tenantSlug}`, JSON.stringify(session));
        window.dispatchEvent(new StorageEvent("storage", {
            key: `storefront_user_${tenantSlug}`,
            newValue: JSON.stringify(session),
        }));
    };

    // ── SIGNUP: Step 1 — send OTP ────────────────────────────────────────────
    const handleSendOtp = async () => {
        if (!name.trim()) { setError("Please enter your name"); return; }
        if (!email.includes("@")) { setError("Please enter a valid email"); return; }
        if (phone.replace(/\D/g, "").length !== 10) { setError("Please enter a valid 10-digit phone number"); return; }
        if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

        setError("");
        setLoading(true);
        try {
            const res = await fetch("/api/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), name: name.trim() }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || "Failed to send verification code. Please try again.");
                return;
            }
            setSignupStep("otp");
            setResendTimer(60);
        } catch {
            setError("Network error. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    // ── SIGNUP: Step 2 — verify OTP + create account ─────────────────────────
    const handleVerifyAndCreate = async () => {
        if (otpCode.length !== 6) { setError("Please enter the 6-digit code from your email"); return; }

        setError("");
        setLoading(true);
        try {
            // Verify OTP first
            const verifyRes = await fetch("/api/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), otp: otpCode }),
            });
            const { verified, error: verifyError } = await verifyRes.json();
            if (!verified) {
                setError(verifyError || "Incorrect code. Please try again.");
                return;
            }

            // OTP verified — create account via server API (no client-side Firebase Auth SDK)
            const signupRes = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim(),
                    phone: phone.replace(/\D/g, ""),
                    password,
                }),
            });
            const signupData = await signupRes.json();

            if (!signupRes.ok) {
                if (signupData.error === "email_in_use") {
                    setError("An account with this email already exists. Please log in instead.");
                    setMode("login");
                    setSignupStep("details");
                } else {
                    setError(signupData.error || "Account creation failed. Please try again.");
                }
                return;
            }

            storeSession(signupData.uid, signupData.name, signupData.email, signupData.phone, signupData.idToken ?? null);

            // Send welcome email (fire-and-forget)
            fetch("/api/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "welcome",
                    name: name.trim(),
                    email: email.trim(),
                    tenantBusinessName: websiteConfig?.businessName || "",
                }),
            }).catch(() => { });

            router.push(finalRedirectUrl);
        } catch (err: any) {
            console.error("Signup error:", err);
            setError(err.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ── SIGNUP: Resend OTP ────────────────────────────────────────────────────
    const handleResendOtp = async () => {
        if (resendTimer > 0) return;
        setError("");
        setLoading(true);
        try {
            const res = await fetch("/api/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), name: name.trim() }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || "Failed to resend code.");
                return;
            }
            setOtpCode("");
            setResendTimer(60);
        } catch {
            setError("Failed to resend. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ── LOGIN ─────────────────────────────────────────────────────────────────
    const handleLogin = async () => {
        if (!email.includes("@")) { setError("Please enter a valid email"); return; }
        if (!password) { setError("Please enter your password"); return; }

        setError("");
        setLoading(true);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), password }),
            });
            const data = await res.json();

            if (!res.ok) {
                if (data.error === "invalid_credentials") {
                    setError("Invalid email or password. Please try again.");
                } else if (data.error === "too_many_attempts") {
                    setError("Too many failed attempts. Please try again later.");
                } else {
                    setError(data.error || "Login failed. Please try again.");
                }
                return;
            }

            storeSession(data.uid, data.name, data.email, data.phone, data.idToken ?? null);
            router.push(finalRedirectUrl);
        } catch (err: any) {
            console.error("Login error:", err);
            setError(err.message || "Login failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (mode === "login") { handleLogin(); return; }
        if (signupStep === "details") { handleSendOtp(); return; }
        handleVerifyAndCreate();
    };

    // ── OTP step UI ───────────────────────────────────────────────────────────
    if (mode === "signup" && signupStep === "otp") {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundColor: `${primaryColor}08` }}>
                <div className="w-full max-w-md">
                    <Card className="border-none shadow-2xl overflow-hidden" style={{ borderRadius: buttonRadius * 2 }}>
                        <CardHeader className="text-center pb-2 pt-10 px-8">
                            <div
                                className="mx-auto mb-6 h-16 w-16 rounded-full flex items-center justify-center text-white shadow-lg"
                                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                            >
                                <Mail className="h-8 w-8" />
                            </div>
                            <CardTitle className="text-2xl font-bold text-gray-900">Check your email</CardTitle>
                            <CardDescription className="text-gray-500 mt-2">
                                We sent a 6-digit code to
                            </CardDescription>
                            <p className="font-semibold text-gray-900 mt-1">{email}</p>
                        </CardHeader>

                        <CardContent className="px-8 pb-10 pt-6">
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                                        Verification Code
                                    </Label>
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        className="h-16 bg-gray-50 border-0 text-3xl font-bold tracking-[0.4em] text-center"
                                        style={{ borderRadius: buttonRadius }}
                                        placeholder="000000"
                                        maxLength={6}
                                        autoFocus
                                    />
                                </div>

                                {error && (
                                    <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">{error}</p>
                                )}

                                <Button
                                    type="submit"
                                    className="w-full text-white py-7 text-lg font-bold shadow-lg hover:shadow-xl transition-all"
                                    style={{ backgroundColor: primaryColor, borderRadius: buttonRadius * 2 }}
                                    disabled={loading || otpCode.length !== 6}
                                >
                                    {loading ? (
                                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verifying...</>
                                    ) : (
                                        <><CheckCircle2 className="mr-2 h-5 w-5" /> Verify & Create Account</>
                                    )}
                                </Button>

                                <div className="text-center space-y-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleResendOtp}
                                        disabled={resendTimer > 0 || loading}
                                        className="text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                                        style={{ color: primaryColor }}
                                    >
                                        {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend code"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => { setSignupStep("details"); setOtpCode(""); setError(""); }}
                                        className="flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-gray-600 w-full transition-colors"
                                    >
                                        <ArrowLeft className="h-3 w-3" /> Edit email or details
                                    </button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    // ── Details / Login step UI ───────────────────────────────────────────────
    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundColor: `${primaryColor}08` }}>
            <div className="w-full max-w-md">
                <Card className="border-none shadow-2xl overflow-hidden" style={{ borderRadius: buttonRadius * 2 }}>
                    <CardHeader className="text-center pb-2 pt-10 px-8">
                        <div
                            className="mx-auto mb-6 h-16 w-16 rounded-full flex items-center justify-center text-white shadow-lg"
                            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                        >
                            {mode === "signup" ? <UserPlus className="h-8 w-8" /> : <LogIn className="h-8 w-8" />}
                        </div>
                        <CardTitle className="text-2xl font-bold text-gray-900">
                            {mode === "signup" ? "Create Account" : "Welcome Back"}
                        </CardTitle>
                        <CardDescription className="text-gray-500 mt-2">
                            {mode === "signup"
                                ? (intent === "estimate"
                                    ? "Sign up to view and save your estimate"
                                    : "Create an account to access your dashboard")
                                : (intent === "estimate"
                                    ? "Log in to view your estimate"
                                    : "Log in to view your estimates and project updates")
                            }
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="px-8 pb-10 pt-6">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {mode === "signup" && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Full Name</Label>
                                    <Input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="h-14 bg-gray-50 border-0 rounded-xl px-4 text-lg"
                                        placeholder="John Doe"
                                        autoFocus
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Email</Label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="h-14 bg-gray-50 border-0 rounded-xl px-4 text-lg"
                                    placeholder="john@example.com"
                                    autoFocus={mode === "login"}
                                />
                            </div>

                            {mode === "signup" && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Phone Number</Label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400 font-medium text-lg pl-1">+91</span>
                                        <Input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                                                setPhone(val);
                                            }}
                                            className="h-14 bg-gray-50 border-0 rounded-xl px-4 text-lg font-medium tracking-wider"
                                            placeholder="98765 43210"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Password</Label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="h-14 bg-gray-50 border-0 rounded-xl px-4 pr-12 text-lg"
                                        placeholder={mode === "signup" ? "Min 6 characters" : "Enter password"}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">{error}</p>
                            )}

                            <Button
                                type="submit"
                                className="w-full text-white py-7 text-lg font-bold shadow-lg hover:shadow-xl transition-all"
                                style={{ backgroundColor: primaryColor, borderRadius: buttonRadius * 2 }}
                                disabled={loading}
                            >
                                {loading ? (
                                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        {mode === "signup" ? "Sending Code..." : "Logging In..."}
                                    </>
                                ) : mode === "signup" ? (
                                    "Continue — Verify Email"
                                ) : intent === "estimate" ? (
                                    "Log In & View Estimate"
                                ) : (
                                    "Log In to Dashboard"
                                )}
                            </Button>

                            <div className="text-center pt-2">
                                {mode === "signup" ? (
                                    <p className="text-sm text-gray-500">
                                        Already have an account?{" "}
                                        <button
                                            type="button"
                                            onClick={() => { setMode("login"); setError(""); setSignupStep("details"); }}
                                            className="font-semibold hover:underline"
                                            style={{ color: primaryColor }}
                                        >
                                            Log In
                                        </button>
                                    </p>
                                ) : (
                                    <p className="text-sm text-gray-500">
                                        Don&apos;t have an account?{" "}
                                        <button
                                            type="button"
                                            onClick={() => { setMode("signup"); setError(""); setSignupStep("details"); }}
                                            className="font-semibold hover:underline"
                                            style={{ color: primaryColor }}
                                        >
                                            Sign Up
                                        </button>
                                    </p>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-gray-600 w-full transition-colors pt-2"
                            >
                                <ArrowLeft className="h-3 w-3" /> Go back
                            </button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
