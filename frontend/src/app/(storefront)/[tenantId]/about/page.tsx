"use client";

import { use, useEffect, useState } from "react";
import { Loader2, Target, Eye } from "lucide-react";
import { getDb } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { resolveTenant } from "@/lib/firestoreHelpers";
import type { AboutUsContent, ThemeConfig, TeamMember } from "@/types/website";

export default function AboutPage({ params }: { params: Promise<{ tenantId: string }> }) {
    const { tenantId: storeSlug } = use(params);

    const [loading, setLoading] = useState(true);
    const [aboutContent, setAboutContent] = useState<AboutUsContent | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
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
                const tenant = await resolveTenant(storeSlug);
                if (!tenant) {
                    if (isMounted) setLoading(false);
                    return;
                }

                if (isMounted) {
                    // Fetch theme and about page configs in parallel
                    const [themeSnap, aboutSnap, teamSnap] = await Promise.all([
                        getDoc(doc(db, `tenants/${tenant.id}/theme/config`)),
                        getDoc(doc(db, `tenants/${tenant.id}/pages/about`)),
                        getDocs(query(
                            collection(db, `tenants/${tenant.id}/teamMembers`),
                            orderBy("sort_order", "asc")
                        )),
                    ]);

                    if (themeSnap.exists()) {
                        const data = themeSnap.data();
                        setTheme((data?.content || data) as ThemeConfig);
                    }

                    if (aboutSnap.exists()) {
                        const data = aboutSnap.data();
                        setAboutContent((data?.content || data) as AboutUsContent);
                    }

                    // Map team members from snake_case DB columns to camelCase
                    if (!teamSnap.empty) {
                        setTeamMembers(teamSnap.docs.map((d) => {
                            const row = d.data();
                            return {
                                id: d.id,
                                name: row.name,
                                role: row.role,
                                bio: row.bio,
                                imageUrl: row.image_url,
                                linkedinUrl: row.social_links?.linkedin,
                                instagramUrl: row.social_links?.instagram,
                                order: row.sort_order,
                            };
                        }));
                    }
                }
            } catch (error) {
                console.error("Error loading about page:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadData();
        return () => { isMounted = false; };
    }, [storeSlug]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    const primaryColor = theme?.primaryColor || "#ea580c";
    const secondaryColor = theme?.secondaryColor || "#1c1917";

    return (
        <div className="flex flex-col">
            <section className="py-16 text-center" style={{ backgroundColor: secondaryColor }}>
                <div className="container mx-auto px-4">
                    <h1 className="text-5xl font-bold text-white mb-4">
                        {aboutContent?.mainHeading || "About Us"}
                    </h1>
                </div>
            </section>

            {aboutContent?.companyStory && (
                <section className="container mx-auto px-4 py-24">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-3xl font-bold mb-6" style={{ color: secondaryColor }}>
                            Our Story
                        </h2>
                        <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-line">
                            {aboutContent.companyStory}
                        </p>
                    </div>
                </section>
            )}

            {(aboutContent?.vision || aboutContent?.mission) && (
                <section className="bg-gray-50 py-24">
                    <div className="container mx-auto px-4">
                        <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
                            {aboutContent.vision && (
                                <div className="bg-white p-8 rounded-2xl shadow-lg">
                                    <Eye className="h-12 w-12 mb-4" style={{ color: primaryColor }} />
                                    <h3 className="text-2xl font-bold mb-4">Our Vision</h3>
                                    <p className="text-gray-700 leading-relaxed">{aboutContent.vision}</p>
                                </div>
                            )}
                            {aboutContent.mission && (
                                <div className="bg-white p-8 rounded-2xl shadow-lg">
                                    <Target className="h-12 w-12 mb-4" style={{ color: primaryColor }} />
                                    <h3 className="text-2xl font-bold mb-4">Our Mission</h3>
                                    <p className="text-gray-700 leading-relaxed">{aboutContent.mission}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {((aboutContent?.yearsExperience && aboutContent.yearsExperience > 0) || (aboutContent?.projectsCompleted && aboutContent.projectsCompleted > 0)) && (
                <section className="container mx-auto px-4 py-24">
                    <div className="max-w-4xl mx-auto">
                        <div className="grid grid-cols-2 gap-8 max-w-md mx-auto">
                            {aboutContent.yearsExperience! > 0 && (
                                <div className="text-center p-8 bg-gray-50 rounded-2xl">
                                    <div className="text-5xl font-bold mb-2" style={{ color: primaryColor }}>
                                        {aboutContent.yearsExperience}+
                                    </div>
                                    <div className="text-gray-600 font-medium">Years Experience</div>
                                </div>
                            )}
                            {aboutContent.projectsCompleted! > 0 && (
                                <div className="text-center p-8 bg-gray-50 rounded-2xl">
                                    <div className="text-5xl font-bold mb-2" style={{ color: primaryColor }}>
                                        {aboutContent.projectsCompleted}+
                                    </div>
                                    <div className="text-gray-600 font-medium">Projects Completed</div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* Team Section */}
            {teamMembers.length > 0 && (
                <section className="bg-gray-50 py-24">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-bold mb-4" style={{ color: secondaryColor }}>Meet Our Team</h2>
                            <p className="text-gray-600 max-w-2xl mx-auto">The talented people behind our success.</p>
                        </div>
                        <div className={`grid gap-8 max-w-6xl mx-auto ${teamMembers.length === 1 ? "md:grid-cols-1 max-w-sm" : teamMembers.length === 2 ? "md:grid-cols-2 max-w-2xl" : teamMembers.length === 3 ? "md:grid-cols-3 max-w-4xl" : "md:grid-cols-2 lg:grid-cols-4"}`}>
                            {teamMembers.map((member) => (
                                <div key={member.id} className="bg-white rounded-2xl overflow-hidden shadow-lg group hover:shadow-xl transition-all duration-300">
                                    <div className="relative h-80 overflow-hidden">
                                        {member.imageUrl ? (
                                            <img
                                                src={member.imageUrl}
                                                alt={member.name}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                                <span className="text-6xl font-bold text-gray-300">
                                                    {member.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4">
                                            {member.linkedinUrl && (
                                                <a href={member.linkedinUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors">
                                                    <svg className="h-5 w-5 text-gray-900" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                        <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
                                                    </svg>
                                                </a>
                                            )}
                                            {member.instagramUrl && (
                                                <a href={member.instagramUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors">
                                                    <svg className="h-5 w-5 text-gray-900" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                        <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772 4.902 4.902 0 011.772-1.153c.636-.247 1.363-.416 2.427-.465 1.067-.047 1.407-.06 4.123-.06h.08zm0-2c-2.695 0-3.04.01-4.072.054-1.055.044-1.771.219-2.417.472a6.903 6.903 0 00-2.502 1.628 6.904 6.904 0 00-1.628 2.502c-.253.646-.428 1.362-.472 2.417C1.01 7.04 1 7.375 1 10.057v.384c0 2.682.01 3.017.054 4.072.044 1.055.219 1.771.472 2.417a6.904 6.904 0 001.628 2.502 6.903 6.903 0 002.502 1.628c.646.253 1.362.428 2.417.472 1.032.044 1.378.054 4.072.054h.384c2.682 0 3.017-.01 4.072-.054 1.055-.044 1.771-.219 2.417-.472a6.904 6.904 0 002.502-1.628 6.903 6.903 0 001.628-2.502c.253-.646.428-1.362.472-2.417.044-1.032.054-1.378.054-4.072v-.384c0-2.682-.01-3.017-.054-4.072-.044-1.055-.219-1.771-.472-2.417a6.903 6.903 0 00-1.628-2.502 6.904 6.904 0 00-2.502-1.628c-.646-.253-1.362-.428-2.417-.472C15.355 1.01 15.01 1 12.315 1h-.384zm6.096 6.096c-.326 0-.589.263-.589.589v.021a.589.589 0 00.589.589h.021a.589.589 0 00.589-.589v-.021a.589.589 0 00-.589-.589h-.021zM12.315 5.922a6.393 6.393 0 100 12.786 6.393 6.393 0 000-12.786zm0 1.968a4.425 4.425 0 110 8.85 4.425 4.425 0 010-8.85z" clipRule="evenodd" />
                                                    </svg>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <h3 className="text-xl font-bold mb-1" style={{ color: secondaryColor }}>{member.name}</h3>
                                        <div className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: primaryColor }}>{member.role}</div>
                                        <p className="text-gray-600 text-sm leading-relaxed">{member.bio}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
