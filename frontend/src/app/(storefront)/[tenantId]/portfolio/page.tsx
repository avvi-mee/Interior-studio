"use client";

import { useEffect, useState, use } from "react";
import { Loader2 } from "lucide-react";
import { getDb } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, query, orderBy, onSnapshot } from "firebase/firestore";
import { resolveTenant } from "@/lib/firestoreHelpers";
import type { PortfolioProject, ThemeConfig } from "@/types/website";

export default function PortfolioPage({ params }: { params: Promise<{ tenantId: string }> }) {
    const { tenantId: storeSlug } = use(params);

    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState<PortfolioProject[]>([]);
    const [theme, setTheme] = useState<ThemeConfig | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<"all" | "residential" | "commercial">("all");
    const [selectedProject, setSelectedProject] = useState<PortfolioProject | null>(null);

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

                    // Fetch portfolio projects
                    const portfolioRef = collection(db, `tenants/${tenant.id}/portfolio`);
                    const portfolioQuery = query(portfolioRef, orderBy("sort_order", "asc"));
                    const portfolioSnap = await getDocs(portfolioQuery);

                    if (isMounted) {
                        setProjects(portfolioSnap.docs.map((d) => {
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

                    if (isMounted) setLoading(false);

                    // Realtime: listen for portfolio project changes
                    const portfolioUnsub = onSnapshot(portfolioQuery, (snap) => {
                        if (!isMounted) return;
                        setProjects(snap.docs.map((d) => {
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

                    // Realtime: listen for theme changes
                    const themeUnsub = onSnapshot(themeRef, (snap) => {
                        if (!isMounted || !snap.exists()) return;
                        const data = snap.data();
                        setTheme((data?.content || data) as ThemeConfig);
                    });
                    unsubscribers.push(themeUnsub);
                }
            } catch (error) {
                console.error("Error setting up portfolio listeners:", error);
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

    const primaryColor = theme?.primaryColor || "#ea580c";
    const secondaryColor = theme?.secondaryColor || "#1c1917";

    const filteredProjects = selectedCategory === "all"
        ? projects
        : projects.filter((p) => p.category === selectedCategory);

    return (
        <div className="flex flex-col">
            {/* Header */}
            <section className="py-16 text-center" style={{ backgroundColor: secondaryColor }}>
                <div className="container mx-auto px-4">
                    <h1 className="text-5xl font-bold text-white mb-4">Our Portfolio</h1>
                    <p className="text-gray-300 text-lg max-w-2xl mx-auto">
                        Explore our collection of stunning interior design projects
                    </p>
                </div>
            </section>

            {/* Filter */}
            <section className="container mx-auto px-4 py-8">
                <div className="flex justify-center gap-4">
                    <button
                        onClick={() => setSelectedCategory("all")}
                        className={`px-6 py-2 rounded-full font-medium transition-all ${selectedCategory === "all"
                            ? "text-white shadow-lg"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        style={selectedCategory === "all" ? { backgroundColor: primaryColor } : {}}
                    >
                        All Projects
                    </button>
                    <button
                        onClick={() => setSelectedCategory("residential")}
                        className={`px-6 py-2 rounded-full font-medium transition-all ${selectedCategory === "residential"
                            ? "text-white shadow-lg"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        style={selectedCategory === "residential" ? { backgroundColor: primaryColor } : {}}
                    >
                        Residential
                    </button>
                    <button
                        onClick={() => setSelectedCategory("commercial")}
                        className={`px-6 py-2 rounded-full font-medium transition-all ${selectedCategory === "commercial"
                            ? "text-white shadow-lg"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        style={selectedCategory === "commercial" ? { backgroundColor: primaryColor } : {}}
                    >
                        Commercial
                    </button>
                </div>
            </section>

            {/* Projects Grid */}
            <section className="container mx-auto px-4 pb-24">
                {filteredProjects.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                        <p className="text-lg">No projects found in this category.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredProjects.map((project) => (
                            <div
                                key={project.id}
                                className="group cursor-pointer"
                                onClick={() => setSelectedProject(project)}
                            >
                                <div className="relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300">
                                    {/* Before/After Images */}
                                    <div className="grid grid-cols-2 gap-1">
                                        {project.beforeImageUrl && (
                                            <div className="relative h-64 overflow-hidden">
                                                <img
                                                    src={project.beforeImageUrl}
                                                    alt="Before"
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                />
                                                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                                    Before
                                                </div>
                                            </div>
                                        )}
                                        {project.afterImageUrl && (
                                            <div className="relative h-64 overflow-hidden">
                                                <img
                                                    src={project.afterImageUrl}
                                                    alt="After"
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                />
                                                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                                    After
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                                        <div className="text-white">
                                            <h3 className="text-xl font-bold mb-1">{project.title}</h3>
                                            <p className="text-sm text-gray-300">{project.location}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="mt-4">
                                    <h3 className="font-semibold text-lg mb-1">{project.title}</h3>
                                    <p className="text-sm text-gray-500 mb-2">
                                        {project.category === "residential" ? "Residential" : "Commercial"} • {project.location}
                                    </p>
                                    <p className="text-sm text-gray-600 line-clamp-2">{project.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Project Modal */}
            {selectedProject && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedProject(null)}
                >
                    <div
                        className={`bg-white rounded-2xl w-full max-h-[90vh] overflow-y-auto ${(!selectedProject.imageStyle || selectedProject.imageStyle === 'single')
                            ? 'max-w-4xl' : 'max-w-6xl'}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {(!selectedProject.imageStyle || selectedProject.imageStyle === 'single') ? (
                            <div className="w-full h-[60vh] bg-gray-50 flex items-center justify-center p-4">
                                <img
                                    src={selectedProject.afterImageUrl || selectedProject.beforeImageUrl}
                                    alt={selectedProject.title}
                                    className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
                                />
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-1">
                                {selectedProject.beforeImageUrl && (
                                    <div className="relative h-96">
                                        <img
                                            src={selectedProject.beforeImageUrl}
                                            alt="Before"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded">
                                            Before
                                        </div>
                                    </div>
                                )}
                                {selectedProject.afterImageUrl && (
                                    <div className="relative h-96">
                                        <img
                                            src={selectedProject.afterImageUrl}
                                            alt="After"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded">
                                            After
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="p-8">
                            <h2 className="text-3xl font-bold mb-2">{selectedProject.title}</h2>
                            <p className="text-gray-500 mb-4">
                                {selectedProject.category === "residential" ? "Residential" : "Commercial"} • {selectedProject.location}
                            </p>
                            <p className="text-gray-700 leading-relaxed">{selectedProject.description}</p>
                            <button
                                onClick={() => setSelectedProject(null)}
                                className="mt-6 px-6 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
