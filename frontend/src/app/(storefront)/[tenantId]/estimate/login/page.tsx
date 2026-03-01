"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Redirect legacy /estimate/login URL → main login page with estimate intent */
export default function EstimateLoginRedirect({ params }: { params: Promise<{ tenantId: string }> }) {
    const { tenantId: tenantSlug } = use(params);
    const router = useRouter();

    useEffect(() => {
        router.replace(`/${tenantSlug}/login?next=/estimate/review`);
    }, [tenantSlug, router]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
    );
}
