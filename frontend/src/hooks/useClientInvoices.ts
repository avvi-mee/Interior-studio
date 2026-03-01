"use client";

import { useState, useEffect, useMemo } from "react";

export interface ClientInvoice {
    id: string;
    invoiceNumber: string;
    amount: number;
    paidAmount: number;
    dueDate: any;
    status: string;
    description?: string;
    createdAt: any;
    projectId: string;
}

export function useClientInvoices({
    tenantId,
    userEmail,
    idToken,
}: {
    tenantId: string;
    userEmail: string | null;
    idToken?: string | null;
}) {
    const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!tenantId || !userEmail) return;
        let cancelled = false;

        const fetchData = () => {
            const headers: HeadersInit = {};
            if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

            fetch(`/api/my-invoices?tenantId=${encodeURIComponent(tenantId)}`, { headers })
                .then((r) => {
                    if (r.status === 401) {
                        // Token expired — show empty state; user must re-login
                        // NOTE: automatic refresh deferred to Phase 6
                        if (!cancelled) setInvoices([]);
                        return null;
                    }
                    return r.json();
                })
                .then((data) => {
                    if (data && !cancelled) setInvoices(data.invoices ?? []);
                })
                .catch((err) => {
                    console.error("useClientInvoices error:", err);
                    if (!cancelled) setInvoices([]);
                })
                .finally(() => { if (!cancelled) setLoading(false); });
        };

        setLoading(true);
        fetchData();
        const id = setInterval(fetchData, 30_000); // near-real-time refresh
        return () => { cancelled = true; clearInterval(id); };
    }, [tenantId, userEmail, idToken]);

    const summary = useMemo(() => {
        const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0);
        const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
        const outstanding = totalInvoiced - totalPaid;
        const overdueCount = invoices.filter((i) => {
            if (i.paidAmount >= i.amount) return false;
            const dueDateMs = i.dueDate instanceof Date ? i.dueDate.getTime()
                : typeof i.dueDate?.toMillis === "function" ? i.dueDate.toMillis()
                : new Date(i.dueDate).getTime();
            return dueDateMs > 0 && dueDateMs < Date.now();
        }).length;
        return { totalInvoiced, totalPaid, outstanding, overdueCount };
    }, [invoices]);

    return { invoices, summary, loading };
}
