"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, Download, Calendar, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { generateEstimatePDF } from "@/lib/generateEstimatePdf";
import { usePublicWebsiteConfig } from "@/hooks/useWebsiteConfig";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { resolveTenant, Tenant } from "@/lib/firestoreHelpers";
import { getEstimateDraft, clearEstimateDraft, EstimateDraft } from "@/lib/estimateTypes";
import { calculateEstimate, BreakdownItem, CostSummary } from "@/lib/calculateEstimate";
import { getDb } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";

interface StorefrontUser {
    phone: string;
    name: string;
    email: string;
    isLoggedIn: boolean;
    loginTime: number;
}

export default function EstimateReviewPage({ params }: { params: Promise<{ tenantId: string }> }) {
    const { tenantId: tenantSlug } = use(params);
    const router = useRouter();

    const [resolvedTenant, setResolvedTenant] = useState<Tenant | null>(null);
    const [tenantLoading, setTenantLoading] = useState(true);
    const [draft, setDraft] = useState<EstimateDraft | null>(null);
    const [user, setUser] = useState<StorefrontUser | null>(null);

    const { config: websiteConfig, loading: websiteLoading } = usePublicWebsiteConfig(tenantSlug);
    const { config: pricingConfig, loading: pricingLoading } = usePricingConfig(resolvedTenant?.id || null);

    const primaryColor = websiteConfig?.primaryColor || "#0F172A";
    const secondaryColor = websiteConfig?.secondaryColor || "#1E293B";
    const buttonRadius = websiteConfig?.buttonRadius || 12;

    const [breakdownOpen, setBreakdownOpen] = useState(true);
    const [estimateId, setEstimateId] = useState<string | null>(null);
    const [pdfDownloading, setPdfDownloading] = useState(false);
    const autoSubmitFired = useRef(false);

    // Resolve tenant
    useEffect(() => {
        if (!tenantSlug) return;
        resolveTenant(tenantSlug)
            .then((t) => { if (t) setResolvedTenant(t); })
            .catch(console.error)
            .finally(() => setTenantLoading(false));
    }, [tenantSlug]);

    // Guard: check draft + login
    useEffect(() => {
        const storedDraft = getEstimateDraft(tenantSlug);
        if (!storedDraft) {
            router.replace(`/${tenantSlug}/estimate`);
            return;
        }
        setDraft(storedDraft);

        const storedUser = localStorage.getItem(`storefront_user_${tenantSlug}`);
        if (!storedUser) {
            router.replace(`/${tenantSlug}/login?next=/estimate/review`);
            return;
        }
        try {
            const parsed = JSON.parse(storedUser) as StorefrontUser;
            if (!parsed.isLoggedIn) {
                router.replace(`/${tenantSlug}/login?next=/estimate/review`);
                return;
            }
            setUser(parsed);
        } catch {
            router.replace(`/${tenantSlug}/login?next=/estimate/review`);
        }
    }, [tenantSlug, router]);

    const loading = tenantLoading || websiteLoading || pricingLoading;

    // Calculate estimate
    const estimateResult = draft && pricingConfig
        ? calculateEstimate(pricingConfig, {
            segment: draft.segment,
            selectedPlan: draft.plan,
            carpetArea: draft.carpetArea,
            livingAreaItems: draft.livingAreaItems,
            kitchenItems: draft.kitchenItems,
            bedrooms: draft.bedrooms,
            bathrooms: draft.bathrooms,
            cabins: draft.cabins
        })
        : { total: 0, breakdown: [] as BreakdownItem[], costSummary: { itemsSubtotal: 0, basePriceCost: 0, slabMultiplier: 1, subtotalAfterSlab: 0, gstAmount: 0, discountAmount: 0, designFeeAmount: 0, additionalCharges: [], grandTotal: 0 } as CostSummary };

    // Auto-submit estimate once all data is ready
    useEffect(() => {
        if (!draft || !user || !resolvedTenant || pricingLoading || autoSubmitFired.current) return;
        autoSubmitFired.current = true;

        const submit = async () => {
            try {
                const db = getDb();
                const finalName = user.name || "";
                const finalEmail = user.email || "";

                const estimateData = {
                    tenant_id: resolvedTenant.id,
                    customer_info: {
                        name: finalName,
                        phone: user.phone || "",
                        email: finalEmail,
                        city: ""
                    },
                    project_summary: {
                        segment: draft.segment,
                        plan: draft.plan,
                        carpetArea: draft.carpetArea,
                        bedrooms: draft.bedroomCount,
                        bathrooms: draft.bathroomCount,
                        configuration: {
                            livingArea: draft.livingAreaItems,
                            kitchen: {
                                layout: draft.kitchenLayout,
                                material: draft.kitchenMaterial,
                                items: draft.kitchenItems
                            },
                            bedrooms: draft.bedrooms,
                            bathrooms: draft.bathrooms,
                            cabins: draft.cabins
                        },
                        costSummary: estimateResult.costSummary,
                    },
                    total_amount: estimateResult.total,
                    customerEmail: finalEmail,
                    status: "pending",
                    created_at: new Date().toISOString(),
                };

                const estimateRef = await addDoc(
                    collection(db, `tenants/${resolvedTenant.id}/estimates`),
                    estimateData
                );
                const newEstimateId = estimateRef.id;
                setEstimateId(newEstimateId);

                // Create lead (fire-and-forget)
                fetch("/api/submit-estimate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tenantId: resolvedTenant.id,
                        estimateId: newEstimateId,
                        leadData: {
                            tenant_id: resolvedTenant.id,
                            user_id: "",
                            name: finalName,
                            email: finalEmail,
                            phone: user.phone || "",
                            city: "",
                            source: "website_estimate",
                            project_type: draft.segment,
                            basics: {
                                plan: draft.plan,
                                carpetArea: draft.carpetArea,
                                bedrooms: draft.bedroomCount,
                                bathrooms: draft.bathroomCount
                            },
                            items: estimateResult.breakdown,
                            total_amount: estimateResult.total,
                            estimate_id: newEstimateId,
                            stage: "new",
                            temperature: "warm",
                            score: 0,
                            follow_up_count: 0,
                            email_sent: false,
                            timeline: [{
                                action: "Lead auto-created from website estimate",
                                timestamp: new Date().toISOString(),
                                note: `Estimate ID: ${newEstimateId}`
                            }],
                        },
                    }),
                }).catch(() => {});

                // Send email notifications (fire-and-forget)
                fetch("/api/send-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: finalName,
                        email: finalEmail,
                        phone: user.phone || "",
                        projectType: draft.segment,
                        totalAmount: estimateResult.total,
                        tenantId: resolvedTenant.id,
                        tenantEmail: resolvedTenant.email,
                        tenantBusinessName: resolvedTenant.name,
                    }),
                }).catch(() => {});

                clearEstimateDraft(tenantSlug);
            } catch (err) {
                console.error("Auto-submit failed:", err);
            }
        };

        submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft, user, resolvedTenant, pricingLoading]);

    const handleDownloadPdf = async () => {
        if (!estimateId || !resolvedTenant) return;
        setPdfDownloading(true);
        try {
            await generateEstimatePDF(estimateId, websiteConfig?.brandName || "Interior Studio", {
                download: true,
                uploadToStorage: false,
                tenantId: resolvedTenant.id,
            });
        } catch (err) {
            console.error("PDF generation failed:", err);
            alert("PDF generation failed. You can download it from your dashboard.");
        } finally {
            setPdfDownloading(false);
        }
    };

    if (loading || !draft || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen text-[#0F172A] font-sans py-12 px-4 transition-colors duration-500" style={{ backgroundColor: `${primaryColor}08` }}>
            <div className="max-w-3xl mx-auto space-y-8">

                {/* Header */}
                <div className="text-center space-y-3 animate-in slide-in-from-bottom-8 fade-in duration-700">
                    <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">Your Estimate</h1>
                    <p className="text-xl text-gray-500 font-light">Review your estimate and confirm details</p>
                </div>

                {/* Estimated Cost Card */}
                <div
                    className="rounded-3xl p-10 text-white text-center shadow-2xl transform hover:scale-[1.01] transition-all duration-500 relative overflow-hidden animate-in slide-in-from-bottom-8 fade-in duration-700"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`, borderRadius: buttonRadius * 2 }}
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10">
                        <p className="font-bold mb-3 uppercase tracking-widest text-xs opacity-80">Estimated Cost</p>
                        <div className="text-6xl font-bold mb-3 tracking-tight">
                            ₹ {estimateResult.total.toLocaleString('en-IN')}
                        </div>
                        <p className="text-sm opacity-60 font-medium">Based on {draft.plan} Plan • {draft.segment}</p>
                    </div>
                </div>

                {/* Breakdown Table */}
                {estimateResult.breakdown.length > 0 && (
                    <div className="animate-in slide-in-from-bottom-8 fade-in duration-700">
                        <button
                            onClick={() => setBreakdownOpen(!breakdownOpen)}
                            className="w-full flex items-center justify-between p-5 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all"
                        >
                            <h3 className="font-bold text-lg text-gray-900">Detailed Breakdown</h3>
                            <ChevronDown className={cn("h-5 w-5 text-gray-400 transition-transform duration-300", breakdownOpen && "rotate-180")} />
                        </button>
                        {breakdownOpen && (
                            <div className="mt-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                                                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Item</th>
                                                <th className="text-right p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Qty</th>
                                                <th className="text-right p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Unit Price</th>
                                                <th className="text-right p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {estimateResult.breakdown.map((item, index) => (
                                                <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="p-4 text-sm font-medium text-gray-900">{item.category}</td>
                                                    <td className="p-4 text-sm text-gray-600">{item.item}</td>
                                                    <td className="p-4 text-sm text-right text-gray-600">{item.quantity}</td>
                                                    <td className="p-4 text-sm text-right text-gray-600">₹ {item.unitPrice.toLocaleString('en-IN')}</td>
                                                    <td className="p-4 text-sm text-right font-bold text-gray-900">₹ {item.total.toLocaleString('en-IN')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Cost Summary */}
                {estimateResult.costSummary && (estimateResult.costSummary.basePriceCost > 0 || estimateResult.costSummary.slabMultiplier !== 1 || estimateResult.costSummary.gstAmount > 0 || estimateResult.costSummary.discountAmount > 0 || estimateResult.costSummary.designFeeAmount > 0 || estimateResult.costSummary.additionalCharges.length > 0) && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3 animate-in slide-in-from-bottom-8 fade-in duration-700">
                        <h3 className="font-bold text-lg text-gray-900 border-b border-gray-100 pb-3">Cost Summary</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Items Subtotal</span>
                                <span className="font-semibold">₹ {estimateResult.costSummary.itemsSubtotal.toLocaleString('en-IN')}</span>
                            </div>
                            {estimateResult.costSummary.basePriceCost > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Base Price (area)</span>
                                    <span className="font-semibold">₹ {estimateResult.costSummary.basePriceCost.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            {estimateResult.costSummary.slabMultiplier !== 1 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Slab Multiplier</span>
                                    <span className="font-semibold">x{estimateResult.costSummary.slabMultiplier}</span>
                                </div>
                            )}
                            <div className="border-t border-gray-100 pt-2 flex justify-between">
                                <span className="text-gray-600">Subtotal</span>
                                <span className="font-semibold">₹ {estimateResult.costSummary.subtotalAfterSlab.toLocaleString('en-IN')}</span>
                            </div>
                            {estimateResult.costSummary.discountAmount > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Discount</span>
                                    <span className="font-semibold">-₹ {estimateResult.costSummary.discountAmount.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            {estimateResult.costSummary.gstAmount > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">GST</span>
                                    <span className="font-semibold">+₹ {estimateResult.costSummary.gstAmount.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            {estimateResult.costSummary.designFeeAmount > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Design Fee</span>
                                    <span className="font-semibold">+₹ {estimateResult.costSummary.designFeeAmount.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            {estimateResult.costSummary.additionalCharges.map((charge, idx) => (
                                <div key={idx} className="flex justify-between">
                                    <span className="text-gray-600">{charge.label}</span>
                                    <span className="font-semibold">+₹ {charge.amount.toLocaleString('en-IN')}</span>
                                </div>
                            ))}
                            <div className="border-t-2 border-gray-900 pt-3 mt-2 flex justify-between text-lg">
                                <span className="font-bold text-gray-900">Grand Total</span>
                                <span className="font-bold text-gray-900">₹ {estimateResult.costSummary.grandTotal.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-1 gap-3 pb-8 animate-in slide-in-from-bottom-8 fade-in duration-700">
                    <Button
                        onClick={handleDownloadPdf}
                        disabled={!estimateId || pdfDownloading}
                        className="w-full py-6 text-base font-semibold text-white shadow-md hover:shadow-lg transition-all"
                        style={{ backgroundColor: primaryColor, borderRadius: buttonRadius * 1.5 }}
                    >
                        {pdfDownloading ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating PDF...</>
                        ) : !estimateId ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving Estimate...</>
                        ) : (
                            <><Download className="mr-2 h-5 w-5" /> Download Estimate PDF</>
                        )}
                    </Button>

                    <Link href={`/${tenantSlug}/dashboard`} className="w-full">
                        <Button
                            variant="outline"
                            className="w-full py-6 text-base font-semibold border-2 hover:shadow-md transition-all"
                            style={{ borderColor: primaryColor, color: primaryColor, borderRadius: buttonRadius * 1.5 }}
                        >
                            <LayoutDashboard className="mr-2 h-5 w-5" /> View Dashboard
                        </Button>
                    </Link>

                    <Link href={`/${tenantSlug}/book-consultation`} className="w-full">
                        <Button
                            variant="ghost"
                            className="w-full py-6 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all"
                            style={{ borderRadius: buttonRadius * 1.5 }}
                        >
                            <Calendar className="mr-2 h-5 w-5" /> Book a Consultation Call
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
