"use client";

import { useEffect, useState, use } from "react";
import { Loader2, Star, Quote } from "lucide-react";
import { getDb } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, query, orderBy, onSnapshot } from "firebase/firestore";
import { resolveTenant } from "@/lib/firestoreHelpers";
import type { Testimonial, ThemeConfig } from "@/types/website";

export default function TestimonialsPage({ params }: { params: Promise<{ tenantId: string }> }) {
    const { tenantId: storeSlug } = use(params);

    const [loading, setLoading] = useState(true);
    const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
    const [theme, setTheme] = useState<ThemeConfig | null>(null);

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
                const tenant = await resolveTenant(storeSlug);
                if (!tenant) {
                    if (isMounted) setLoading(false);
                    return;
                }

                if (isMounted) {
                    // Fetch theme config
                    const themeRef = doc(db, `tenants/${tenant.id}/theme/config`);
                    const themeSnap = await getDoc(themeRef);

                    if (themeSnap.exists() && isMounted) {
                        const data = themeSnap.data();
                        setTheme((data?.content || data) as ThemeConfig);
                    }

                    // Fetch testimonials
                    const testimonialsRef = collection(db, `tenants/${tenant.id}/testimonials`);
                    const testimonialsQuery = query(testimonialsRef, orderBy("sort_order", "asc"));
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

                    // Realtime: listen for testimonial changes
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

                    // Realtime: listen for theme changes
                    const themeUnsub = onSnapshot(themeRef, (snap) => {
                        if (!isMounted || !snap.exists()) return;
                        const data = snap.data();
                        setTheme((data?.content || data) as ThemeConfig);
                    });
                    unsubscribers.push(themeUnsub);
                }
            } catch (error) {
                console.error("Error setting up testimonials listeners:", error);
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
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    const secondaryColor = theme?.secondaryColor || "#1c1917";

    return (
        <div className="flex flex-col">
            <section className="py-16 text-center" style={{ backgroundColor: secondaryColor }}>
                <div className="container mx-auto px-4">
                    <h1 className="text-5xl font-bold text-white mb-4">Client Testimonials</h1>
                    <p className="text-gray-300 text-lg max-w-2xl mx-auto">
                        Hear what our satisfied clients have to say about their experience
                    </p>
                </div>
            </section>

            <section className="container mx-auto px-4 py-24">
                {testimonials.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                        <p className="text-lg">No testimonials available yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                        {testimonials.map((testimonial) => (
                            <div
                                key={testimonial.id}
                                className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100"
                            >
                                <Quote className="h-10 w-10 text-gray-300 mb-4" />
                                <p className="text-gray-700 mb-6 leading-relaxed">{testimonial.reviewText}</p>
                                <div className="flex gap-1 mb-4">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Star
                                            key={i}
                                            className={`h-5 w-5 ${i < testimonial.rating
                                                ? "fill-yellow-400 text-yellow-400"
                                                : "text-gray-300"
                                                }`}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center gap-4">
                                    {testimonial.clientImageUrl ? (
                                        <img
                                            src={testimonial.clientImageUrl}
                                            alt={testimonial.clientName}
                                            className="w-14 h-14 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center">
                                            <span className="text-gray-600 font-semibold text-lg">
                                                {testimonial.clientName.charAt(0)}
                                            </span>
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="font-semibold">{testimonial.clientName}</h4>
                                        <p className="text-sm text-gray-500">{testimonial.location}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
