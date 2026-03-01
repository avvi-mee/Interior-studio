"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { usePublicWebsiteConfig } from "@/hooks/useWebsiteConfig";
import { StorefrontAuthForm } from "@/components/storefront/StorefrontAuthForm";
import { Loader2 } from "lucide-react";

export default function StorefrontLoginPage({ params }: { params: Promise<{ tenantId: string }> }) {
    const { tenantId: tenantSlug } = use(params);
    const searchParams = useSearchParams();
    const next = searchParams.get("next") || undefined;

    const { config: websiteConfig, loading } = usePublicWebsiteConfig(tenantSlug);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    // If ?next= is set (e.g. from estimate flow), use "estimate" intent so signup shows full form
    const intent = next?.includes("estimate") ? "estimate" : "dashboard";

    return (
        <StorefrontAuthForm
            tenantSlug={tenantSlug}
            intent={intent}
            websiteConfig={websiteConfig}
            redirectUrl={next ? `/${tenantSlug}${next}` : undefined}
        />
    );
}
