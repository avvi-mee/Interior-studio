"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import { useFirestoreDoc, useFirestoreQuery } from "@/lib/firestoreQuery";
import { uploadImage as uploadToStorage } from "@/lib/storageHelpers";
import {
    collection,
    doc,
    query,
    where,
    orderBy,
    setDoc,
    serverTimestamp,
    type DocumentSnapshot,
} from "firebase/firestore";

export interface WebsiteConfig {
    brandName: string;
    headerTitle: string;
    phone: string;
    email: string;
    primaryColor: string;
    secondaryColor: string;
    logoUrl: string;
    faviconUrl: string;
    heroImageUrl: string;
    heroHeading: string;
    heroSubheading: string;
    footerText: string;
    accentColor?: string;
    buttonRadius?: number;
    backgroundColor?: string;
    fontStyle?: "modern" | "elegant" | "minimal";
    updatedAt?: any;
}

const defaultConfig: WebsiteConfig = {
    brandName: "",
    headerTitle: "",
    phone: "",
    email: "",
    primaryColor: "#ea580c",
    secondaryColor: "#1c1917",
    logoUrl: "",
    faviconUrl: "",
    heroImageUrl: "",
    heroHeading: "Design your dream home with perfection.",
    heroSubheading: "From modular kitchens to complete home renovations, we bring luxury and functionality together.",
    footerText: "Transforming spaces into dreams.",
    backgroundColor: "#ffffff",
};

// Helper: map Firestore doc data to WebsiteConfig
function docToConfig(data: any): WebsiteConfig {
    if (!data) return defaultConfig;
    return {
        ...defaultConfig,
        brandName: data.brandName ?? defaultConfig.brandName,
        headerTitle: data.headerTitle ?? defaultConfig.headerTitle,
        phone: data.phone ?? defaultConfig.phone,
        email: data.email ?? defaultConfig.email,
        primaryColor: data.primaryColor ?? defaultConfig.primaryColor,
        secondaryColor: data.secondaryColor ?? defaultConfig.secondaryColor,
        logoUrl: data.logoUrl ?? defaultConfig.logoUrl,
        faviconUrl: data.faviconUrl ?? defaultConfig.faviconUrl,
        heroImageUrl: data.heroImageUrl ?? defaultConfig.heroImageUrl,
        heroHeading: data.heroHeading ?? defaultConfig.heroHeading,
        heroSubheading: data.heroSubheading ?? defaultConfig.heroSubheading,
        footerText: data.footerText ?? defaultConfig.footerText,
        accentColor: data.accentColor ?? undefined,
        buttonRadius: data.buttonRadius ?? undefined,
        backgroundColor: data.backgroundColor ?? defaultConfig.backgroundColor,
        fontStyle: data.fontStyle ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
    };
}

export function useWebsiteConfig(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-config", tenantId] as const;
    const [saving, setSaving] = useState(false);
    const db = getDb();

    // Read from canonical sources: brand/config + theme/config
    const brandDocRef = useMemo(
        () => doc(db, `tenants/${tenantId}/brand/config`),
        [db, tenantId]
    );

    const themeDocRef = useMemo(
        () => doc(db, `tenants/${tenantId}/theme/config`),
        [db, tenantId]
    );

    const { data: brandData = null, isLoading: brandLoading } = useFirestoreDoc<Partial<WebsiteConfig>>({
        queryKey: ["website-config-brand", tenantId],
        docRef: brandDocRef,
        mapDoc: (snap: DocumentSnapshot) => {
            if (!snap.exists()) return {};
            const d = snap.data() ?? {};
            return {
                brandName: d.brandName ?? d.companyName,
                headerTitle: d.headerTitle ?? d.tagline,
                phone: d.phone,
                email: d.email,
                logoUrl: d.logoUrl,
                faviconUrl: d.faviconUrl,
                heroImageUrl: d.heroImageUrl,
                heroHeading: d.heroHeading,
                heroSubheading: d.heroSubheading,
                footerText: d.footerText,
            };
        },
        enabled: !!tenantId,
    });

    const { data: themeData = null, isLoading: themeLoading } = useFirestoreDoc<Partial<WebsiteConfig>>({
        queryKey: ["website-config-theme", tenantId],
        docRef: themeDocRef,
        mapDoc: (snap: DocumentSnapshot) => {
            if (!snap.exists()) return {};
            const d = snap.data() ?? {};
            return {
                primaryColor: d.primaryColor,
                secondaryColor: d.secondaryColor,
                accentColor: d.accentColor,
                buttonRadius: d.buttonRadius,
                backgroundColor: d.backgroundColor,
                fontStyle: d.fontStyle,
            };
        },
        enabled: !!tenantId,
    });

    const config = useMemo(() => ({
        ...defaultConfig,
        ...(brandData ?? {}),
        ...(themeData ?? {}),
    } as WebsiteConfig), [brandData, themeData]);

    const loading = brandLoading || themeLoading;

    const invalidate = useCallback(
        () => {
            queryClient.invalidateQueries({ queryKey: ["website-config-brand", tenantId] });
            queryClient.invalidateQueries({ queryKey: ["website-config-theme", tenantId] });
        },
        [queryClient, tenantId]
    );

    // Save config — writes to brand/config and theme/config (canonical sources)
    const saveConfig = async (updates: Partial<WebsiteConfig>) => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const brandFields: Partial<WebsiteConfig> = {};
            const themeFields: Partial<WebsiteConfig> = {};
            const brandKeys: (keyof WebsiteConfig)[] = [
                "brandName", "headerTitle", "phone", "email",
                "logoUrl", "faviconUrl", "heroImageUrl",
                "heroHeading", "heroSubheading", "footerText",
            ];
            const themeKeys: (keyof WebsiteConfig)[] = [
                "primaryColor", "secondaryColor", "accentColor",
                "buttonRadius", "backgroundColor", "fontStyle",
            ];

            for (const [key, value] of Object.entries(updates)) {
                if (brandKeys.includes(key as keyof WebsiteConfig)) {
                    (brandFields as any)[key] = value;
                }
                if (themeKeys.includes(key as keyof WebsiteConfig)) {
                    (themeFields as any)[key] = value;
                }
            }

            const promises: Promise<void>[] = [];
            if (Object.keys(brandFields).length > 0) {
                promises.push(
                    setDoc(
                        doc(db, `tenants/${tenantId}/brand/config`),
                        { ...brandFields, updatedAt: serverTimestamp() },
                        { merge: true }
                    )
                );
            }
            if (Object.keys(themeFields).length > 0) {
                promises.push(
                    setDoc(
                        doc(db, `tenants/${tenantId}/theme/config`),
                        { ...themeFields, updatedAt: serverTimestamp() },
                        { merge: true }
                    )
                );
            }

            await Promise.all(promises);
            invalidate();
            return true;
        } catch (error) {
            console.error("Error saving website config:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Upload image (uses Firebase Storage)
    const uploadImage = async (file: File, type: "logo" | "hero"): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const url = await uploadToStorage(file, tenantId, "website");

            // Auto-save URL
            const field = type === "logo" ? "logoUrl" : "heroImageUrl";
            await saveConfig({ [field]: url });

            return url;
        } catch (error) {
            console.error("Error uploading image:", error);
            return null;
        }
    };

    return {
        config: config ?? defaultConfig,
        loading,
        saving,
        saveConfig,
        uploadImage,
    };
}

// Public hook - for storefront (no auth required)
export function usePublicWebsiteConfig(storeSlug: string) {
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [resolving, setResolving] = useState(true);
    const db = getDb();

    // Resolve slug to tenant ID
    useEffect(() => {
        if (!storeSlug) {
            setResolving(false);
            return;
        }

        let cancelled = false;

        const timeoutId = setTimeout(() => {
            if (!cancelled) {
                console.warn(`Timeout resolving tenant: ${storeSlug}. Using defaults.`);
                setResolving(false);
            }
        }, 3000);

        const doResolveTenant = async () => {
            try {
                const { resolveTenant } = await import("@/lib/firestoreHelpers");
                const tenant = await resolveTenant(storeSlug);
                if (cancelled) return;
                clearTimeout(timeoutId);
                if (tenant) {
                    setTenantId(tenant.id);
                } else {
                    console.warn(`Tenant not found: ${storeSlug}. Using defaults.`);
                }
                setResolving(false);
            } catch (error) {
                console.error("Error resolving tenant:", error);
                if (!cancelled) {
                    clearTimeout(timeoutId);
                    setResolving(false);
                }
            }
        };

        doResolveTenant();

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [storeSlug]);

    const brandDocRef = useMemo(
        () => doc(db, `tenants/${tenantId}/brand/config`),
        [db, tenantId]
    );

    const themeDocRef = useMemo(
        () => doc(db, `tenants/${tenantId}/theme/config`),
        [db, tenantId]
    );

    const { data: brandData = null, isLoading: brandLoading } = useFirestoreDoc<Partial<WebsiteConfig>>({
        queryKey: ["public-brand-config", tenantId],
        docRef: brandDocRef,
        mapDoc: (snap: DocumentSnapshot) => {
            if (!snap.exists()) return {};
            const d = snap.data() ?? {};
            return {
                brandName: d.brandName ?? d.companyName,
                headerTitle: d.headerTitle ?? d.tagline,
                phone: d.phone,
                email: d.email,
                logoUrl: d.logoUrl,
                faviconUrl: d.faviconUrl,
                footerText: d.footerText,
            };
        },
        enabled: !!tenantId,
    });

    const { data: themeData = null, isLoading: themeLoading } = useFirestoreDoc<Partial<WebsiteConfig>>({
        queryKey: ["public-theme-config", tenantId],
        docRef: themeDocRef,
        mapDoc: (snap: DocumentSnapshot) => {
            if (!snap.exists()) return {};
            const d = snap.data() ?? {};
            return {
                primaryColor: d.primaryColor,
                secondaryColor: d.secondaryColor,
                accentColor: d.accentColor,
                buttonRadius: d.buttonRadius,
                backgroundColor: d.backgroundColor,
                fontStyle: d.fontStyle,
            };
        },
        enabled: !!tenantId,
    });

    const config = useMemo(() => {
        return {
            ...defaultConfig,
            ...(brandData ?? {}),
            ...(themeData ?? {}),
        } as WebsiteConfig;
    }, [brandData, themeData]);

    const loading = resolving || brandLoading || themeLoading;

    return { config: config ?? defaultConfig, tenantId, loading };
}

// Public hook - for storefront navigation (reads custom pages)
export function usePublicCustomPages(tenantId: string | null) {
    const db = getDb();

    const collectionRef = useMemo(
        () =>
            query(
                collection(db, `tenants/${tenantId}/customPages`),
                where("isPublished", "==", true),
                orderBy("sortOrder", "asc")
            ),
        [db, tenantId]
    );

    const { data: customPages = [] } = useFirestoreQuery<{ title: string; slug: string; order: number }>({
        queryKey: ["public-custom-pages", tenantId],
        collectionRef,
        mapDoc: (snap: DocumentSnapshot) => {
            const d = snap.data() ?? {};
            return {
                title: d.title ?? "",
                slug: d.slug ?? "",
                order: d.sortOrder ?? 0,
            };
        },
        enabled: !!tenantId,
    });

    return { customPages };
}
