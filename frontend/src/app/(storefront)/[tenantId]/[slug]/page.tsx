"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getDb } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { resolveTenant } from "@/lib/firestoreHelpers";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import type { CustomPage } from "@/types/website";
import type { ThemeConfig } from "@/types/website";

interface CustomPageViewProps {
    params: Promise<{ tenantId: string; slug: string }>;
}

export default function CustomPageView({ params }: CustomPageViewProps) {
    const { tenantId: storeSlug, slug } = use(params);
    const [page, setPage] = useState<CustomPage | null>(null);
    const [theme, setTheme] = useState<ThemeConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useScrollAnimation([loading]);

    useEffect(() => {
        let isMounted = true;

        const loadPage = async () => {
            try {
                const db = getDb();
                const tenant = await resolveTenant(storeSlug);
                if (!tenant) {
                    if (isMounted) { setNotFound(true); setLoading(false); }
                    return;
                }

                // Fetch theme config
                const themeRef = doc(db, `tenants/${tenant.id}/pages/theme`);
                const themeSnap = await getDoc(themeRef);

                if (isMounted && themeSnap.exists()) {
                    const data = themeSnap.data();
                    setTheme((data?.content || data) as ThemeConfig);
                }

                // Query custom pages by slug
                const customPagesRef = collection(db, `tenants/${tenant.id}/customPages`);
                const customPageQuery = query(customPagesRef, where("slug", "==", slug));
                const customPageSnap = await getDocs(customPageQuery);

                if (customPageSnap.empty) {
                    if (isMounted) { setNotFound(true); setLoading(false); }
                    return;
                }

                const customPageData = customPageSnap.docs[0].data();

                // Map DB row to CustomPage interface
                const pageData: CustomPage = {
                    id: customPageSnap.docs[0].id,
                    title: customPageData.title,
                    slug: customPageData.slug,
                    heading: customPageData.heading,
                    description: customPageData.description,
                    imageUrl: customPageData.image_url,
                    showInNav: customPageData.show_in_nav,
                    isPublished: customPageData.is_published,
                    order: customPageData.sort_order,
                };

                if (!pageData.isPublished) {
                    if (isMounted) { setNotFound(true); setLoading(false); }
                    return;
                }

                if (isMounted) {
                    setPage(pageData);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Error loading custom page:", error);
                if (isMounted) { setNotFound(true); setLoading(false); }
            }
        };

        loadPage();
        return () => { isMounted = false; };
    }, [storeSlug, slug]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen pt-20 bg-gray-50">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-gray-500 font-medium">Loading...</p>
            </div>
        );
    }

    if (notFound || !page) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen pt-20 text-center px-4 bg-gray-50">
                <h1 className="text-4xl font-bold mb-4 text-gray-900">Page Not Found</h1>
                <p className="text-gray-600 max-w-md">The page you&apos;re looking for doesn&apos;t exist or has been unpublished.</p>
                <Link href={`/${storeSlug}`}>
                    <Button className="mt-6" variant="outline">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Home
                    </Button>
                </Link>
            </div>
        );
    }

    const secondaryColor = theme?.secondaryColor || "#1c1917";

    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero Header */}
            <section className="py-24 bg-gray-50">
                <div className="container mx-auto px-4 max-w-5xl">
                    <h1
                        className="text-5xl md:text-6xl font-bold leading-tight opacity-0 translate-y-8 transition-all duration-700"
                        style={{ color: secondaryColor }}
                        data-scroll-animate
                    >
                        {page.heading || page.title}
                    </h1>
                </div>
            </section>

            {/* Page Content */}
            <section className="py-20">
                <div className="container mx-auto px-4 max-w-5xl">
                    <div
                        className={`grid ${page.imageUrl ? "md:grid-cols-2" : "md:grid-cols-1"} gap-16 items-start opacity-0 translate-y-8 transition-all duration-700`}
                        data-scroll-animate
                    >
                        <div className="space-y-6">
                            <p className="text-gray-600 text-lg leading-relaxed whitespace-pre-line">
                                {page.description}
                            </p>
                        </div>
                        {page.imageUrl && (
                            <div className="relative h-[400px] md:h-[500px] rounded-3xl overflow-hidden shadow-2xl">
                                <img
                                    src={page.imageUrl}
                                    alt={page.title}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Scroll animation styles */}
            <style jsx global>{`
                [data-scroll-animate] {
                    opacity: 0;
                    transform: translateY(30px);
                }
                [data-scroll-animate].scroll-animate-active {
                    opacity: 1;
                    transform: translateY(0);
                }
            `}</style>
        </div>
    );
}
