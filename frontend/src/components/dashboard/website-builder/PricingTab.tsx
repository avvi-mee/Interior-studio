"use client";

import { Info } from "lucide-react";
import PricingConfigEditor from "@/components/dashboard/pricing/PricingConfigEditor";

interface PricingTabProps {
    tenantId: string;
}

export default function PricingTab({ tenantId }: PricingTabProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                <Info className="h-5 w-5 mt-0.5 shrink-0" />
                <p>
                    Pricing configured here is <span className="font-semibold">live on your website</span>.
                    Changes are reflected immediately on your storefront estimate page.
                </p>
            </div>
            <PricingConfigEditor tenantId={tenantId} />
        </div>
    );
}
