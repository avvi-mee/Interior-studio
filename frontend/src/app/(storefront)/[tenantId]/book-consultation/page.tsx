"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, X } from "lucide-react";
import ConsultationForm from "@/components/storefront/ConsultationForm";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { resolveTenant, Tenant } from "@/lib/firestoreHelpers";

export default function BookConsultationPage({ params }: { params: Promise<{ tenantId: string }> }) {
    const { tenantId: storeSlug } = use(params);

    const router = useRouter();
    const { customer, loading: authLoading } = useCustomerAuth();

    const [resolvedTenant, setResolvedTenant] = useState<Tenant | null>(null);
    const [tenantLoading, setTenantLoading] = useState(true);
    const [resolutionError, setResolutionError] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false); // Keep this state for success message

    useEffect(() => {
        let isMounted = true;
        const loadTenant = async () => {
            if (!storeSlug) {
                if (isMounted) setTenantLoading(false);
                return;
            }
            try {
                // Try lowercase first as it's the standard for storeIds
                const tenant = await resolveTenant(storeSlug);
                if (tenant) {
                    if (isMounted) setResolvedTenant(tenant);
                } else {
                    if (isMounted) setResolutionError(true);
                }
            } catch (error) {
                console.error("Error resolving tenant:", error);
                if (isMounted) setResolutionError(true);
            } finally {
                if (isMounted) setTenantLoading(false);
            }
        };
        loadTenant();

        return () => { isMounted = false; };
    }, [storeSlug]);

    if (authLoading || tenantLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-gray-500 font-medium">Loading...</p>
            </div>
        );
    }

    if (resolutionError || (!resolvedTenant && !tenantLoading)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen py-20 space-y-6 text-center px-4">
                <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center">
                    <X className="h-10 w-10 text-red-500" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-gray-900">Store Not Found</h2>
                    <p className="text-gray-500 max-w-md mx-auto">
                        We couldn&apos;t find the company profile you&apos;re looking for. Please check the URL and try again.
                    </p>
                </div>
                <Button onClick={() => router.push("/")} variant="outline" className="rounded-xl px-8 h-12">
                    Go Back Home
                </Button>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="container mx-auto px-4 py-24 flex justify-center min-h-screen items-center">
                <Card className="max-w-md w-full text-center border-none shadow-2xl rounded-[40px] overflow-hidden">
                    <CardHeader className="pt-12">
                        <div className="flex justify-center mb-6">
                            <div className="h-24 w-24 rounded-full bg-green-50 flex items-center justify-center ring-8 ring-green-50/50">
                                <CheckCircle2 className="h-12 w-12 text-green-500" />
                            </div>
                        </div>
                        <CardTitle className="text-3xl font-bold">Request Received!</CardTitle>
                        <CardDescription className="text-lg pt-2 leading-relaxed">
                            Thank you for reaching out. Our design experts will contact you within 24 hours to discuss your dream project.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-12 px-10">
                        <Button
                            onClick={() => router.push(`/${storeSlug}`)}
                            className="w-full h-14 text-lg rounded-2xl bg-black hover:bg-black/90 text-white transition-all transform hover:scale-[1.02]"
                        >
                            Back to Website
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center py-20 px-4">
            <div className="max-w-4xl w-full grid md:grid-cols-5 bg-white rounded-[40px] shadow-2xl overflow-hidden">
                {/* Info Sidebar */}
                <div className="md:col-span-2 bg-[#0F172A] p-10 text-white flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10 space-y-8">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-bold leading-tight">Let&apos;s Create Your Dream Space</h1>
                            <p className="text-gray-400 text-lg leading-relaxed">
                                Book a complimentary design consultation with our experts and start your transformation journey.
                            </p>
                        </div>

                        <div className="space-y-6 pt-4">
                            <div className="flex items-center gap-4 group">
                                <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user h-6 w-6 text-blue-400"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Personal Advisor</p>
                                    <p className="font-semibold italic font-serif">Dedicated Design Expert</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 group">
                                <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                    <CheckCircle2 className="h-6 w-6 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">The Outcome</p>
                                    <p className="font-semibold italic font-serif">Custom Layout & Moodboard</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Decorative element */}
                    <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl"></div>
                </div>

                {/* Form Section */}
                <div className="md:col-span-3 p-10 md:p-14">
                    <ConsultationForm
                        tenantId={resolvedTenant!.id}
                        storeId={storeSlug}
                        customer={customer}
                        onSuccess={() => setIsSuccess(true)}
                    />
                    <p className="mt-8 text-center text-xs text-gray-400">
                        By clicking, you agree to our contact terms and privacy policy.
                    </p>
                </div>
            </div>
        </div>
    );
}
