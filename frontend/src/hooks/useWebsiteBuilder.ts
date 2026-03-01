"use client";

import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import {
    collection,
    doc,
    query,
    orderBy,
    getDocs,
    getDoc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
} from "firebase/firestore";
import { useFirestoreDoc, useFirestoreQuery } from "@/lib/firestoreQuery";
import type {
    BrandConfig,
    ThemeConfig,
    HomePageContent,
    HomeSectionConfig,
    PortfolioProject,
    Testimonial,
    AboutUsContent,
    ContactPageContent,
    HeroSlide,
    Service,
    WhyChooseUsItem,
    TeamMember,
    CustomContentSection,
    CustomPage,
} from "@/types/website";

export const DEFAULT_SECTION_LAYOUT: HomeSectionConfig[] = [
    { id: "hero",           label: "Hero Slider",     enabled: true,  order: 0 },
    { id: "services",       label: "Our Services",    enabled: true,  order: 1 },
    { id: "about",          label: "About Preview",   enabled: true,  order: 2 },
    { id: "portfolio",      label: "Portfolio",        enabled: true,  order: 3 },
    { id: "testimonials",   label: "Testimonials",    enabled: true,  order: 4 },
    { id: "whyChooseUs",    label: "Why Choose Us",   enabled: false, order: 5 },
    { id: "cta",            label: "Call to Action",   enabled: false, order: 6 },
    { id: "customSections", label: "Custom Sections", enabled: true,  order: 7 },
    { id: "contact",        label: "Contact",          enabled: true,  order: 8 },
];

// ============================================
// PAGE CONFIG HELPERS (Firestore single docs)
// ============================================

async function fetchPageDoc<T>(tenantId: string, collPath: string, docId: string, defaultValue: T): Promise<T> {
    const db = getDb();
    const snap = await getDoc(doc(db, `tenants/${tenantId}/${collPath}`, docId));
    if (!snap.exists()) return defaultValue;
    return (snap.data() as T) ?? defaultValue;
}

async function savePageDoc(tenantId: string, collPath: string, docId: string, updates: Record<string, any>): Promise<boolean> {
    const db = getDb();
    const docRef = doc(db, `tenants/${tenantId}/${collPath}`, docId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
        await updateDoc(docRef, updates);
    } else {
        await setDoc(docRef, updates);
    }
    return true;
}

// ============================================
// BRAND HOOK
// tenants/{tenantId}/brand/config
// ============================================
const DEFAULT_BRAND: BrandConfig = {
    brandName: "",
    headerTitle: "",
    phone: "",
    email: "",
    logoUrl: "",
    faviconUrl: "",
};

export function useBrand(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-brand", tenantId] as const;
    const [saving, setSaving] = useState(false);
    const db = getDb();

    const brandDocRef = useMemo(() => {
        if (!tenantId) return null;
        return doc(db, `tenants/${tenantId}/brand`, "config");
    }, [db, tenantId]);

    const { data: brand = null, isLoading: loading } = useFirestoreDoc<BrandConfig>({
        queryKey: qk,
        docRef: brandDocRef!,
        mapDoc: (snap) => {
            if (!snap.exists()) return DEFAULT_BRAND;
            return { ...DEFAULT_BRAND, ...snap.data() } as BrandConfig;
        },
        enabled: !!tenantId && !!brandDocRef,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const saveBrand = async (updates: Partial<BrandConfig>): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            await savePageDoc(tenantId, "brand", "config", updates);
            invalidate();
            return true;
        } catch (error) {
            console.error("Error saving brand:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const uploadBrandImage = async (
        file: File,
        type: "logo" | "favicon"
    ): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("tenantId", tenantId);
            formData.append("folder", `brand/${type}`);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            const url = data.url;

            const field = type === "logo" ? "logoUrl" : "faviconUrl";
            await saveBrand({ [field]: url });

            return url;
        } catch (error) {
            console.error("Error uploading brand image:", error);
            return null;
        }
    };

    return { brand, loading, saving, saveBrand, uploadBrandImage };
}

// ============================================
// THEME HOOK
// tenants/{tenantId}/theme/config
// ============================================
const DEFAULT_THEME: ThemeConfig = {
    primaryColor: "#ea580c",
    secondaryColor: "#1c1917",
    accentColor: "#f59e0b",
    fontStyle: "modern",
    buttonRadius: 8,
    cardShadow: true,
};

export function useTheme(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-theme", tenantId] as const;
    const [saving, setSaving] = useState(false);
    const db = getDb();

    const themeDocRef = useMemo(() => {
        if (!tenantId) return null;
        return doc(db, `tenants/${tenantId}/theme`, "config");
    }, [db, tenantId]);

    const { data: theme = null, isLoading: loading } = useFirestoreDoc<ThemeConfig>({
        queryKey: qk,
        docRef: themeDocRef!,
        mapDoc: (snap) => {
            if (!snap.exists()) return DEFAULT_THEME;
            return { ...DEFAULT_THEME, ...snap.data() } as ThemeConfig;
        },
        enabled: !!tenantId && !!themeDocRef,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const saveTheme = async (updates: Partial<ThemeConfig>): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            await savePageDoc(tenantId, "theme", "config", updates);
            invalidate();
            return true;
        } catch (error) {
            console.error("Error saving theme:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    return { theme, loading, saving, saveTheme };
}

// ============================================
// HOME PAGE HOOK
// tenants/{tenantId}/pages/home
// ============================================
const DEFAULT_HOME: HomePageContent = {
    heroSlides: [],
    aboutPreview: {
        title: "",
        description: "",
        imageUrl: "",
    },
    services: [],
    whyChooseUs: [],
    cta: {
        heading: "",
        subheading: "",
        buttonText: "",
        buttonLink: "",
    },
    customSections: [],
};

export function useHomePage(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-home", tenantId] as const;
    const [saving, setSaving] = useState(false);
    const db = getDb();

    const homeDocRef = useMemo(() => {
        if (!tenantId) return null;
        return doc(db, `tenants/${tenantId}/pages`, "home");
    }, [db, tenantId]);

    const { data: homeContent = null, isLoading: loading } = useFirestoreDoc<HomePageContent>({
        queryKey: qk,
        docRef: homeDocRef!,
        mapDoc: (snap) => {
            if (!snap.exists()) return DEFAULT_HOME;
            return { ...DEFAULT_HOME, ...snap.data() } as HomePageContent;
        },
        enabled: !!tenantId && !!homeDocRef,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const saveHomeContent = async (
        updates: Partial<HomePageContent>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            await savePageDoc(tenantId, "pages", "home", updates);
            invalidate();
            return true;
        } catch (error) {
            console.error("Error saving home content:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const uploadHomeImage = async (
        file: File,
        section: string
    ): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("tenantId", tenantId);
            formData.append("folder", `pages/home/${section}`);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            return data.url;
        } catch (error) {
            console.error("Error uploading home image:", error);
            return null;
        }
    };

    // Hero Slides
    const addHeroSlide = async (slide: Omit<HeroSlide, "id" | "order">): Promise<boolean> => {
        if (!homeContent) return false;

        const slides = homeContent.heroSlides || [];
        const newSlide: HeroSlide = {
            ...slide,
            id: `slide_${Date.now()}`,
            order: slides.length,
            primaryButtonText: slide.primaryButtonText || "Get Estimate",
            primaryButtonLink: slide.primaryButtonLink || "/estimate",
            secondaryButtonText: slide.secondaryButtonText || "Book Consultation",
            secondaryButtonLink: slide.secondaryButtonLink || "/book-consultation",
        };

        return saveHomeContent({
            heroSlides: [...slides, newSlide],
        });
    };

    const updateHeroSlide = async (
        slideId: string,
        updates: Partial<HeroSlide>
    ): Promise<boolean> => {
        if (!homeContent) return false;

        const slides = homeContent.heroSlides || [];
        const updatedSlides = slides.map((s) =>
            s.id === slideId ? { ...s, ...updates } : s
        );

        return saveHomeContent({ heroSlides: updatedSlides });
    };

    const deleteHeroSlide = async (slideId: string): Promise<boolean> => {
        if (!homeContent) return false;

        const slides = homeContent.heroSlides || [];
        const updatedSlides = slides.filter((s) => s.id !== slideId);
        return saveHomeContent({ heroSlides: updatedSlides });
    };

    const reorderHeroSlides = async (slides: HeroSlide[]): Promise<boolean> => {
        const reorderedSlides = slides.map((slide, index) => ({
            ...slide,
            order: index,
        }));
        return saveHomeContent({ heroSlides: reorderedSlides });
    };

    // Services
    const addService = async (service: Omit<Service, "id" | "order">): Promise<boolean> => {
        if (!homeContent) return false;

        const services = homeContent.services || [];
        const newService: Service = {
            ...service,
            id: `service_${Date.now()}`,
            order: services.length,
        };

        return saveHomeContent({
            services: [...services, newService],
        });
    };

    const updateService = async (
        serviceId: string,
        updates: Partial<Service>
    ): Promise<boolean> => {
        if (!homeContent) return false;

        const services = homeContent.services || [];
        const updatedServices = services.map((s) =>
            s.id === serviceId ? { ...s, ...updates } : s
        );

        return saveHomeContent({ services: updatedServices });
    };

    const deleteService = async (serviceId: string): Promise<boolean> => {
        if (!homeContent) return false;

        const services = homeContent.services || [];
        const updatedServices = services.filter((s) => s.id !== serviceId);
        return saveHomeContent({ services: updatedServices });
    };

    // Why Choose Us
    const addWhyChooseUs = async (
        item: Omit<WhyChooseUsItem, "id" | "order">
    ): Promise<boolean> => {
        if (!homeContent) return false;

        const items = homeContent.whyChooseUs || [];
        const newItem: WhyChooseUsItem = {
            ...item,
            id: `why_${Date.now()}`,
            order: items.length,
        };

        return saveHomeContent({
            whyChooseUs: [...items, newItem],
        });
    };

    const updateWhyChooseUs = async (
        itemId: string,
        updates: Partial<WhyChooseUsItem>
    ): Promise<boolean> => {
        if (!homeContent) return false;

        const items = homeContent.whyChooseUs || [];
        const updatedItems = items.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item
        );

        return saveHomeContent({ whyChooseUs: updatedItems });
    };

    const deleteWhyChooseUs = async (itemId: string): Promise<boolean> => {
        if (!homeContent) return false;

        const items = homeContent.whyChooseUs || [];
        const updatedItems = items.filter((item) => item.id !== itemId);
        return saveHomeContent({ whyChooseUs: updatedItems });
    };

    // Custom Content Sections
    const addCustomSection = async (
        section: Omit<CustomContentSection, "id" | "order">
    ): Promise<boolean> => {
        if (!homeContent) return false;

        const sections = homeContent.customSections || [];
        const newSection: CustomContentSection = {
            ...section,
            id: `section_${Date.now()}`,
            order: sections.length,
        };

        return saveHomeContent({
            customSections: [...sections, newSection],
        });
    };

    const updateCustomSection = async (
        sectionId: string,
        updates: Partial<CustomContentSection>
    ): Promise<boolean> => {
        if (!homeContent) return false;

        const sections = homeContent.customSections || [];
        const updatedSections = sections.map((s) =>
            s.id === sectionId ? { ...s, ...updates } : s
        );

        return saveHomeContent({ customSections: updatedSections });
    };

    const deleteCustomSection = async (sectionId: string): Promise<boolean> => {
        if (!homeContent) return false;

        const sections = homeContent.customSections || [];
        const updatedSections = sections.filter((s) => s.id !== sectionId);
        return saveHomeContent({ customSections: updatedSections });
    };

    const getSectionLayout = (): HomeSectionConfig[] => {
        if (homeContent?.sectionLayout && homeContent.sectionLayout.length > 0) {
            return [...homeContent.sectionLayout].sort((a, b) => a.order - b.order);
        }
        return DEFAULT_SECTION_LAYOUT;
    };

    const saveSectionLayout = async (layout: HomeSectionConfig[]): Promise<boolean> => {
        const reindexed = layout.map((section, index) => ({
            ...section,
            order: index,
        }));
        return saveHomeContent({ sectionLayout: reindexed });
    };

    return {
        homeContent,
        loading,
        saving,
        saveHomeContent,
        uploadHomeImage,
        addHeroSlide,
        updateHeroSlide,
        deleteHeroSlide,
        reorderHeroSlides,
        addService,
        updateService,
        deleteService,
        addWhyChooseUs,
        updateWhyChooseUs,
        deleteWhyChooseUs,
        addCustomSection,
        updateCustomSection,
        deleteCustomSection,
        getSectionLayout,
        saveSectionLayout,
    };
}

// ============================================
// CUSTOM PAGES HOOK
// tenants/{tenantId}/customPages
// ============================================
const RESERVED_SLUGS = [
    "about", "about-us", "portfolio", "testimonials", "contact",
    "estimate", "book-consultation", "dashboard", "login", "signup",
    "forgot-password", "store", "services", "admin",
];

export function useCustomPages(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-custom-pages", tenantId] as const;
    const [saving, setSaving] = useState(false);
    const db = getDb();

    const customPagesQuery = useMemo(() => {
        if (!tenantId) return null;
        return query(
            collection(db, `tenants/${tenantId}/customPages`),
            orderBy("sortOrder", "asc")
        );
    }, [db, tenantId]);

    const { data: customPages = [], isLoading: loading } = useFirestoreQuery<CustomPage>({
        queryKey: qk,
        collectionRef: customPagesQuery!,
        mapDoc: (snap) => {
            const data = snap.data() || {};
            return {
                id: snap.id,
                title: data.title || "",
                slug: data.slug || "",
                heading: data.heading || "",
                description: data.description || "",
                imageUrl: data.imageUrl || "",
                showInNav: data.showInNav ?? false,
                isPublished: data.isPublished ?? false,
                order: data.sortOrder ?? 0,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
            } as CustomPage;
        },
        enabled: !!tenantId && !!customPagesQuery,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const generateSlug = (title: string): string => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .trim();
    };

    const isSlugAvailable = (slug: string, excludeId?: string): boolean => {
        if (RESERVED_SLUGS.includes(slug)) return false;
        return !customPages.some((p) => p.slug === slug && p.id !== excludeId);
    };

    const addCustomPage = async (
        page: Omit<CustomPage, "id" | "order" | "createdAt">
    ): Promise<boolean> => {
        if (!tenantId) return false;

        if (!isSlugAvailable(page.slug)) return false;

        setSaving(true);
        try {
            const db = getDb();
            await addDoc(collection(db, `tenants/${tenantId}/customPages`), {
                title: page.title,
                slug: page.slug,
                heading: page.heading || null,
                description: page.description || null,
                imageUrl: page.imageUrl || null,
                showInNav: page.showInNav ?? false,
                isPublished: page.isPublished ?? false,
                sortOrder: customPages.length,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            invalidate();
            return true;
        } catch (error) {
            console.error("Error adding custom page:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const updateCustomPage = async (
        pageId: string,
        updates: Partial<CustomPage>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        if (updates.slug && !isSlugAvailable(updates.slug, pageId)) return false;

        setSaving(true);
        try {
            const db = getDb();
            const dbUpdates: Record<string, any> = {
                updatedAt: serverTimestamp(),
            };
            if (updates.title !== undefined) dbUpdates.title = updates.title;
            if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
            if (updates.heading !== undefined) dbUpdates.heading = updates.heading;
            if (updates.description !== undefined) dbUpdates.description = updates.description;
            if (updates.imageUrl !== undefined) dbUpdates.imageUrl = updates.imageUrl;
            if (updates.showInNav !== undefined) dbUpdates.showInNav = updates.showInNav;
            if (updates.isPublished !== undefined) dbUpdates.isPublished = updates.isPublished;
            if (updates.order !== undefined) dbUpdates.sortOrder = updates.order;

            await updateDoc(doc(db, `tenants/${tenantId}/customPages`, pageId), dbUpdates);
            invalidate();
            return true;
        } catch (error) {
            console.error("Error updating custom page:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const deleteCustomPage = async (pageId: string): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const db = getDb();
            await deleteDoc(doc(db, `tenants/${tenantId}/customPages`, pageId));
            invalidate();
            return true;
        } catch (error) {
            console.error("Error deleting custom page:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const uploadCustomPageImage = async (file: File): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("tenantId", tenantId);
            formData.append("folder", "pages/custom");

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            return data.url;
        } catch (error) {
            console.error("Error uploading custom page image:", error);
            return null;
        }
    };

    return {
        customPages,
        loading,
        saving,
        generateSlug,
        isSlugAvailable,
        addCustomPage,
        updateCustomPage,
        deleteCustomPage,
        uploadCustomPageImage,
    };
}

// ============================================
// PORTFOLIO HOOK
// tenants/{tenantId}/portfolio
// ============================================
export function usePortfolio(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-portfolio", tenantId] as const;
    const [saving, setSaving] = useState(false);
    const db = getDb();

    const portfolioQuery = useMemo(() => {
        if (!tenantId) return null;
        return query(
            collection(db, `tenants/${tenantId}/portfolio`),
            orderBy("sortOrder", "asc")
        );
    }, [db, tenantId]);

    const { data: projects = [], isLoading: loading } = useFirestoreQuery<PortfolioProject>({
        queryKey: qk,
        collectionRef: portfolioQuery!,
        mapDoc: (snap) => {
            const data = snap.data() || {};
            return {
                id: snap.id,
                title: data.title || "",
                category: data.category || "residential",
                description: data.description || "",
                beforeImageUrl: data.beforeImageUrl || "",
                afterImageUrl: data.afterImageUrl || data.imageUrl || "",
                imageStyle: data.imageStyle || "single",
                location: data.location || "",
                showOnHomepage: data.showOnHomepage ?? false,
                order: data.sortOrder ?? 0,
                createdAt: data.createdAt,
            } as PortfolioProject;
        },
        enabled: !!tenantId && !!portfolioQuery,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const addProject = async (
        project: Omit<PortfolioProject, "id" | "order" | "createdAt">
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const db = getDb();
            await addDoc(collection(db, `tenants/${tenantId}/portfolio`), {
                title: project.title,
                category: project.category,
                description: project.description || null,
                imageUrl: project.afterImageUrl || null,
                beforeImageUrl: project.beforeImageUrl || null,
                afterImageUrl: project.afterImageUrl || null,
                imageStyle: project.imageStyle || "single",
                location: project.location || null,
                showOnHomepage: project.showOnHomepage ?? false,
                sortOrder: projects.length,
                createdAt: serverTimestamp(),
            });
            invalidate();
            return true;
        } catch (error) {
            console.error("Error adding project:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const updateProject = async (
        projectId: string,
        updates: Partial<PortfolioProject>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const db = getDb();
            const dbUpdates: Record<string, any> = {};
            if (updates.title !== undefined) dbUpdates.title = updates.title;
            if (updates.category !== undefined) dbUpdates.category = updates.category;
            if (updates.description !== undefined) dbUpdates.description = updates.description;
            if (updates.beforeImageUrl !== undefined) dbUpdates.beforeImageUrl = updates.beforeImageUrl;
            if (updates.afterImageUrl !== undefined) {
                dbUpdates.afterImageUrl = updates.afterImageUrl;
                dbUpdates.imageUrl = updates.afterImageUrl;
            }
            if (updates.imageStyle !== undefined) dbUpdates.imageStyle = updates.imageStyle;
            if (updates.location !== undefined) dbUpdates.location = updates.location;
            if (updates.showOnHomepage !== undefined) dbUpdates.showOnHomepage = updates.showOnHomepage;
            if (updates.order !== undefined) dbUpdates.sortOrder = updates.order;

            await updateDoc(doc(db, `tenants/${tenantId}/portfolio`, projectId), dbUpdates);
            invalidate();
            return true;
        } catch (error) {
            console.error("Error updating project:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const deleteProject = async (projectId: string): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const db = getDb();
            await deleteDoc(doc(db, `tenants/${tenantId}/portfolio`, projectId));
            invalidate();
            return true;
        } catch (error) {
            console.error("Error deleting project:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const uploadProjectImage = async (file: File): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("tenantId", tenantId);
            formData.append("folder", "pages/portfolio");

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            return data.url;
        } catch (error) {
            console.error("Error uploading project image:", error);
            return null;
        }
    };

    return {
        projects,
        loading,
        saving,
        addProject,
        updateProject,
        deleteProject,
        uploadProjectImage,
    };
}

// ============================================
// TESTIMONIALS HOOK
// tenants/{tenantId}/testimonials
// ============================================
export function useTestimonials(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-testimonials", tenantId] as const;
    const [saving, setSaving] = useState(false);
    const db = getDb();

    const testimonialsQuery = useMemo(() => {
        if (!tenantId) return null;
        return query(
            collection(db, `tenants/${tenantId}/testimonials`),
            orderBy("sortOrder", "asc")
        );
    }, [db, tenantId]);

    const { data: testimonials = [], isLoading: loading } = useFirestoreQuery<Testimonial>({
        queryKey: qk,
        collectionRef: testimonialsQuery!,
        mapDoc: (snap) => {
            const data = snap.data() || {};
            return {
                id: snap.id,
                clientName: data.clientName || "",
                clientTitle: data.clientTitle || "",
                location: data.location,
                clientImageUrl: data.clientImageUrl || "",
                reviewText: data.reviewText || "",
                rating: data.rating || 5,
                showOnHomepage: data.showOnHomepage ?? false,
                order: data.sortOrder ?? 0,
                createdAt: data.createdAt,
            } as Testimonial;
        },
        enabled: !!tenantId && !!testimonialsQuery,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const addTestimonial = async (
        testimonial: Omit<Testimonial, "id" | "order" | "createdAt">
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const db = getDb();
            await addDoc(collection(db, `tenants/${tenantId}/testimonials`), {
                clientName: testimonial.clientName,
                clientTitle: testimonial.clientTitle || null,
                location: testimonial.location || null,
                clientImageUrl: testimonial.clientImageUrl || null,
                reviewText: testimonial.reviewText,
                rating: testimonial.rating,
                showOnHomepage: testimonial.showOnHomepage ?? false,
                sortOrder: testimonials.length,
                createdAt: serverTimestamp(),
            });
            invalidate();
            return true;
        } catch (error) {
            console.error("Error adding testimonial:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const updateTestimonial = async (
        testimonialId: string,
        updates: Partial<Testimonial>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const db = getDb();
            const dbUpdates: Record<string, any> = {};
            if (updates.clientName !== undefined) dbUpdates.clientName = updates.clientName;
            if (updates.clientTitle !== undefined) dbUpdates.clientTitle = updates.clientTitle;
            if (updates.location !== undefined) dbUpdates.location = updates.location;
            if (updates.clientImageUrl !== undefined) dbUpdates.clientImageUrl = updates.clientImageUrl;
            if (updates.reviewText !== undefined) dbUpdates.reviewText = updates.reviewText;
            if (updates.rating !== undefined) dbUpdates.rating = updates.rating;
            if (updates.showOnHomepage !== undefined) dbUpdates.showOnHomepage = updates.showOnHomepage;
            if (updates.order !== undefined) dbUpdates.sortOrder = updates.order;

            await updateDoc(doc(db, `tenants/${tenantId}/testimonials`, testimonialId), dbUpdates);
            invalidate();
            return true;
        } catch (error) {
            console.error("Error updating testimonial:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const deleteTestimonial = async (testimonialId: string): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const db = getDb();
            await deleteDoc(doc(db, `tenants/${tenantId}/testimonials`, testimonialId));
            invalidate();
            return true;
        } catch (error) {
            console.error("Error deleting testimonial:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const uploadTestimonialImage = async (file: File): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("tenantId", tenantId);
            formData.append("folder", "pages/testimonials");

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            return data.url;
        } catch (error) {
            console.error("Error uploading testimonial image:", error);
            return null;
        }
    };

    return {
        testimonials,
        loading,
        saving,
        addTestimonial,
        updateTestimonial,
        deleteTestimonial,
        uploadTestimonialImage,
    };
}

// ============================================
// ABOUT US HOOK
// tenants/{tenantId}/pages/about
// ============================================
const DEFAULT_ABOUT: AboutUsContent = {
    mainHeading: "",
    companyStory: "",
    vision: "",
    mission: "",
    founderName: "",
    founderRole: "",
    founderDescription: "",
    founderImageUrl: "",
    founderLinkedinUrl: "",
    founderInstagramUrl: "",
    yearsExperience: 0,
    projectsCompleted: 0,
};

export function useAboutUs(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-about", tenantId] as const;
    const [saving, setSaving] = useState(false);
    const db = getDb();

    const aboutDocRef = useMemo(() => {
        if (!tenantId) return null;
        return doc(db, `tenants/${tenantId}/pages`, "about");
    }, [db, tenantId]);

    const { data: aboutContent = null, isLoading: loading } = useFirestoreDoc<AboutUsContent>({
        queryKey: qk,
        docRef: aboutDocRef!,
        mapDoc: (snap) => {
            if (!snap.exists()) return DEFAULT_ABOUT;
            return { ...DEFAULT_ABOUT, ...snap.data() } as AboutUsContent;
        },
        enabled: !!tenantId && !!aboutDocRef,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const saveAboutContent = async (
        updates: Partial<AboutUsContent>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            await savePageDoc(tenantId, "pages", "about", updates);
            invalidate();
            return true;
        } catch (error) {
            console.error("Error saving about content:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const uploadAboutImage = async (file: File): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("tenantId", tenantId);
            formData.append("folder", "pages/about");

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            return data.url;
        } catch (error) {
            console.error("Error uploading about image:", error);
            return null;
        }
    };

    return {
        aboutContent,
        loading,
        saving,
        saveAboutContent,
        uploadAboutImage,
    };
}

// ============================================
// CONTACT HOOK
// tenants/{tenantId}/pages/contact
// ============================================
const DEFAULT_CONTACT: ContactPageContent = {
    address: "",
    googleMapEmbedLink: "",
    whatsappNumber: "",
    instagramUrl: "",
    facebookUrl: "",
    officeHours: "",
};

export function useContact(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-contact", tenantId] as const;
    const [saving, setSaving] = useState(false);
    const db = getDb();

    const contactDocRef = useMemo(() => {
        if (!tenantId) return null;
        return doc(db, `tenants/${tenantId}/pages`, "contact");
    }, [db, tenantId]);

    const { data: contactContent = null, isLoading: loading } = useFirestoreDoc<ContactPageContent>({
        queryKey: qk,
        docRef: contactDocRef!,
        mapDoc: (snap) => {
            if (!snap.exists()) return DEFAULT_CONTACT;
            return { ...DEFAULT_CONTACT, ...snap.data() } as ContactPageContent;
        },
        enabled: !!tenantId && !!contactDocRef,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const saveContactContent = async (
        updates: Partial<ContactPageContent>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            await savePageDoc(tenantId, "pages", "contact", updates);
            invalidate();
            return true;
        } catch (error) {
            console.error("Error saving contact content:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    return {
        contactContent,
        loading,
        saving,
        saveContactContent,
    };
}

// ============================================
// TEAM MEMBERS HOOK (website display team)
// tenants/{tenantId}/teamMembers
// ============================================
export function useTeamMembers(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-team-members", tenantId] as const;
    const [saving, setSaving] = useState(false);
    const db = getDb();

    const teamMembersQuery = useMemo(() => {
        if (!tenantId) return null;
        return query(
            collection(db, `tenants/${tenantId}/teamMembers`),
            orderBy("sortOrder", "asc")
        );
    }, [db, tenantId]);

    const { data: teamMembers = [], isLoading: loading } = useFirestoreQuery<TeamMember>({
        queryKey: qk,
        collectionRef: teamMembersQuery!,
        mapDoc: (snap) => {
            const data = snap.data() || {};
            const social = data.socialLinks || {};
            return {
                id: snap.id,
                name: data.name || "",
                role: data.role || "",
                bio: data.bio || "",
                imageUrl: data.imageUrl || "",
                linkedinUrl: social.linkedin || "",
                instagramUrl: social.instagram || "",
                order: data.sortOrder ?? 0,
                createdAt: data.createdAt,
            } as TeamMember;
        },
        enabled: !!tenantId && !!teamMembersQuery,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const addTeamMember = async (
        member: Omit<TeamMember, "id" | "order" | "createdAt">
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const db = getDb();
            const socialLinks: Record<string, string> = {};
            if (member.linkedinUrl) socialLinks.linkedin = member.linkedinUrl;
            if (member.instagramUrl) socialLinks.instagram = member.instagramUrl;

            await addDoc(collection(db, `tenants/${tenantId}/teamMembers`), {
                name: member.name,
                role: member.role || null,
                bio: member.bio || null,
                imageUrl: member.imageUrl || null,
                socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : null,
                sortOrder: teamMembers.length,
                createdAt: serverTimestamp(),
            });
            invalidate();
            return true;
        } catch (error) {
            console.error("Error adding team member:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const updateTeamMember = async (
        memberId: string,
        updates: Partial<TeamMember>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const db = getDb();
            const dbUpdates: Record<string, any> = {};
            if (updates.name !== undefined) dbUpdates.name = updates.name;
            if (updates.role !== undefined) dbUpdates.role = updates.role;
            if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
            if (updates.imageUrl !== undefined) dbUpdates.imageUrl = updates.imageUrl;
            if (updates.order !== undefined) dbUpdates.sortOrder = updates.order;

            if (updates.linkedinUrl !== undefined || updates.instagramUrl !== undefined) {
                // Fetch current socialLinks to merge
                const memberDocRef = doc(db, `tenants/${tenantId}/teamMembers`, memberId);
                const currentSnap = await getDoc(memberDocRef);
                const currentData = currentSnap.exists() ? currentSnap.data() : {};
                const social = { ...(currentData?.socialLinks || {}) };
                if (updates.linkedinUrl !== undefined) social.linkedin = updates.linkedinUrl;
                if (updates.instagramUrl !== undefined) social.instagram = updates.instagramUrl;
                dbUpdates.socialLinks = social;
            }

            await updateDoc(doc(db, `tenants/${tenantId}/teamMembers`, memberId), dbUpdates);
            invalidate();
            return true;
        } catch (error) {
            console.error("Error updating team member:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const deleteTeamMember = async (memberId: string): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const db = getDb();
            await deleteDoc(doc(db, `tenants/${tenantId}/teamMembers`, memberId));
            invalidate();
            return true;
        } catch (error) {
            console.error("Error deleting team member:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const uploadTeamMemberImage = async (file: File): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("tenantId", tenantId);
            formData.append("folder", "pages/about/team");

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            return data.url;
        } catch (error) {
            console.error("Error uploading team member image:", error);
            return null;
        }
    };

    return {
        teamMembers,
        loading,
        saving,
        addTeamMember,
        updateTeamMember,
        deleteTeamMember,
        uploadTeamMemberImage,
    };
}
