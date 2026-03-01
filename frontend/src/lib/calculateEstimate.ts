import { PricingConfig, PricingItem } from "@/hooks/usePricingConfig";

type Plan = 'Basic' | 'Standard' | 'Luxe';

interface ItemQuantity {
    [itemId: string]: number;
}

interface RoomConfig {
    items: ItemQuantity;
}

export interface EstimateInput {
    segment: 'Residential' | 'Commercial';
    selectedPlan: Plan;
    carpetArea: number;
    livingAreaItems: ItemQuantity;
    kitchenItems: ItemQuantity;
    bedrooms: RoomConfig[];
    bathrooms: RoomConfig[];
    cabins: RoomConfig[];
}

export interface BreakdownItem {
    category: string;
    item: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface CostSummary {
    itemsSubtotal: number;
    basePriceCost: number;
    slabMultiplier: number;
    subtotalAfterSlab: number;
    gstAmount: number;
    discountAmount: number;
    designFeeAmount: number;
    additionalCharges: { label: string; amount: number }[];
    grandTotal: number;
}

export interface EstimateResult {
    total: number;
    breakdown: BreakdownItem[];
    costSummary: CostSummary;
}

const emptyCostSummary: CostSummary = {
    itemsSubtotal: 0,
    basePriceCost: 0,
    slabMultiplier: 1,
    subtotalAfterSlab: 0,
    gstAmount: 0,
    discountAmount: 0,
    designFeeAmount: 0,
    additionalCharges: [],
    grandTotal: 0,
};

export function calculateEstimate(config: PricingConfig | null, input: EstimateInput): EstimateResult {
    if (!config?.categories) return { total: 0, breakdown: [], costSummary: emptyCostSummary };

    const { segment, selectedPlan, carpetArea, livingAreaItems, kitchenItems, bedrooms, bathrooms, cabins } = input;
    const area = carpetArea || 0;
    let itemsSubtotal = 0;
    const breakdown: BreakdownItem[] = [];

    const priceKey = selectedPlan === 'Basic' ? 'basicPrice' : selectedPlan === 'Standard' ? 'standardPrice' : 'luxePrice';

    const isItemVisible = (item: PricingItem): boolean => {
        if (!item.planVisibility || item.planVisibility.length === 0) return true;
        return item.planVisibility.includes(selectedPlan);
    };

    const calculateItemCost = (item: PricingItem, quantity: number) => {
        if (item.type === 'fixed') {
            return quantity * item[priceKey];
        } else if (item.type === 'perUnit') {
            return quantity * item[priceKey];
        } else if (item.type === 'perSqft') {
            return area * quantity * item[priceKey];
        }
        return 0;
    };

    const processItems = (items: ItemQuantity, categoryItems: PricingItem[], categoryName: string) => {
        Object.entries(items).forEach(([itemId, quantity]) => {
            if (quantity > 0) {
                const item = categoryItems.find(i => i.id === itemId);
                if (item && item.enabled && isItemVisible(item)) {
                    const cost = calculateItemCost(item, quantity);
                    itemsSubtotal += cost;
                    breakdown.push({
                        category: categoryName,
                        item: item.name,
                        quantity,
                        unitPrice: item[priceKey],
                        total: cost
                    });
                }
            }
        });
    };

    const allCategories = config.categories;
    const categories = allCategories.filter(c => {
        if (segment === 'Residential') return !c.type || c.type === 'residential';
        return c.type === 'commercial';
    });

    categories.forEach(category => {
        const isKitchen = category.id === 'kitchen' || category.name.toLowerCase() === 'kitchen';
        const isBedroom = category.id === 'bedroom' || category.name.toLowerCase() === 'bedroom';
        const isBathroom = category.id === 'bathroom' || category.name.toLowerCase() === 'bathroom';
        const isCabin = category.id === 'cabin' || category.name.toLowerCase().includes('cabin');

        if (isKitchen) {
            processItems(kitchenItems, category.items, category.name);
        } else if (isBedroom) {
            bedrooms.forEach((bedroom, index) => {
                processItems(bedroom.items, category.items, `Bedroom ${index + 1}`);
            });
        } else if (isBathroom) {
            bathrooms.forEach((bathroom, index) => {
                processItems(bathroom.items, category.items, `Bathroom ${index + 1}`);
            });
        } else if (isCabin) {
            cabins.forEach((cabin, index) => {
                processItems(cabin.items, category.items, `Cabin ${index + 1}`);
            });
        } else {
            // Living area, office space, retail shop, and any untyped categories
            processItems(livingAreaItems, category.items, category.name);
        }
    });

    // Base price from carpet area
    const basePriceCost = area * (config.carpetAreaSettings?.basePricePerSqft || 0);

    // Slab multiplier
    let slabMultiplier = 1;
    if (config.carpetAreaSettings?.rateSlabs && config.carpetAreaSettings.rateSlabs.length > 0) {
        const matchingSlab = config.carpetAreaSettings.rateSlabs.find(
            slab => area >= slab.minSqft && area <= slab.maxSqft
        );
        if (matchingSlab) {
            slabMultiplier = matchingSlab.multiplier;
        }
    }

    const subtotalAfterSlab = (itemsSubtotal + basePriceCost) * slabMultiplier;

    // Calculation rules pipeline
    const rules = config.calculationRules;
    const discountAmount = subtotalAfterSlab * ((rules?.discountPercent || 0) / 100);
    const afterDiscount = subtotalAfterSlab - discountAmount;
    const gstAmount = afterDiscount * ((rules?.gstPercent || 0) / 100);
    const designFeeAmount = afterDiscount * ((rules?.designFeePercent || 0) / 100);

    // Additional charges
    const additionalChargesResult: { label: string; amount: number }[] = [];
    let additionalChargesTotal = 0;
    if (rules?.additionalCharges) {
        for (const charge of rules.additionalCharges) {
            if (!charge.enabled) continue;
            const amount = charge.type === 'percentage'
                ? afterDiscount * (charge.value / 100)
                : charge.value;
            additionalChargesResult.push({ label: charge.label, amount });
            additionalChargesTotal += amount;
        }
    }

    let grandTotal = afterDiscount + gstAmount + designFeeAmount + additionalChargesTotal;

    // Round to nearest
    if (rules?.roundToNearest && rules.roundToNearest > 0) {
        grandTotal = Math.round(grandTotal / rules.roundToNearest) * rules.roundToNearest;
    }

    const costSummary: CostSummary = {
        itemsSubtotal: Math.round(itemsSubtotal),
        basePriceCost: Math.round(basePriceCost),
        slabMultiplier,
        subtotalAfterSlab: Math.round(subtotalAfterSlab),
        gstAmount: Math.round(gstAmount),
        discountAmount: Math.round(discountAmount),
        designFeeAmount: Math.round(designFeeAmount),
        additionalCharges: additionalChargesResult,
        grandTotal: Math.round(grandTotal),
    };

    return { total: Math.round(grandTotal), breakdown, costSummary };
}
