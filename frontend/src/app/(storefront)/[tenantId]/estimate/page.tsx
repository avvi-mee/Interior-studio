"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, Plus, Minus, Home, Building2, ChevronRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePricingConfig, PricingItem } from "@/hooks/usePricingConfig";
import { usePublicWebsiteConfig } from "@/hooks/useWebsiteConfig";
import { resolveTenant, Tenant } from "@/lib/firestoreHelpers";
import { calculateEstimate } from "@/lib/calculateEstimate";
import { saveEstimateDraft } from "@/lib/estimateTypes";

type Plan = 'Basic' | 'Standard' | 'Luxe';

interface ItemQuantity {
    [itemId: string]: number;
}

interface BedroomConfig {
    items: ItemQuantity;
}

interface BathroomConfig {
    items: ItemQuantity;
}

export default function EstimatorPage({ params }: { params: Promise<{ tenantId: string }> }) {
    const { tenantId: tenantSlug } = use(params);
    const router = useRouter();


    const [resolvedTenant, setResolvedTenant] = useState<Tenant | null>(null);
    const [tenantLoading, setTenantLoading] = useState(true);
    const [resolutionError, setResolutionError] = useState(false);

    useEffect(() => {
        const loadTenant = async () => {
            if (!tenantSlug) return;
            try {
                // Try lowercase first as it's the standard for storeIds
                const tenant = await resolveTenant(tenantSlug);
                if (tenant) {
                    setResolvedTenant(tenant);
                } else {
                    setResolutionError(true);
                }
            } catch (error) {
                console.error("Error resolving tenant:", error);
                setResolutionError(true);
            } finally {
                setTenantLoading(false);
            }
        };
        loadTenant();
    }, [tenantSlug]);

    const { config: websiteConfig, loading: websiteLoading } = usePublicWebsiteConfig(tenantSlug);
    const { config, loading: pricingLoading } = usePricingConfig(resolvedTenant?.id || null);

    const loading = tenantLoading || pricingLoading || websiteLoading;

    const primaryColor = websiteConfig?.primaryColor || "#0F172A";
    const buttonRadius = websiteConfig?.buttonRadius || 12;
    const backgroundColor = websiteConfig?.backgroundColor || "#ffffff";

    // NOTE: Removed auth guard - guests can now access estimate page
    // Auth check moved to handleSubmit function

    const [step, setStep] = useState(1);

    // Project Details
    const [segment, setSegment] = useState<'Residential' | 'Commercial'>('Residential');
    const [selectedPlan, setSelectedPlan] = useState<Plan>('Standard');
    const [carpetArea, setCarpetArea] = useState("");
    const [bedroomCount, setBedroomCount] = useState(0);
    const [bathroomCount, setBathroomCount] = useState(0);

    // Item Selections
    const [livingAreaItems, setLivingAreaItems] = useState<ItemQuantity>({});
    const [kitchenLayout, setKitchenLayout] = useState("");
    const [kitchenMaterial, setKitchenMaterial] = useState("");
    const [kitchenItems, setKitchenItems] = useState<ItemQuantity>({});
    const [bedrooms, setBedrooms] = useState<BedroomConfig[]>([]);
    const [bathrooms, setBathrooms] = useState<BathroomConfig[]>([]);

    // Commercial Specific Counts
    const [cabinCount, setCabinCount] = useState(0);
    const [cabins, setCabins] = useState<BedroomConfig[]>([]);

    // Update bedroom/bathroom arrays when counts change
    useEffect(() => {
        const count = Math.max(0, bedroomCount);
        setBedrooms(prev => {
            if (count > prev.length) {
                return [...prev, ...Array(count - prev.length).fill({ items: {} })];
            } else if (count < prev.length) {
                return prev.slice(0, count);
            }
            return prev;
        });
    }, [bedroomCount]);

    useEffect(() => {
        const count = Math.max(0, bathroomCount);
        setBathrooms(prev => {
            if (count > prev.length) {
                return [...prev, ...Array(count - prev.length).fill({ items: {} })];
            } else if (count < prev.length) {
                return prev.slice(0, count);
            }
            return prev;
        });
    }, [bathroomCount]);

    useEffect(() => {
        const count = Math.max(0, cabinCount);
        setCabins(prev => {
            if (count > prev.length) {
                return [...prev, ...Array(count - prev.length).fill({ items: {} })];
            } else if (count < prev.length) {
                return prev.slice(0, count);
            }
            return prev;
        });
    }, [cabinCount]);

    // Set default kitchen layout and material when config loads
    useEffect(() => {
        if (config?.kitchenLayouts?.length && !kitchenLayout) {
            const firstEnabled = config.kitchenLayouts.find(l => l.enabled);
            if (firstEnabled) setKitchenLayout(firstEnabled.name);
        }
        if (config?.kitchenMaterials?.length && !kitchenMaterial) {
            const firstEnabled = config.kitchenMaterials.find(m => m.enabled);
            if (firstEnabled) setKitchenMaterial(firstEnabled.name);
        }
    }, [config, kitchenLayout, kitchenMaterial]);

    // Scroll to top on step change
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [step]);

    // Carpet area settings
    const carpetAreaSettings = config?.carpetAreaSettings;
    const minSqft = carpetAreaSettings?.minSqft || 0;
    const maxSqft = carpetAreaSettings?.maxSqft || Infinity;
    const carpetAreaNum = parseFloat(carpetArea) || 0;
    const carpetAreaInRange = carpetAreaNum >= minSqft && carpetAreaNum <= maxSqft;

    const isStepValid = () => {
        if (step === 1) return true;
        if (step === 2) return true;
        if (step === 3) return carpetArea && carpetAreaNum > 0 && carpetAreaInRange;
        if (step === 4) return true;
        return false;
    };

    // Helper to filter items by plan visibility
    const filterByPlanVisibility = (items: PricingItem[]) => {
        return items.filter(item => {
            if (!item.enabled) return false;
            if (!item.planVisibility || item.planVisibility.length === 0) return true;
            return item.planVisibility.includes(selectedPlan);
        });
    };

    // Pre-fill default quantities when entering step 4
    const defaultsAppliedRef = useRef(false);
    useEffect(() => {
        if (step === 4 && config?.categories && !defaultsAppliedRef.current) {
            defaultsAppliedRef.current = true;
            const allCategories = config.categories.filter(c => {
                if (segment === 'Residential') return !c.type || c.type === 'residential';
                return c.type === 'commercial';
            });

            const newLivingAreaItems: ItemQuantity = { ...livingAreaItems };
            const newKitchenItems: ItemQuantity = { ...kitchenItems };
            let hasChanges = false;

            allCategories.forEach(category => {
                const isKitchen = category.id === 'kitchen' || category.name.toLowerCase() === 'kitchen';
                const isBedroom = category.id === 'bedroom' || category.name.toLowerCase() === 'bedroom';
                const isBathroom = category.id === 'bathroom' || category.name.toLowerCase() === 'bathroom';

                category.items.forEach(item => {
                    if (!item.enabled || !item.defaultQuantity || item.defaultQuantity <= 0) return;
                    if (item.planVisibility && item.planVisibility.length > 0 && !item.planVisibility.includes(selectedPlan)) return;

                    if (isKitchen) {
                        if (!(item.id in newKitchenItems) || newKitchenItems[item.id] === 0) {
                            newKitchenItems[item.id] = item.defaultQuantity;
                            hasChanges = true;
                        }
                    } else if (!isBedroom && !isBathroom) {
                        if (!(item.id in newLivingAreaItems) || newLivingAreaItems[item.id] === 0) {
                            newLivingAreaItems[item.id] = item.defaultQuantity;
                            hasChanges = true;
                        }
                    }
                });
            });

            if (hasChanges) {
                setLivingAreaItems(newLivingAreaItems);
                setKitchenItems(newKitchenItems);
            }
        }
        if (step !== 4) {
            defaultsAppliedRef.current = false;
        }
    }, [step, config, segment, selectedPlan]);

    const updateItemQuantity = (
        category: 'livingArea' | 'kitchen' | 'bedroom' | 'bathroom' | 'cabin',
        itemId: string,
        delta: number,
        index?: number
    ) => {
        if (category === 'livingArea') {
            setLivingAreaItems(prev => ({
                ...prev,
                [itemId]: Math.max(0, (prev[itemId] || 0) + delta)
            }));
        } else if (category === 'kitchen') {
            setKitchenItems(prev => ({
                ...prev,
                [itemId]: Math.max(0, (prev[itemId] || 0) + delta)
            }));
        } else if (category === 'bedroom' && index !== undefined) {
            setBedrooms(prev => {
                const newBedrooms = [...prev];
                newBedrooms[index] = {
                    ...newBedrooms[index],
                    items: {
                        ...newBedrooms[index].items,
                        [itemId]: Math.max(0, (newBedrooms[index].items[itemId] || 0) + delta)
                    }
                };
                return newBedrooms;
            });
        } else if (category === 'bathroom' && index !== undefined) {
            setBathrooms(prev => {
                const newBathrooms = [...prev];
                newBathrooms[index] = {
                    ...newBathrooms[index],
                    items: {
                        ...newBathrooms[index].items,
                        [itemId]: Math.max(0, (newBathrooms[index].items[itemId] || 0) + delta)
                    }
                };
                return newBathrooms;
            });
        } else if (category === 'cabin' && index !== undefined) {
            setCabins(prev => {
                const newCabins = [...prev];
                newCabins[index] = {
                    ...newCabins[index],
                    items: {
                        ...newCabins[index].items,
                        [itemId]: Math.max(0, (newCabins[index].items[itemId] || 0) + delta)
                    }
                };
                return newCabins;
            });
        }
    };

    const handleSaveDraftAndRedirect = () => {
        saveEstimateDraft(tenantSlug, {
            segment,
            plan: selectedPlan,
            carpetArea: parseFloat(carpetArea) || 0,
            bedroomCount,
            bathroomCount,
            cabinCount,
            livingAreaItems,
            kitchenLayout,
            kitchenMaterial,
            kitchenItems,
            bedrooms,
            bathrooms,
            cabins,
            tenantId: resolvedTenant?.id || "",
            tenantSlug,
            savedAt: Date.now()
        });
        router.push(`/${tenantSlug}/login?next=/estimate/review`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#0F172A]" />
            </div>
        );
    }

    if (resolutionError || (!resolvedTenant && !tenantLoading)) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="max-w-md w-full text-center p-8">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold">Store Not Found</CardTitle>
                        <CardDescription>
                            The estimate page you&apos;re trying to reach doesn&apos;t exist or the company ID is incorrect.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => router.push('/')} className="w-full">
                            Go to Home
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const allCategories = config?.categories || [];
    const categories = allCategories.filter(c => {
        if (segment === 'Residential') return !c.type || c.type === 'residential';
        return c.type === 'commercial';
    });

    // Helper to match category names robustly
    const isRoom = (cat: any, name: string) =>
        cat.id === name ||
        cat.id === name.replace(' ', '_') ||
        cat.name.trim().toLowerCase() === name.replace('_', ' ').toLowerCase();

    const livingAreaCategory = categories.find(c => isRoom(c, 'living_area'));
    const kitchenCategory = categories.find(c => isRoom(c, 'kitchen'));
    const bedroomCategory = categories.find(c => isRoom(c, 'bedroom'));
    const bathroomCategory = categories.find(c => isRoom(c, 'bathroom'));

    // Other categories to show in a general section
    const otherCategories = categories.filter(c =>
        !isRoom(c, 'living_area') &&
        !isRoom(c, 'kitchen') &&
        !isRoom(c, 'bedroom') &&
        !isRoom(c, 'bathroom')
    );

    const { total: currentTotal } = calculateEstimate(config, {
        segment,
        selectedPlan,
        carpetArea: parseFloat(carpetArea) || 0,
        livingAreaItems,
        kitchenItems,
        bedrooms,
        bathrooms,
        cabins
    });

    return (
        <div className="min-h-screen text-[#0F172A] font-sans pt-4 pb-32 relative z-0 transition-colors duration-500" style={{ backgroundColor }}>
            {/* Minimal Header Removed to allow Main Layout Header */}

            <main className="max-w-3xl mx-auto px-6 py-12">
                {/* Progress Indicators */}
                <div className="flex justify-center mb-12">
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map(s => (
                            <div
                                key={s}
                                className={cn(
                                    "h-1.5 rounded-full transition-all duration-500 ease-out",
                                    step === s ? "w-8" : step > s ? "w-8 opacity-20" : "w-1.5 bg-gray-200"
                                )}
                                style={{ backgroundColor: step >= s ? primaryColor : undefined }}
                            />
                        ))}
                    </div>
                </div>
                {/* Step 1: Segment */}
                {step === 1 && (
                    <div className="space-y-12 animate-in slide-in-from-bottom-8 fade-in duration-700 ease-out">
                        <div className="space-y-3 text-center">
                            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">Project Type</h1>
                            <p className="text-xl text-gray-500 font-light">What kind of space are we designing today?</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {['Residential', 'Commercial'].map((s) => (
                                <div
                                    key={s}
                                    onClick={() => setSegment(s as any)}
                                    className={cn(
                                        "cursor-pointer group relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border-2",
                                        segment === s
                                            ? "bg-white ring-4 shadow-xl"
                                            : "border-gray-100 bg-white hover:border-gray-200"
                                    )}
                                    style={{
                                        borderRadius: (buttonRadius as number) * 2,
                                        borderColor: segment === s ? primaryColor : undefined,
                                        boxShadow: segment === s ? `${primaryColor}15 0px 10px 40px` : undefined
                                    }}
                                >
                                    <div className="space-y-6 flex flex-col items-center">
                                        <div className={cn(
                                            "h-24 w-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm",
                                            segment === s ? "text-white scale-110" : "bg-gray-50 text-gray-400 group-hover:bg-gray-100 group-hover:scale-110"
                                        )}
                                            style={{ backgroundColor: segment === s ? primaryColor : undefined }}
                                        >
                                            {s === 'Residential' ? <Home className="h-10 w-10" /> : <Building2 className="h-10 w-10" />}
                                        </div>
                                        <h3 className="text-3xl font-bold tracking-tight">{s}</h3>
                                        <p className="text-center text-gray-500 leading-relaxed px-4">
                                            {s === 'Residential' ? 'Homes, Apartments, and Villas' : 'Offices, Retail, and Workspaces'}
                                        </p>
                                    </div>
                                    {segment === s && (
                                        <div className="absolute top-6 right-6 p-1 rounded-full" style={{ color: primaryColor, backgroundColor: `${primaryColor}10` }}>
                                            <CheckCircle2 className="h-6 w-6" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Plan */}
                {step === 2 && (
                    <div className="space-y-12 animate-in slide-in-from-bottom-8 fade-in duration-700 ease-out">
                        <div className="text-center space-y-3">
                            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">Select Plan</h1>
                            <p className="text-xl text-gray-500 font-light">Choose a tier that matches your vision</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {(['Basic', 'Standard', 'Luxe'] as Plan[]).map(plan => (
                                <button
                                    key={plan}
                                    onClick={() => setSelectedPlan(plan)}
                                    className={cn(
                                        "relative p-8 border-2 rounded-3xl text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-2 group flex flex-col justify-center min-h-[240px]",
                                        selectedPlan === plan
                                            ? "bg-white ring-4 shadow-xl scale-[1.02]"
                                            : "border-gray-100 bg-white hover:border-gray-200"
                                    )}
                                    style={{
                                        borderRadius: (buttonRadius as number) * 2,
                                        borderColor: selectedPlan === plan ? primaryColor : undefined,
                                        boxShadow: selectedPlan === plan ? `${primaryColor}15 0px 10px 40px` : undefined
                                    }}
                                >
                                    <div className="space-y-4">
                                        <div className={cn(
                                            "inline-flex px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-2 transition-colors",
                                            selectedPlan === plan ? "text-white" : "bg-gray-100 text-gray-500"
                                        )}
                                            style={{ backgroundColor: selectedPlan === plan ? primaryColor : undefined }}
                                        >
                                            {plan === 'Basic' && 'Essential'}
                                            {plan === 'Standard' && 'Popular'}
                                            {plan === 'Luxe' && 'Premium'}
                                        </div>
                                        <p className="font-bold text-3xl text-[#0F172A]">{plan}</p>
                                        <p className="text-sm text-gray-500 leading-relaxed">
                                            {plan === 'Basic' && 'Perfect for simple updates'}
                                            {plan === 'Standard' && 'Balanced design & quality'}
                                            {plan === 'Luxe' && 'Top-tier finishes & customized'}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 3: Project Basics */}
                {step === 3 && (
                    <div className="space-y-12 animate-in slide-in-from-bottom-8 fade-in duration-700 ease-out">
                        <div className="text-center space-y-3">
                            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">Project Basics</h1>
                            <p className="text-xl text-gray-500 font-light">Tell us about the space dimensions</p>
                        </div>
                        <div className={cn(
                            "grid grid-cols-1 gap-10 max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-gray-100",
                            segment === 'Residential' ? "md:grid-cols-2" : "md:grid-cols-1"
                        )}>
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Carpet Area (sqft)</Label>
                                <Input
                                    type="number"
                                    placeholder="e.g 1200"
                                    className={cn(
                                        "h-16 text-2xl font-light bg-gray-50 border-0 focus:ring-2 focus:ring-black/5 rounded-2xl transition-all pl-6",
                                        carpetArea && !carpetAreaInRange && "ring-2 ring-red-300"
                                    )}
                                    value={carpetArea}
                                    onChange={(e) => setCarpetArea(e.target.value)}
                                    autoFocus
                                />
                                {minSqft > 0 || maxSqft < Infinity ? (
                                    <p className={cn(
                                        "text-xs ml-1",
                                        carpetArea && !carpetAreaInRange ? "text-red-500 font-medium" : "text-gray-400"
                                    )}>
                                        Enter between {minSqft.toLocaleString('en-IN')} - {maxSqft === Infinity ? '∞' : maxSqft.toLocaleString('en-IN')} sq ft
                                    </p>
                                ) : null}
                            </div>
                            {segment === 'Residential' ? (
                                <>
                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Bedrooms</Label>
                                        <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-2 h-16">
                                            <Button size="icon" variant="ghost" className="h-12 w-12 rounded-xl hover:bg-white shadow-sm" onClick={() => setBedroomCount(Math.max(0, bedroomCount - 1))}><Minus className="h-5 w-5" /></Button>
                                            <div className="flex-1 text-center font-bold text-2xl">{bedroomCount}</div>
                                            <Button size="icon" variant="ghost" className="h-12 w-12 rounded-xl hover:bg-white shadow-sm" onClick={() => setBedroomCount(bedroomCount + 1)}><Plus className="h-5 w-5" /></Button>
                                        </div>
                                    </div>
                                    <div className="space-y-3 md:col-span-2">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Bathrooms</Label>
                                        <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-2 h-16 w-full md:w-2/3 mx-auto">
                                            <Button size="icon" variant="ghost" className="h-12 w-12 rounded-xl hover:bg-white shadow-sm" onClick={() => setBathroomCount(Math.max(0, bathroomCount - 1))}><Minus className="h-5 w-5" /></Button>
                                            <div className="flex-1 text-center font-bold text-2xl">{bathroomCount}</div>
                                            <Button size="icon" variant="ghost" className="h-12 w-12 rounded-xl hover:bg-white shadow-sm" onClick={() => setBathroomCount(bathroomCount + 1)}><Plus className="h-5 w-5" /></Button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">No. of Cabins</Label>
                                        <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-2 h-16">
                                            <Button size="icon" variant="ghost" className="h-12 w-12 rounded-xl hover:bg-white shadow-sm" onClick={() => setCabinCount(Math.max(0, cabinCount - 1))}><Minus className="h-5 w-5" /></Button>
                                            <div className="flex-1 text-center font-bold text-2xl">{cabinCount}</div>
                                            <Button size="icon" variant="ghost" className="h-12 w-12 rounded-xl hover:bg-white shadow-sm" onClick={() => setCabinCount(cabinCount + 1)}><Plus className="h-5 w-5" /></Button>
                                        </div>
                                    </div>
                                    <div className="space-y-3 md:col-span-1">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Bathroom Units</Label>
                                        <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-2 h-16">
                                            <Button size="icon" variant="ghost" className="h-12 w-12 rounded-xl hover:bg-white shadow-sm" onClick={() => setBathroomCount(Math.max(0, bathroomCount - 1))}><Minus className="h-5 w-5" /></Button>
                                            <div className="flex-1 text-center font-bold text-2xl">{bathroomCount}</div>
                                            <Button size="icon" variant="ghost" className="h-12 w-12 rounded-xl hover:bg-white shadow-sm" onClick={() => setBathroomCount(bathroomCount + 1)}><Plus className="h-5 w-5" /></Button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 4: Essentials Configuration */}
                {step === 4 && (
                    <div className="space-y-12 animate-in slide-in-from-bottom-8 fade-in duration-700 ease-out">
                        <div className="text-center space-y-3">
                            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">Configure Details</h1>
                            <p className="text-xl text-gray-500 font-light">Customize essentials for each room</p>
                        </div>

                        <div className="space-y-16">
                            {/* Living Area */}
                            {livingAreaCategory && filterByPlanVisibility(livingAreaCategory.items).length > 0 && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                                        <div className="h-10 w-1 rounded-full" style={{ backgroundColor: primaryColor }}></div>
                                        <h2 className="text-2xl font-bold text-[#0F172A]">Living Area</h2>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {filterByPlanVisibility(livingAreaCategory.items).map(item => (
                                            <div key={item.id} className="flex items-center justify-between p-6 border border-gray-100 bg-white rounded-2xl hover:shadow-lg transition-all duration-300">
                                                <span className="font-semibold text-lg text-gray-700">{item.name}</span>
                                                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-1">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm"
                                                        onClick={() => updateItemQuantity('livingArea', item.id, -1)}
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                    <span className="w-8 text-center font-bold text-lg">{livingAreaItems[item.id] || 0}</span>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm"
                                                        onClick={() => updateItemQuantity('livingArea', item.id, 1)}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Kitchen */}
                            {kitchenCategory && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                                        <div className="h-10 w-1 rounded-full" style={{ backgroundColor: primaryColor }}></div>
                                        <h2 className="text-2xl font-bold text-[#0F172A]">Kitchen</h2>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                        <div className="space-y-3">
                                            <Label className="uppercase text-xs font-bold text-gray-400">Layout</Label>
                                            <Select value={kitchenLayout} onValueChange={setKitchenLayout}>
                                                <SelectTrigger className="h-14 rounded-2xl bg-white border border-gray-200 text-lg">
                                                    <SelectValue placeholder="Select layout" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {config?.kitchenLayouts?.filter(l => l.enabled).map(layout => (
                                                        <SelectItem key={layout.id} value={layout.name}>{layout.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-3">
                                            <Label className="uppercase text-xs font-bold text-gray-400">Material</Label>
                                            <Select value={kitchenMaterial} onValueChange={setKitchenMaterial}>
                                                <SelectTrigger className="h-14 rounded-2xl bg-white border border-gray-200 text-lg">
                                                    <SelectValue placeholder="Select material" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {config?.kitchenMaterials?.filter(m => m.enabled).map(material => (
                                                        <SelectItem key={material.id} value={material.name}>{material.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    {filterByPlanVisibility(kitchenCategory.items).length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {filterByPlanVisibility(kitchenCategory.items).map(item => (
                                                <div key={item.id} className="flex items-center justify-between p-6 border border-gray-100 bg-white rounded-2xl hover:shadow-lg transition-all duration-300">
                                                    <span className="font-semibold text-lg text-gray-700">{item.name}</span>
                                                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-1">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm"
                                                            onClick={() => updateItemQuantity('kitchen', item.id, -1)}
                                                        >
                                                            <Minus className="h-4 w-4" />
                                                        </Button>
                                                        <span className="w-8 text-center font-bold text-lg">{kitchenItems[item.id] || 0}</span>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm"
                                                            onClick={() => updateItemQuantity('kitchen', item.id, 1)}
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Bedrooms */}
                            {bedroomCount > 0 && bedroomCategory && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                                        <div className="h-10 w-1 rounded-full" style={{ backgroundColor: primaryColor }}></div>
                                        <h2 className="text-2xl font-bold text-[#0F172A]">Bedrooms</h2>
                                    </div>
                                    {bedrooms.map((bedroom, index) => (
                                        <div key={index} className="space-y-4 p-8 bg-gray-50/50 rounded-3xl border border-gray-100">
                                            <h3 className="font-bold text-lg text-gray-400 uppercase tracking-widest mb-4">Bedroom {index + 1}</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {filterByPlanVisibility(bedroomCategory.items).map(item => (
                                                    <div key={item.id} className="flex items-center justify-between p-5 border border-gray-100 bg-white rounded-2xl hover:border-gray-300 transition-colors">
                                                        <span className="font-medium">{item.name}</span>
                                                        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1">
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md hover:bg-white hover:shadow-sm" onClick={() => updateItemQuantity('bedroom', item.id, -1, index)}><Minus className="h-3 w-3" /></Button>
                                                            <span className="w-6 text-center font-bold text-sm">{bedroom.items[item.id] || 0}</span>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md hover:bg-white hover:shadow-sm" onClick={() => updateItemQuantity('bedroom', item.id, 1, index)}><Plus className="h-3 w-3" /></Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Bathrooms */}
                            {bathroomCount > 0 && bathroomCategory && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                                        <div className="h-10 w-1 rounded-full" style={{ backgroundColor: primaryColor }}></div>
                                        <h2 className="text-2xl font-bold text-[#0F172A]">Bathrooms</h2>
                                    </div>
                                    {bathrooms.map((bathroom, index) => (
                                        <div key={index} className="space-y-4 p-8 bg-gray-50/50 rounded-3xl border border-gray-100">
                                            <h3 className="font-bold text-lg text-gray-400 uppercase tracking-widest mb-4">Bathroom Unit {index + 1}</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {filterByPlanVisibility(bathroomCategory.items).map(item => (
                                                    <div key={item.id} className="flex items-center justify-between p-5 border border-gray-100 bg-white rounded-2xl hover:border-gray-300 transition-colors">
                                                        <span className="font-medium">{item.name}</span>
                                                        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1">
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md hover:bg-white hover:shadow-sm" onClick={() => updateItemQuantity('bathroom', item.id, -1, index)}><Minus className="h-3 w-3" /></Button>
                                                            <span className="w-6 text-center font-bold text-sm">{bathroom.items[item.id] || 0}</span>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md hover:bg-white hover:shadow-sm" onClick={() => updateItemQuantity('bathroom', item.id, 1, index)}><Plus className="h-3 w-3" /></Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Cabins (Commercial Only) */}
                            {cabinCount > 0 && categories.find(c => c.id === 'cabin' || c.name.toLowerCase() === 'cabin') && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                                        <div className="h-10 w-1 rounded-full" style={{ backgroundColor: primaryColor }}></div>
                                        <h2 className="text-2xl font-bold text-[#0F172A]">Office Cabins</h2>
                                    </div>
                                    {cabins.map((cabin, index) => (
                                        <div key={index} className="space-y-4 p-8 bg-gray-50/50 rounded-3xl border border-gray-100">
                                            <h3 className="font-bold text-lg text-gray-400 uppercase tracking-widest mb-4">Cabin {index + 1}</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {filterByPlanVisibility(categories.find(c => c.id === 'cabin' || c.name.toLowerCase() === 'cabin')?.items || []).map(item => (
                                                    <div key={item.id} className="flex items-center justify-between p-5 border border-gray-100 bg-white rounded-2xl hover:border-gray-300 transition-colors">
                                                        <span className="font-medium">{item.name}</span>
                                                        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1">
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md hover:bg-white hover:shadow-sm" onClick={() => updateItemQuantity('cabin', item.id, -1, index)}><Minus className="h-3 w-3" /></Button>
                                                            <span className="w-6 text-center font-bold text-sm">{cabin.items[item.id] || 0}</span>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md hover:bg-white hover:shadow-sm" onClick={() => updateItemQuantity('cabin', item.id, 1, index)}><Plus className="h-3 w-3" /></Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Other Categories */}
                            {otherCategories.map(category => (
                                <div key={category.id} className="space-y-6">
                                    <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                                        <div className="h-10 w-1 rounded-full" style={{ backgroundColor: primaryColor }}></div>
                                        <h2 className="text-2xl font-bold text-[#0F172A]">{category.name}</h2>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {filterByPlanVisibility(category.items).map(item => (
                                            <div key={item.id} className="flex items-center justify-between p-6 border border-gray-100 bg-white rounded-2xl hover:shadow-lg transition-all duration-300">
                                                <span className="font-semibold text-lg text-gray-700">{item.name}</span>
                                                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-1">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm"
                                                        onClick={() => setLivingAreaItems(prev => ({
                                                            ...prev,
                                                            [item.id]: Math.max(0, (prev[item.id] || 0) - 1)
                                                        }))}
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                    <span className="w-8 text-center font-bold text-lg">{livingAreaItems[item.id] || 0}</span>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm"
                                                        onClick={() => setLivingAreaItems(prev => ({
                                                            ...prev,
                                                            [item.id]: (prev[item.id] || 0) + 1
                                                        }))}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {categories.length === 0 && (
                                <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                                    <p className="text-gray-400">No items available for configuration.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </main>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 p-4 z-50">
                <div className="max-w-4xl mx-auto flex justify-between items-center px-4">
                    <Button
                        variant="ghost"
                        disabled={step === 1}
                        onClick={() => setStep(s => s - 1)}
                        className="text-gray-500 hover:text-black font-semibold h-12 px-6 rounded-xl hover:bg-gray-100"
                    >
                        <ArrowLeft className="mr-2 h-5 w-5" /> Back
                    </Button>

                    {step < 4 ? (
                        <Button
                            className="text-white px-10 py-7 text-lg font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 border-0"
                            onClick={() => setStep(s => s + 1)}
                            disabled={!isStepValid()}
                            style={{ backgroundColor: primaryColor, borderRadius: (buttonRadius as number) * 2 }}
                        >
                            Continue <ChevronRight className="ml-2 h-5 w-5" />
                        </Button>
                    ) : (
                        <Button
                            className="text-white px-10 py-7 text-lg font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 border-0"
                            onClick={handleSaveDraftAndRedirect}
                            disabled={!isStepValid()}
                            style={{ backgroundColor: primaryColor, borderRadius: (buttonRadius as number) * 2 }}
                        >
                            Get Estimate <ChevronRight className="ml-2 h-5 w-5" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
