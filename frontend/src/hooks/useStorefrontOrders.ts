"use client";

import { useState, useEffect } from "react";

export interface StorefrontOrder {
    id: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    customerCity?: string;
    segment?: string;
    plan?: string;
    carpetArea?: number;
    totalAmount?: number;
    estimatedAmount?: number;
    status: string;
    createdAt?: any;
    tenantId: string;
    pdfUrl?: string;
    timeline?: any[];
    costSummary?: any;
    projectSummary?: any;
    // Aliases used by dashboard
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    assignedTo?: string;
    // Task attachments (drawings) from linked project
    attachments?: Array<{ name: string; url: string; taskName: string }>;
}

export function useStorefrontOrders({
    tenantId,
    userEmail,
    idToken,
}: {
    tenantId: string;
    userEmail: string | null;
    idToken?: string | null;
}) {
    const [orders, setOrders] = useState<StorefrontOrder[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!tenantId || !userEmail) return;
        let cancelled = false;

        const fetchData = () => {
            const headers: HeadersInit = {};
            if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

            fetch(`/api/my-estimates?tenantId=${encodeURIComponent(tenantId)}`, { headers })
                .then((r) => {
                    if (r.status === 401) {
                        // Token expired — show empty state; user must re-login
                        // NOTE: automatic refresh deferred to Phase 6
                        if (!cancelled) setOrders([]);
                        return null;
                    }
                    return r.json();
                })
                .then((data) => {
                    if (data && !cancelled) setOrders(data.estimates ?? []);
                })
                .catch((err) => {
                    console.error("useStorefrontOrders error:", err);
                    if (!cancelled) setOrders([]);
                })
                .finally(() => { if (!cancelled) setLoading(false); });
        };

        setLoading(true);
        fetchData();
        const id = setInterval(fetchData, 30_000); // near-real-time refresh
        return () => { cancelled = true; clearInterval(id); };
    }, [tenantId, userEmail, idToken]);

    return { orders, loading };
}
