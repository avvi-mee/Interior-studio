"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useFirestoreDoc } from "@/lib/firestoreQuery";

// New three-tier pricing structure
export interface PricingItem {
    id: string;
    name: string;
    type: 'fixed' | 'perUnit' | 'perSqft';
    basicPrice: number;
    standardPrice: number;
    luxePrice: number;
    enabled: boolean;
    defaultQuantity?: number;
    planVisibility?: ('Basic' | 'Standard' | 'Luxe')[];
}

export interface Category {
    id: string;
    name: string;
    type?: 'residential' | 'commercial';
    order: number;
    items: PricingItem[];
}

export interface DropdownOption {
    id: string;
    name: string;
    enabled: boolean;
}

export interface RateSlab {
    id: string;
    minSqft: number;
    maxSqft: number;
    multiplier: number;
    label?: string;
}

export interface CarpetAreaSettings {
    minSqft: number;
    maxSqft: number;
    basePricePerSqft?: number;
    rateSlabs?: RateSlab[];
}

export interface AdditionalCharge {
    id: string;
    label: string;
    type: 'percentage' | 'fixed';
    value: number;
    enabled: boolean;
}

export interface CalculationRules {
    gstPercent?: number;
    discountPercent?: number;
    designFeePercent?: number;
    additionalCharges?: AdditionalCharge[];
    roundToNearest?: number;
}

export interface PricingConfig {
    categories?: Category[];
    kitchenLayouts?: DropdownOption[];
    kitchenMaterials?: DropdownOption[];

    // Legacy fields (for backward compatibility)
    roomPricing?: PricingRule[];
    materialGrades?: MultiplierRule[];
    finishTypes?: MultiplierRule[];
    livingArea?: {
        [key: string]: LivingAreaOption;
    };
    kitchen?: {
        woodTypes: KitchenWoodType[];
        layouts: KitchenLayout[];
        addOns: KitchenAddOn[];
    };
    bedrooms?: {
        counts: BedroomCount[];
        [key: string]: any;
    };

    version?: number;
    active?: boolean;
    carpetAreaSettings?: CarpetAreaSettings;
    calculationRules?: CalculationRules;

    lastUpdated: any;
}

// Legacy interfaces
export interface PricingRule {
    id: string;
    name: string;
    rate: number;
    enabled: boolean;
}

export interface MultiplierRule {
    id: string;
    name: string;
    multiplier: number;
    enabled?: boolean;
}

export interface LivingAreaOption {
    enabled: boolean;
    price: number;
}

export interface KitchenWoodType {
    id: string;
    name: string;
    multiplier: number;
    enabled: boolean;
}

export interface KitchenLayout {
    id: string;
    name: string;
    basePrice: number;
    enabled: boolean;
}

export interface KitchenAddOn {
    id: string;
    name: string;
    price: number;
    enabled: boolean;
}

export interface BedroomCount {
    count: number;
    basePrice: number;
    enabled: boolean;
}

function createDefaultConfig(): PricingConfig {
    return {
        categories: [
            {
                id: 'living_area', name: 'Living Area', type: 'residential', order: 0,
                items: [
                    { id: 'la_1', name: 'TV Unit', type: 'fixed', basicPrice: 28000, standardPrice: 35000, luxePrice: 42000, enabled: true },
                    { id: 'la_2', name: 'Sofa Unit', type: 'fixed', basicPrice: 36000, standardPrice: 45000, luxePrice: 54000, enabled: true },
                    { id: 'la_3', name: 'Showcase', type: 'fixed', basicPrice: 22400, standardPrice: 28000, luxePrice: 33600, enabled: true },
                    { id: 'la_4', name: 'Wall Panel', type: 'perSqft', basicPrice: 400, standardPrice: 500, luxePrice: 600, enabled: true },
                    { id: 'la_5', name: 'False Ceiling', type: 'perSqft', basicPrice: 280, standardPrice: 350, luxePrice: 420, enabled: true }
                ]
            },
            {
                id: 'kitchen', name: 'Kitchen', type: 'residential', order: 1,
                items: [
                    { id: 'k_1', name: 'Tandem Drawers', type: 'perUnit', basicPrice: 12000, standardPrice: 15000, luxePrice: 18000, enabled: true },
                    { id: 'k_2', name: 'Tall Unit', type: 'perUnit', basicPrice: 20000, standardPrice: 25000, luxePrice: 30000, enabled: true },
                    { id: 'k_3', name: 'Corner Carousel', type: 'perUnit', basicPrice: 9600, standardPrice: 12000, luxePrice: 14400, enabled: true },
                    { id: 'k_4', name: 'Built-in Appliances', type: 'perUnit', basicPrice: 36000, standardPrice: 45000, luxePrice: 54000, enabled: true }
                ]
            },
            {
                id: 'bedroom', name: 'Bedroom', type: 'residential', order: 2,
                items: [
                    { id: 'br_1', name: 'Wardrobe', type: 'perUnit', basicPrice: 36000, standardPrice: 45000, luxePrice: 54000, enabled: true },
                    { id: 'br_2', name: 'Bed with Storage', type: 'perUnit', basicPrice: 24000, standardPrice: 30000, luxePrice: 36000, enabled: true },
                    { id: 'br_3', name: 'Study Unit', type: 'perUnit', basicPrice: 22400, standardPrice: 28000, luxePrice: 33600, enabled: true },
                    { id: 'br_4', name: 'Dressing Table', type: 'perUnit', basicPrice: 16000, standardPrice: 20000, luxePrice: 24000, enabled: true }
                ]
            },
            {
                id: 'office_space', name: 'Office Space', type: 'commercial', order: 3,
                items: [
                    { id: 'off_1', name: 'Reception Desk', type: 'fixed', basicPrice: 45000, standardPrice: 60000, luxePrice: 75000, enabled: true },
                    { id: 'off_2', name: 'Conference Table', type: 'fixed', basicPrice: 50000, standardPrice: 70000, luxePrice: 90000, enabled: true },
                    { id: 'off_3', name: 'Modular Workstation', type: 'perUnit', basicPrice: 12000, standardPrice: 15000, luxePrice: 18000, enabled: true },
                    { id: 'off_4', name: 'Executive Chair', type: 'perUnit', basicPrice: 8000, standardPrice: 12000, luxePrice: 16000, enabled: true }
                ]
            },
            {
                id: 'retail_shop', name: 'Retail Shop', type: 'commercial', order: 4,
                items: [
                    { id: 'ret_1', name: 'Display Racks', type: 'perUnit', basicPrice: 15000, standardPrice: 20000, luxePrice: 25000, enabled: true },
                    { id: 'ret_2', name: 'Billing Counter', type: 'fixed', basicPrice: 30000, standardPrice: 45000, luxePrice: 60000, enabled: true },
                    { id: 'ret_3', name: 'Trial Room', type: 'perUnit', basicPrice: 20000, standardPrice: 25000, luxePrice: 30000, enabled: true }
                ]
            },
            {
                id: 'cabin', name: 'Cabin', type: 'commercial', order: 5,
                items: [
                    { id: 'cb_1', name: 'Executive Desk', type: 'perUnit', basicPrice: 25000, standardPrice: 35000, luxePrice: 45000, enabled: true },
                    { id: 'cb_2', name: 'Credenza/Storage', type: 'perUnit', basicPrice: 15000, standardPrice: 20000, luxePrice: 25000, enabled: true },
                    { id: 'cb_3', name: 'Visitor Chairs (Set of 2)', type: 'perUnit', basicPrice: 12000, standardPrice: 18000, luxePrice: 24000, enabled: true },
                    { id: 'cb_4', name: 'Wall Panelling', type: 'perSqft', basicPrice: 450, standardPrice: 600, luxePrice: 800, enabled: true }
                ]
            },
            {
                id: 'commercial_bathroom', name: 'Bathroom', type: 'commercial', order: 6,
                items: [
                    { id: 'cbth_1', name: 'Toilet Partition', type: 'perUnit', basicPrice: 18000, standardPrice: 24000, luxePrice: 30000, enabled: true },
                    { id: 'cbth_2', name: 'Vanity with Mirror', type: 'perUnit', basicPrice: 20000, standardPrice: 28000, luxePrice: 36000, enabled: true },
                    { id: 'cbth_3', name: 'Hand Dryer', type: 'perUnit', basicPrice: 8000, standardPrice: 12000, luxePrice: 16000, enabled: true }
                ]
            }
        ],
        kitchenLayouts: [
            { id: 'kl1', name: 'L-Shape', enabled: true },
            { id: 'kl2', name: 'U-Shape', enabled: true },
            { id: 'kl3', name: 'Parallel', enabled: true },
            { id: 'kl4', name: 'Island', enabled: true },
            { id: 'kl5', name: 'Straight', enabled: true }
        ],
        kitchenMaterials: [
            { id: 'km1', name: 'Marine Ply', enabled: true },
            { id: 'km2', name: 'BWP Ply', enabled: true },
            { id: 'km3', name: 'HDHMR', enabled: true },
            { id: 'km4', name: 'MDF', enabled: true },
            { id: 'km5', name: 'Plywood', enabled: true }
        ],
        carpetAreaSettings: { minSqft: 200, maxSqft: 10000 },
        calculationRules: { gstPercent: 0, discountPercent: 0, designFeePercent: 0, additionalCharges: [] },
        version: 1,
        active: true,
        lastUpdated: new Date().toISOString()
    };
}

export function usePricingConfig(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["pricing-config", tenantId] as const;
    const db = getDb();

    const { data: config = null, isLoading: loading } = useFirestoreDoc<PricingConfig>({
        queryKey: qk,
        docRef: doc(db, `tenants/${tenantId}/pricing/config`),
        mapDoc: (snap) => {
            if (!snap.exists()) return createDefaultConfig();
            const data = snap.data()!;

            const parsed: PricingConfig = {
                categories: data.categories || [],
                kitchenLayouts: data.kitchenLayouts || [],
                kitchenMaterials: data.kitchenMaterials || [],
                carpetAreaSettings: data.carpetAreaSettings || undefined,
                calculationRules: data.calculationRules || undefined,
                version: data.version || 1,
                active: true,
                lastUpdated: data.updatedAt || data.lastUpdated,
            };

            if (!parsed.categories || parsed.categories.length === 0) {
                return createDefaultConfig();
            }

            return parsed;
        },
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const saveConfig = async (newConfig: PricingConfig) => {
        if (!tenantId) return;
        try {
            await setDoc(doc(db, `tenants/${tenantId}/pricing/config`), {
                categories: newConfig.categories || [],
                kitchenLayouts: newConfig.kitchenLayouts || [],
                kitchenMaterials: newConfig.kitchenMaterials || [],
                carpetAreaSettings: newConfig.carpetAreaSettings || null,
                calculationRules: newConfig.calculationRules || null,
                version: (newConfig.version || 0) + 1,
                updatedAt: serverTimestamp(),
            }, { merge: true });

            invalidate();
            return true;
        } catch (error) {
            console.error("Error saving pricing config:", error);
            return false;
        }
    };

    return { config, loading, saveConfig };
}
