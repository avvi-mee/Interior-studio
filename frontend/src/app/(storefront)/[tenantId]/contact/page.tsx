"use client";

import { use, useEffect, useState } from "react";
import { Loader2, MapPin, Phone, Mail, MessageCircle, Instagram } from "lucide-react";
import { getDb } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { resolveTenant } from "@/lib/firestoreHelpers";
import type { ContactPageContent, BrandConfig, ThemeConfig } from "@/types/website";

import ConsultationForm from "@/components/storefront/ConsultationForm";

export default function ContactPage({ params }: { params: Promise<{ tenantId: string }> }) {
    const { tenantId: storeSlug } = use(params);

    const [loading, setLoading] = useState(true);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [contactContent, setContactContent] = useState<ContactPageContent | null>(null);
    const [brand, setBrand] = useState<BrandConfig | null>(null);
    const [theme, setTheme] = useState<ThemeConfig | null>(null);

    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            if (!storeSlug) {
                if (isMounted) setLoading(false);
                return;
            }

            try {
                const db = getDb();

                // Case-insensitive resolution
                const tenant = await resolveTenant(storeSlug);
                if (!tenant) {
                    if (isMounted) setLoading(false);
                    return;
                }

                if (isMounted) {
                    setTenantId(tenant.id);

                    // Fetch brand and theme from their dedicated config docs
                    const [brandSnap, themeSnap, contactSnap] = await Promise.all([
                        getDoc(doc(db, `tenants/${tenant.id}/brand/config`)),
                        getDoc(doc(db, `tenants/${tenant.id}/theme/config`)),
                        getDoc(doc(db, `tenants/${tenant.id}/pages/contact`)),
                    ]);
                    if (brandSnap.exists()) {
                        setBrand((brandSnap.data()?.content || brandSnap.data()) as BrandConfig);
                    }
                    if (themeSnap.exists()) {
                        setTheme((themeSnap.data()?.content || themeSnap.data()) as ThemeConfig);
                    }
                    if (contactSnap.exists()) {
                        setContactContent((contactSnap.data()?.content || contactSnap.data()) as ContactPageContent);
                    }
                }
            } catch (error) {
                console.error("Error loading contact page:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadData();
        return () => { isMounted = false; };
    }, [storeSlug]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-gray-500 font-medium">Loading...</p>
            </div>
        );
    }

    const primaryColor = theme?.primaryColor || "#ea580c";
    const secondaryColor = theme?.secondaryColor || "#1c1917";

    return (
        <div className="flex flex-col min-h-screen bg-white">
            {/* Header */}
            <section className="py-24 text-center" style={{ backgroundColor: secondaryColor }}>
                <div className="container mx-auto px-4">
                    <h1 className="text-5xl font-bold text-white mb-6">Contact Us</h1>
                    <p className="text-gray-400 text-xl max-w-2xl mx-auto leading-relaxed">
                        Have a project in mind? We'd love to hear from you.
                    </p>
                </div>
            </section>

            {/* Content */}
            <section className="container mx-auto px-4 py-32">
                <div className="max-w-7xl mx-auto space-y-32">
                    <div className="grid lg:grid-cols-2 gap-20">
                        {/* Form Section */}
                        <div className="bg-white rounded-[40px] shadow-2xl p-10 md:p-14 border border-gray-50">
                            <div className="mb-10">
                                <h2 className="text-3xl font-bold text-gray-900 mb-4">Send us a Message</h2>
                                <p className="text-gray-500">Fill out the form below and our team will get back to you shortly.</p>
                            </div>
                            {tenantId && (
                                <ConsultationForm
                                    tenantId={tenantId}
                                    storeId={storeSlug}
                                />
                            )}
                        </div>

                        {/* Contact Information */}
                        <div className="space-y-12 py-6">
                            <div className="space-y-4">
                                <h2 className="text-4xl font-bold" style={{ color: secondaryColor }}>
                                    Let&apos;s Discuss Your Space
                                </h2>
                                <p className="text-gray-500 text-lg leading-relaxed">
                                    Our design studio is open for consultations. Visit us or reach out through any of the channels below.
                                </p>
                            </div>

                            <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-8">
                                {contactContent?.address && (
                                    <div className="flex items-start gap-5 p-6 rounded-3xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                                        <div className="h-14 w-14 rounded-2xl bg-white shadow-sm flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                            <MapPin className="h-7 w-7" style={{ color: primaryColor }} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg mb-1">Our Studio</h3>
                                            <p className="text-gray-600 leading-relaxed">{contactContent.address}</p>
                                        </div>
                                    </div>
                                )}

                                {brand?.phone && (
                                    <div className="flex items-start gap-5 p-6 rounded-3xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                                        <div className="h-14 w-14 rounded-2xl bg-white shadow-sm flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                            <Phone className="h-7 w-7" style={{ color: primaryColor }} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg mb-1">Direct Call</h3>
                                            <a href={`tel:${brand.phone}`} className="text-gray-900 font-medium text-lg hover:underline decoration-2 underline-offset-4">
                                                {brand.phone}
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {brand?.email && (
                                    <div className="flex items-start gap-5 p-6 rounded-3xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                                        <div className="h-14 w-14 rounded-2xl bg-white shadow-sm flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                            <Mail className="h-7 w-7" style={{ color: primaryColor }} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg mb-1">Email Us</h3>
                                            <a href={`mailto:${brand.email}`} className="text-gray-900 font-medium text-lg hover:underline decoration-2 underline-offset-4">
                                                {brand.email}
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Social Links */}
                                {(contactContent?.whatsappNumber || contactContent?.instagramUrl || contactContent?.facebookUrl) && (
                                    <div className="pt-4">
                                        <h3 className="font-bold text-lg mb-6">Connect With Us</h3>
                                        <div className="flex gap-4">
                                            {contactContent.whatsappNumber && (
                                                <a
                                                    href={`https://wa.me/${contactContent.whatsappNumber.replace(/[^0-9]/g, "")}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center hover:bg-green-500 hover:text-white transition-all text-green-600 shadow-sm"
                                                >
                                                    <MessageCircle className="h-7 w-7" />
                                                </a>
                                            )}
                                            {contactContent.instagramUrl && (
                                                <a
                                                    href={contactContent.instagramUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center hover:bg-pink-500 hover:text-white transition-all text-pink-600 shadow-sm"
                                                >
                                                    <Instagram className="h-7 w-7" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Map Section */}
                    {contactContent?.googleMapEmbedLink && (
                        <div className="w-full h-[500px] rounded-[40px] overflow-hidden shadow-2xl">
                            <iframe
                                src={contactContent.googleMapEmbedLink}
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                className="grayscale opacity-80"
                            />
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
