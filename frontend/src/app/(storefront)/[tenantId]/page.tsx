"use client";

import React, { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    ArrowRight,
    Loader2,
    CheckCircle,
    Mail,
    Phone,
    Layout,
    Layers,
    Home,
    PencilRuler,
    Palette,
    Armchair,
    DoorOpen,
    Lightbulb
} from "lucide-react";
import { getDb } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit as firestoreLimit, onSnapshot } from "firebase/firestore";
import { resolveTenant } from "@/lib/firestoreHelpers";
import HeroSlider from "@/components/storefront/HeroSlider";
import TestimonialSlider from "@/components/storefront/TestimonialSlider";
import PortfolioCard from "@/components/storefront/PortfolioCard";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { DEFAULT_SECTION_LAYOUT } from "@/hooks/useWebsiteBuilder";
import type { HomePageContent, HomeSectionConfig, BrandConfig, ThemeConfig, PortfolioProject, Testimonial, ContactPageContent } from "@/types/website";

interface StorefrontPageProps {
    params: Promise<{ tenantId: string }>;
}

export default function StorefrontPage({ params }: StorefrontPageProps) {
    const { tenantId: storeSlug } = use(params);

    const [loading, setLoading] = useState(true);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [brand, setBrand] = useState<BrandConfig | null>(null);
    const [theme, setTheme] = useState<ThemeConfig | null>(null);
    const [homeContent, setHomeContent] = useState<HomePageContent | null>(null);
    const [portfolioProjects, setPortfolioProjects] = useState<PortfolioProject[]>([]);
    const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
    const [contactContent, setContactContent] = useState<ContactPageContent | null>(null);

    // Initialize scroll animations
    useScrollAnimation([loading]);

    useEffect(() => {
        let isMounted = true;
        const unsubscribers: (() => void)[] = [];

        const setupListeners = async () => {
            if (!storeSlug) {
                if (isMounted) setLoading(false);
                return;
            }

            try {
                const db = getDb();

                // Resolve tenant ID from store slug (case-insensitive)
                const tenant = await resolveTenant(storeSlug);
                if (!tenant) {
                    console.warn(`Tenant not found for store slug: ${storeSlug}`);
                    if (isMounted) setLoading(false);
                    return;
                }

                if (isMounted) setTenantId(tenant.id);

                // --- Initial data fetch ---

                // Fetch brand and theme from their dedicated config docs
                const brandRef = doc(db, `tenants/${tenant.id}/brand/config`);
                const themeRef = doc(db, `tenants/${tenant.id}/theme/config`);
                const [brandSnap, themeSnap] = await Promise.all([getDoc(brandRef), getDoc(themeRef)]);
                if (isMounted && brandSnap.exists()) {
                    setBrand((brandSnap.data()?.content || brandSnap.data()) as BrandConfig);
                }
                if (isMounted && themeSnap.exists()) {
                    setTheme((themeSnap.data()?.content || themeSnap.data()) as ThemeConfig);
                }

                // Fetch page configs: home, contact
                const pageTypes = ["home", "contact"];
                for (const pageType of pageTypes) {
                    const configRef = doc(db, `tenants/${tenant.id}/pages/${pageType}`);
                    const configSnap = await getDoc(configRef);
                    if (isMounted && configSnap.exists()) {
                        const content = configSnap.data()?.content || configSnap.data();
                        switch (pageType) {
                            case "home":
                                setHomeContent(content as HomePageContent);
                                break;
                            case "contact":
                                setContactContent(content as ContactPageContent);
                                break;
                        }
                    }
                }

                // Fetch portfolio projects (show on homepage, limit 6)
                const portfolioRef = collection(db, `tenants/${tenant.id}/portfolio`);
                const portfolioQuery = query(
                    portfolioRef,
                    where("show_on_homepage", "==", true),
                    orderBy("sort_order", "asc"),
                    firestoreLimit(6)
                );
                const portfolioSnap = await getDocs(portfolioQuery);

                if (isMounted) {
                    setPortfolioProjects(portfolioSnap.docs.map((d) => {
                        const p = d.data();
                        return {
                            id: d.id,
                            title: p.title,
                            category: p.category,
                            description: p.description,
                            beforeImageUrl: p.before_image_url,
                            afterImageUrl: p.after_image_url,
                            imageStyle: p.image_style,
                            location: p.location,
                            showOnHomepage: p.show_on_homepage,
                            order: p.sort_order,
                        };
                    }));
                }

                // Fetch testimonials (show on homepage, limit 6)
                const testimonialsRef = collection(db, `tenants/${tenant.id}/testimonials`);
                const testimonialsQuery = query(
                    testimonialsRef,
                    where("show_on_homepage", "==", true),
                    orderBy("sort_order", "asc"),
                    firestoreLimit(6)
                );
                const testimonialSnap = await getDocs(testimonialsQuery);

                if (isMounted) {
                    setTestimonials(testimonialSnap.docs.map((d) => {
                        const t = d.data();
                        return {
                            id: d.id,
                            clientName: t.client_name,
                            clientTitle: t.client_title,
                            location: t.location,
                            clientImageUrl: t.client_image_url,
                            reviewText: t.review_text,
                            rating: t.rating,
                            showOnHomepage: t.show_on_homepage,
                            order: t.sort_order,
                        };
                    }));
                }

                if (isMounted) setLoading(false);

                // --- Realtime subscriptions via Firestore onSnapshot ---

                // Listen to brand/config and theme/config changes
                const brandUnsub = onSnapshot(brandRef, (snap) => {
                    if (!isMounted || !snap.exists()) return;
                    setBrand((snap.data()?.content || snap.data()) as BrandConfig);
                });
                unsubscribers.push(brandUnsub);

                const themeUnsub = onSnapshot(themeRef, (snap) => {
                    if (!isMounted || !snap.exists()) return;
                    setTheme((snap.data()?.content || snap.data()) as ThemeConfig);
                });
                unsubscribers.push(themeUnsub);

                // Listen to page config changes (home, contact)
                for (const pageType of pageTypes) {
                    const configRef = doc(db, `tenants/${tenant.id}/pages/${pageType}`);
                    const unsub = onSnapshot(configRef, (snap) => {
                        if (!isMounted || !snap.exists()) return;
                        const content = snap.data()?.content || snap.data();
                        switch (pageType) {
                            case "home":
                                setHomeContent(content as HomePageContent);
                                break;
                            case "contact":
                                setContactContent(content as ContactPageContent);
                                break;
                        }
                    });
                    unsubscribers.push(unsub);
                }

                // Listen to portfolio changes
                const portfolioUnsub = onSnapshot(portfolioQuery, (snap) => {
                    if (!isMounted) return;
                    setPortfolioProjects(snap.docs.map((d) => {
                        const p = d.data();
                        return {
                            id: d.id,
                            title: p.title,
                            category: p.category,
                            description: p.description,
                            beforeImageUrl: p.before_image_url,
                            afterImageUrl: p.after_image_url,
                            imageStyle: p.image_style,
                            location: p.location,
                            showOnHomepage: p.show_on_homepage,
                            order: p.sort_order,
                        };
                    }));
                });
                unsubscribers.push(portfolioUnsub);

                // Listen to testimonials changes
                const testimonialUnsub = onSnapshot(testimonialsQuery, (snap) => {
                    if (!isMounted) return;
                    setTestimonials(snap.docs.map((d) => {
                        const t = d.data();
                        return {
                            id: d.id,
                            clientName: t.client_name,
                            clientTitle: t.client_title,
                            location: t.location,
                            clientImageUrl: t.client_image_url,
                            reviewText: t.review_text,
                            rating: t.rating,
                            showOnHomepage: t.show_on_homepage,
                            order: t.sort_order,
                        };
                    }));
                });
                unsubscribers.push(testimonialUnsub);

            } catch (error) {
                console.error("Error setting up listeners:", error);
                if (isMounted) setLoading(false);
            }
        };

        setupListeners();
        return () => {
            isMounted = false;
            unsubscribers.forEach(unsub => unsub());
        };
    }, [storeSlug]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen pt-20 bg-gray-50">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-gray-500 font-medium">Loading amazing spaces...</p>
            </div>
        );
    }

    if (!tenantId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen pt-20 text-center px-4 bg-gray-50">
                <h1 className="text-4xl font-bold mb-4 text-gray-900">Store Not Found</h1>
                <p className="text-gray-600 max-w-md">We couldn&apos;t find the store &quot;{storeSlug}&quot;. Please check the URL and try again.</p>
                <Link href="/">
                    <Button className="mt-6" variant="outline">Back to Home</Button>
                </Link>
            </div>
        );
    }

    const primaryColor = theme?.primaryColor || "#0F172A";
    const secondaryColor = theme?.secondaryColor || "#1c1917";
    const accentColor = theme?.accentColor || "#f59e0b";
    const buttonRadius = theme?.buttonRadius || 12;

    const displayPortfolio = portfolioProjects.length > 0 ? portfolioProjects : [
        {
            id: 'sample-1',
            title: 'Modern Minimalist Living',
            category: 'residential',
            description: 'A clean, bright living space focused on functionality and natural light.',
            location: 'Mumbai, India',
            afterImageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
            order: 1
        },
        {
            id: 'sample-2',
            title: 'Luxury Office Suite',
            category: 'commercial',
            description: 'Ergonomic and elegant workspace designed for high-end productivity.',
            location: 'Bangalore, India',
            afterImageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
            order: 2
        }
    ] as PortfolioProject[];

    const displayTestimonials = testimonials.length > 0 ? testimonials : [
        {
            id: 'sample-t1',
            clientName: 'Rahul Sharma',
            clientTitle: 'Home Owner',
            reviewText: 'The team transformed our old bungalow into a modern masterpiece. Highly recommended!',
            rating: 5,
            clientImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
            order: 1
        }
    ] as Testimonial[];

    const displayAbout = homeContent?.aboutPreview || {
        title: "Crafting Exceptional Spaces",
        description: "We specialize in creating interiors that reflect your unique personality and lifestyle. With years of experience and a passion for design, we bring your vision to life.",
        imageUrl: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80"
    };

    const getServiceIcon = (iconName: string, colorClass: string) => {
        const iconProps = { className: `h-8 w-8 ${colorClass}` };
        switch (iconName) {
            case 'Layout': return <Layout {...iconProps} />;
            case 'Layers': return <Layers {...iconProps} />;
            case 'Home': return <Home {...iconProps} />;
            case 'PencilRuler': return <PencilRuler {...iconProps} />;
            case 'Palette': return <Palette {...iconProps} />;
            case 'Armchair': return <Armchair {...iconProps} />;
            case 'DoorOpen': return <DoorOpen {...iconProps} />;
            case 'Lightbulb': return <Lightbulb {...iconProps} />;
            default: return <Layout {...iconProps} />;
        }
    };

    const displayServices = (homeContent?.services && homeContent.services.length > 0)
        ? homeContent.services.map((s, idx) => ({
            ...s,
            icon: getServiceIcon(s.iconUrl, [
                'text-blue-500',
                'text-emerald-500',
                'text-amber-500',
                'text-purple-500',
                'text-rose-500',
                'text-indigo-500'
            ][idx % 6])
        }))
        : [
            {
                id: 's1',
                title: 'Interior Design',
                description: 'Full-service interior design for homes and offices, from concept to completion.',
                icon: <Layout className="h-8 w-8 text-blue-500" />
            },
            {
                id: 's2',
                title: 'Modular Kitchen',
                description: 'Ergonomic and stylish kitchen solutions that maximize space and utility.',
                icon: <Layers className="h-8 w-8 text-green-500" />
            },
            {
                id: 's3',
                title: 'Home Renovation',
                description: 'Transform your existing space into something modern and fresh.',
                icon: <Home className="h-8 w-8 text-orange-500" />
            },
            {
                id: 's4',
                title: 'Custom Furniture',
                description: 'Bespoke furniture pieces designed specifically for your space.',
                icon: <PencilRuler className="h-8 w-8 text-purple-500" />
            }
        ];

    // Compute section layout: use saved layout or fall back to defaults
    const sectionLayout: HomeSectionConfig[] =
        homeContent?.sectionLayout && homeContent.sectionLayout.length > 0
            ? [...homeContent.sectionLayout].sort((a, b) => a.order - b.order)
            : DEFAULT_SECTION_LAYOUT;

    const renderSection = (sectionId: string) => {
        switch (sectionId) {
            case "hero":
                return (
                    <div key="hero" id="hero">
                        <HeroSlider
                            slides={homeContent?.heroSlides || []}
                            primaryColor={primaryColor}
                            tenantId={storeSlug}
                        />
                    </div>
                );

            case "services":
                return (
                    <section
                        key="services"
                        id="services"
                        className="py-32 opacity-0 translate-y-8 transition-all duration-700"
                        data-scroll-animate
                    >
                        <div className="container mx-auto px-4">
                            <div className="text-center mb-16 space-y-4">
                                <h2 className="text-5xl font-bold" style={{ color: secondaryColor }}>
                                    Our Expertise
                                </h2>
                                <p className="text-gray-600 max-w-2xl mx-auto text-lg font-medium">
                                    Comprehensive solutions for all your interior needs
                                </p>
                            </div>
                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
                                {displayServices.map((service) => (
                                    <div
                                        key={service.id}
                                        className="bg-white p-8 rounded-[32px] shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-slate-100 group"
                                    >
                                        <div className="mb-6 h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-white transition-colors">
                                            {service.icon}
                                        </div>
                                        <h3 className="text-xl font-bold mb-4" style={{ color: secondaryColor }}>{service.title}</h3>
                                        <p className="text-gray-500 leading-relaxed text-sm">
                                            {service.description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                );

            case "about":
                return (
                    <section
                        key="about"
                        id="about"
                        className="container mx-auto py-32 px-4 opacity-0 translate-y-8 transition-all duration-700"
                        data-scroll-animate
                    >
                        <div className="grid md:grid-cols-2 gap-16 items-center max-w-7xl mx-auto">
                            <div className="space-y-6">
                                <h2 className="text-5xl font-bold leading-tight" style={{ color: secondaryColor }}>
                                    {displayAbout.title}
                                </h2>
                                <p className="text-gray-600 text-lg leading-relaxed">
                                    {displayAbout.description}
                                </p>
                                <Link href={`/${storeSlug}/about`}>
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        className="rounded-xl border-2 hover:bg-gray-50 transition-all duration-300 hover:scale-105"
                                        style={{ borderRadius: `${buttonRadius}px` }}
                                    >
                                        Learn More <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                            {displayAbout.imageUrl && (
                                <div className="relative h-[500px] rounded-3xl overflow-hidden shadow-2xl transition-transform duration-500 hover:scale-[1.02]">
                                    <img
                                        src={displayAbout.imageUrl}
                                        alt={displayAbout.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}
                        </div>
                    </section>
                );

            case "portfolio":
                return (
                    <section
                        key="portfolio"
                        id="portfolio"
                        className="py-32 opacity-0 translate-y-8 transition-all duration-700"
                        data-scroll-animate
                    >
                        <div className="container mx-auto px-4">
                            <div className="text-center mb-16 space-y-4">
                                <h2 className="text-5xl font-bold" style={{ color: secondaryColor }}>
                                    Our Portfolio
                                </h2>
                                <p className="text-gray-600 max-w-2xl mx-auto text-lg">
                                    Explore our recent projects and see how we transform spaces
                                </p>
                            </div>
                            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
                                {displayPortfolio.map((project, index) => (
                                    <PortfolioCard key={project.id} project={project} index={index} />
                                ))}
                            </div>
                            <div className="text-center mt-12">
                                <Link href={`/${storeSlug}/portfolio`}>
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        className="rounded-xl border-2 hover:bg-gray-50 transition-all duration-300"
                                        style={{ borderRadius: `${buttonRadius}px` }}
                                    >
                                        View All Projects <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </section>
                );

            case "testimonials":
                return (
                    <section
                        key="testimonials"
                        id="testimonials"
                        className="py-32 opacity-0 translate-y-8 transition-all duration-700"
                        data-scroll-animate
                    >
                        <div className="container mx-auto px-4">
                            <div className="text-center mb-16 space-y-4">
                                <h2 className="text-5xl font-bold" style={{ color: secondaryColor }}>
                                    Client Testimonials
                                </h2>
                                <p className="text-gray-600 max-w-2xl mx-auto text-lg">
                                    Hear what our satisfied clients have to say about their experience
                                </p>
                            </div>
                            <TestimonialSlider testimonials={displayTestimonials} accentColor={accentColor} />
                        </div>
                    </section>
                );

            case "whyChooseUs":
                return (
                    <section
                        key="whyChooseUs"
                        id="whyChooseUs"
                        className="py-32 opacity-0 translate-y-8 transition-all duration-700"
                        data-scroll-animate
                    >
                        <div className="container mx-auto px-4">
                            <div className="text-center mb-16 space-y-4">
                                <h2 className="text-5xl font-bold" style={{ color: secondaryColor }}>
                                    Why Choose Us
                                </h2>
                                <p className="text-gray-600 max-w-2xl mx-auto text-lg">
                                    What sets us apart from the rest
                                </p>
                            </div>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                                {(homeContent?.whyChooseUs || [])
                                    .sort((a, b) => a.order - b.order)
                                    .map((item) => (
                                    <div
                                        key={item.id}
                                        className="bg-white p-8 rounded-[32px] shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-slate-100"
                                    >
                                        <div className="mb-4 h-12 w-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: primaryColor }}>
                                            {item.order + 1}
                                        </div>
                                        <h3 className="text-xl font-bold mb-3" style={{ color: secondaryColor }}>
                                            {item.title}
                                        </h3>
                                        <p className="text-gray-500 leading-relaxed text-sm">
                                            {item.description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                );

            case "cta":
                return (
                    <section
                        key="cta"
                        id="cta"
                        className="py-32 opacity-0 translate-y-8 transition-all duration-700"
                        data-scroll-animate
                    >
                        <div className="container mx-auto px-4">
                            <div
                                className="max-w-5xl mx-auto rounded-[40px] p-16 text-center text-white space-y-6"
                                style={{ backgroundColor: primaryColor }}
                            >
                                <h2 className="text-5xl font-bold">
                                    {homeContent?.cta?.heading || "Ready to Transform Your Space?"}
                                </h2>
                                <p className="text-xl opacity-90 max-w-2xl mx-auto">
                                    {homeContent?.cta?.subheading || "Let us help you create the interior of your dreams."}
                                </p>
                                {homeContent?.cta?.buttonText && (
                                    <Link href={homeContent.cta.buttonLink || `/${storeSlug}/book-consultation`}>
                                        <Button
                                            size="lg"
                                            className="mt-4 text-lg px-10 py-6 bg-white hover:bg-gray-100"
                                            style={{ color: primaryColor, borderRadius: `${buttonRadius}px` }}
                                        >
                                            {homeContent.cta.buttonText}
                                            <ArrowRight className="ml-2 h-5 w-5" />
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </section>
                );

            case "customSections":
                if (!homeContent?.customSections || homeContent.customSections.length === 0) return null;
                return (
                    <React.Fragment key="customSections">
                        {homeContent.customSections
                            .sort((a, b) => a.order - b.order)
                            .map((section) => (
                                <section
                                    key={section.id}
                                    className="py-32 opacity-0 translate-y-8 transition-all duration-700"
                                    data-scroll-animate
                                >
                                    <div className="container mx-auto px-4">
                                        <div className={`grid ${section.imageUrl ? "md:grid-cols-2" : "md:grid-cols-1"} gap-16 items-center max-w-7xl mx-auto`}>
                                            <div className="space-y-6">
                                                <h2 className="text-5xl font-bold leading-tight" style={{ color: secondaryColor }}>
                                                    {section.title}
                                                </h2>
                                                <p className="text-gray-600 text-lg leading-relaxed whitespace-pre-line">
                                                    {section.description}
                                                </p>
                                            </div>
                                            {section.imageUrl && (
                                                <div className="relative h-[500px] rounded-3xl overflow-hidden shadow-2xl transition-transform duration-500 hover:scale-[1.02]">
                                                    <img
                                                        src={section.imageUrl}
                                                        alt={section.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            ))}
                    </React.Fragment>
                );

            case "contact":
                return (
                    <section
                        key="contact"
                        id="contact"
                        className="py-32 opacity-0 translate-y-8 transition-all duration-700"
                        data-scroll-animate
                    >
                        <div className="container mx-auto px-4">
                            <div className="max-w-6xl mx-auto bg-white rounded-[40px] shadow-2xl overflow-hidden grid md:grid-cols-2">
                                <div className="p-12 md:p-16 space-y-8" style={{ backgroundColor: secondaryColor }}>
                                    <div className="space-y-4">
                                        <h2 className="text-4xl font-bold text-white">Get in Touch</h2>
                                        <p className="text-gray-400 text-lg">
                                            Ready to start your project? Contact us today for a consultation.
                                        </p>
                                    </div>
                                    <div className="space-y-6 pt-4">
                                        {brand?.email && (
                                            <div className="flex items-center gap-4 text-white">
                                                <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
                                                    <Mail className="h-6 w-6" style={{ color: accentColor }} />
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-400">Email us at</p>
                                                    <p className="font-semibold">{brand.email}</p>
                                                </div>
                                            </div>
                                        )}
                                        {brand?.phone && (
                                            <div className="flex items-center gap-4 text-white">
                                                <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
                                                    <Phone className="h-6 w-6" style={{ color: accentColor }} />
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-400">Call us at</p>
                                                    <p className="font-semibold">{brand.phone}</p>
                                                </div>
                                            </div>
                                        )}
                                        {contactContent?.address && (
                                            <div className="flex items-center gap-4 text-white">
                                                <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
                                                    <CheckCircle className="h-6 w-6" style={{ color: accentColor }} />
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-400">Visit us</p>
                                                    <p className="font-semibold">{contactContent.address}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="pt-8 flex flex-col sm:flex-row gap-4">
                                        <Link href={`/${storeSlug}/contact`}>
                                            <Button
                                                size="lg"
                                                className="w-full sm:w-auto text-white"
                                                style={{ backgroundColor: accentColor, borderRadius: `${buttonRadius}px` }}
                                            >
                                                Send Message
                                            </Button>
                                        </Link>
                                        <Link href={`/${storeSlug}/book-consultation`}>
                                            <Button
                                                size="lg"
                                                variant="outline"
                                                className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10"
                                                style={{ borderRadius: `${buttonRadius}px` }}
                                            >
                                                Book Call
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                                <div className="relative h-[400px] md:h-auto">
                                    {contactContent?.googleMapEmbedLink ? (
                                        (() => {
                                            let src = contactContent.googleMapEmbedLink;
                                            if (src.includes("<iframe")) {
                                                src = src.match(/src="([^"]+)"/)?.[1] || "";
                                            }
                                            const isTrustedDomain = src.startsWith("https://www.google.com/maps/embed") ||
                                                src.startsWith("https://maps.google.com/maps");
                                            if (!isTrustedDomain) {
                                                return (
                                                    <div className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center p-6 text-center">
                                                        <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                                                            <Layout className="h-6 w-6 text-red-500" />
                                                        </div>
                                                        <p className="text-gray-500 text-sm">Map unavailable due to security restrictions.</p>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <iframe
                                                    src={src}
                                                    className="absolute inset-0 w-full h-full grayscale opacity-80"
                                                    style={{ border: 0 }}
                                                    allowFullScreen
                                                    loading="lazy"
                                                    referrerPolicy="no-referrer-when-downgrade"
                                                    title="Office Location"
                                                />
                                            );
                                        })()
                                    ) : (
                                        <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                                            <CheckCircle className="h-20 w-20 text-gray-300" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                );

            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col">
            {sectionLayout
                .filter((s) => s.enabled)
                .map((s) => renderSection(s.id))}

            {/* Add global styles for scroll animations */}
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
