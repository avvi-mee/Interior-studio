"use client";

import Link from "next/link";
import { Menu, Phone, X, User, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, use, Suspense } from "react";
import { usePublicWebsiteConfig, usePublicCustomPages } from "@/hooks/useWebsiteConfig";
import { StorefrontAuthDialog } from "@/components/storefront/StorefrontAuthDialog";

import { useSearchParams, useRouter } from "next/navigation";

export default function StorefrontLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ tenantId: string }>;
}) {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-500 font-medium">Loading...</p>
            </div>
        }>
            <StorefrontLayoutInner params={params}>{children}</StorefrontLayoutInner>
        </Suspense>
    );
}

function StorefrontLayoutInner({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ tenantId: string }>;
}) {
    const { tenantId } = use(params);
    const searchParams = useSearchParams();

    const { config, tenantId: resolvedTenantId, loading } = usePublicWebsiteConfig(tenantId);
    const { customPages } = usePublicCustomPages(resolvedTenantId);

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);
    const [authTab, setAuthTab] = useState<"login" | "signup">("login");
    const router = useRouter();
    const [user, setUser] = useState<{ email: string; name: string } | null>(null);

    useEffect(() => {
        const checkUser = () => {
            const stored = localStorage.getItem(`storefront_user_${tenantId}`);
            if (stored) {
                try {
                    setUser(JSON.parse(stored));
                } catch { setUser(null); }
            } else {
                setUser(null);
            }
        };
        checkUser();
        window.addEventListener("storage", checkUser);
        return () => window.removeEventListener("storage", checkUser);
    }, [tenantId]);

    const handleLogout = () => {
        localStorage.removeItem(`storefront_user_${tenantId}`);
        setUser(null);
        window.dispatchEvent(new Event("storage"));
        router.push(`/${tenantId}`);
    };

    useEffect(() => {
        if (searchParams.get("openAuth") === "true") {
            setAuthOpen(true);
        }
    }, [searchParams]);

    const openAuth = (tab: "login" | "signup") => {
        setAuthTab(tab);
        setAuthOpen(true);
        setMobileMenuOpen(false);
    };

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Dynamically inject favicon
    // Inject CSS variables for theme
    useEffect(() => {
        if (!config) return;

        if (config.faviconUrl) {
            // Remove existing favicon links
            const existingFavicons = document.querySelectorAll("link[rel*='icon']");
            existingFavicons.forEach(link => link.remove());

            // Add new favicon
            const link = document.createElement('link');
            link.rel = 'icon';
            link.href = config.faviconUrl;
            document.head.appendChild(link);
        }

        // Inject theme CSS variables
        document.documentElement.style.setProperty('--primary', config.primaryColor || "#ea580c");
        document.documentElement.style.setProperty('--secondary', config.secondaryColor || "#1c1917");
        document.documentElement.style.setProperty('--accent', config.accentColor || '#6366f1'); // Default accent
        document.documentElement.style.setProperty('--button-radius', `${config.buttonRadius || 8}px`); // Default button radius
        document.documentElement.style.setProperty('--background', config.backgroundColor || '#ffffff');

        // Set font family based on fontStyle
        let fontFamily = 'Inter, system-ui, sans-serif'; // default modern
        if (config.fontStyle === 'elegant') {
            fontFamily = 'Playfair Display, Georgia, serif';
        } else if (config.fontStyle === 'minimal') {
            fontFamily = 'Helvetica Neue, Arial, sans-serif';
        }
        document.documentElement.style.setProperty('--font-family', fontFamily);
    }, [config]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-500 font-medium">Loading...</p>
            </div>
        );
    }

    // If config is null after loading (tenant not found), just render children (404 page)
    if (!config) {
        return <>{children}</>;
    }

    const brandName = (config?.headerTitle?.trim() || config?.brandName?.trim()) || tenantId;
    const phone = config?.phone;
    const email = config?.email;
    const primaryColor = config?.primaryColor || "#ea580c";
    const secondaryColor = config?.secondaryColor || "#1c1917";
    const footerText = config?.footerText || "Transforming spaces into dreams.";

    // Build dynamic navigation links
    const coreLinks = [
        { name: "Home", href: `/${tenantId}#hero` },
        { name: "Services", href: `/${tenantId}#services` },
        { name: "Portfolio", href: `/${tenantId}#portfolio` },
        { name: "About", href: `/${tenantId}#about` },
        { name: "Contact", href: `/${tenantId}#contact` },
    ];
    const customPageLinks = customPages.map((page) => ({
        name: page.title,
        href: `/${tenantId}/${page.slug}`,
    }));
    const navLinks = [...coreLinks, ...customPageLinks, { name: "Get Estimate", href: `/${tenantId}/estimate` }];

    // Show loading state only for initial load (first 2 seconds max)
    if (loading && !config) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-center space-y-4">
                    <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-gray-600 font-medium">Loading {tenantId}...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col font-sans transition-colors duration-500" style={{ backgroundColor: config.backgroundColor || '#ffffff' }}>
            <header
                className={`fixed top-0 z-50 w-full transition-all duration-300 ease-in-out shadow-md border-b border-gray-100 ${scrolled ? "h-[60px]" : "h-[72px]"
                    }`}
                style={{ backgroundColor: `${config.backgroundColor || '#ffffff'}ee`, backdropFilter: 'blur(12px)' }}
            >
                <div className="container mx-auto flex items-center justify-between px-6 md:px-12 h-full">
                    <Link href={`/${tenantId}`} className="flex items-center gap-3 group">
                        {config?.logoUrl ? (
                            <img
                                src={config.logoUrl}
                                alt={brandName}
                                className="h-10 w-10 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform duration-300"
                            />
                        ) : (
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                {brandName.charAt(0)}
                            </div>
                        )}
                        <span className="text-xl font-bold tracking-tight text-gray-900 transition-colors duration-300">
                            {brandName}
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-all duration-300 hover:-translate-y-0.5"
                            >
                                {link.name}
                            </Link>
                        ))}
                    </nav>

                    <div className="flex items-center gap-4">
                        {phone && (
                            <a
                                href={`tel:${phone}`}
                                className="hidden sm:flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600 transition-colors"
                            >
                                <Phone className="h-4 w-4" />
                                {phone}
                            </a>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden text-gray-700 hover:bg-gray-100"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </Button>
                        {user ? (
                            <div className="hidden md:flex items-center gap-2">
                                <Link href={`/${tenantId}/dashboard`}>
                                    <Button variant="ghost" className="text-gray-600 hover:text-indigo-600">
                                        <LayoutDashboard className="h-4 w-4 mr-2" />
                                        My Dashboard
                                    </Button>
                                </Link>
                                <Button variant="ghost" onClick={handleLogout} className="text-gray-600 hover:text-red-600">
                                    <LogOut className="h-4 w-4 mr-2" />
                                </Button>
                            </div>
                        ) : (
                            <div className="hidden md:flex items-center gap-2">
                                <Link href={`/${tenantId}/login`}>
                                    <Button variant="ghost" className="text-gray-600 hover:text-indigo-600 hover:bg-gray-50">
                                        Login / Sign Up
                                    </Button>
                                </Link>
                            </div>
                        )}
                        <Link href={`/${tenantId}/book-consultation`}>
                            <Button
                                className="hidden md:flex text-white rounded-lg px-6 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                                style={{ backgroundColor: primaryColor }}
                            >
                                Book Consultation
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Mobile Navigation Menu */}
                <div
                    className={`md:hidden absolute top-full left-0 w-full bg-white border-b shadow-lg transition-all duration-300 ease-in-out overflow-hidden ${mobileMenuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                        }`}
                >
                    <nav className="flex flex-col p-6 gap-4">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className="text-lg font-medium text-gray-800 hover:text-indigo-600 transition-colors border-b border-gray-100 pb-2"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                {link.name}
                            </Link>
                        ))}

                        {user ? (
                            <div className="flex flex-col gap-3 mt-4 border-t border-gray-100 pt-4">
                                <div className="text-sm font-medium text-gray-500 px-4 flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    {user.name}
                                </div>
                                <Link href={`/${tenantId}/dashboard`} onClick={() => setMobileMenuOpen(false)}>
                                    <Button variant="ghost" className="w-full justify-start text-lg font-medium text-gray-800 hover:text-indigo-600">
                                        <LayoutDashboard className="h-5 w-5 mr-3" />
                                        My Dashboard
                                    </Button>
                                </Link>
                                <Button
                                    variant="ghost"
                                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                                    className="w-full justify-start text-lg font-medium text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                    <LogOut className="h-5 w-5 mr-3" />
                                    Logout
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 mt-4 border-t border-gray-100 pt-4">
                                <Link href={`/${tenantId}/login`} onClick={() => setMobileMenuOpen(false)}>
                                    <Button
                                        variant="ghost"
                                        className="w-full justify-start text-lg font-medium text-gray-800 hover:text-indigo-600"
                                    >
                                        Log In
                                    </Button>
                                </Link>
                                <Link href={`/${tenantId}/estimate`} onClick={() => setMobileMenuOpen(false)}>
                                    <Button
                                        variant="ghost"
                                        className="w-full justify-start text-lg font-medium text-gray-800 hover:text-indigo-600"
                                    >
                                        Sign Up (Get Estimate)
                                    </Button>
                                </Link>
                            </div>
                        )}
                        <div className="flex flex-col gap-3 mt-4">
                            <Link href={`/${tenantId}/estimate`} onClick={() => setMobileMenuOpen(false)}>
                                <Button className="w-full rounded-full bg-gray-900 text-white h-12 text-lg">
                                    Get Estimate
                                </Button>
                            </Link>
                            <Link href={`/${tenantId}/book-consultation`} onClick={() => setMobileMenuOpen(false)}>
                                <Button variant="outline" className="w-full rounded-full border-gray-300 h-12 text-lg">
                                    Book Consultation
                                </Button>
                            </Link>
                        </div>
                    </nav>
                </div>
            </header>

            <main className="flex-1 pt-[80px]">{children}</main>

            <footer className="pt-16 pb-8 border-t" style={{ backgroundColor: secondaryColor, borderColor: `${secondaryColor}20`, color: '#ffffff' }}>
                <div className="container mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-12">
                    <div className="md:col-span-1 space-y-6">
                        <div className="flex items-center gap-3">
                            {config?.logoUrl ? (
                                <img src={config.logoUrl} alt={brandName} className="h-10 w-10 rounded-xl object-cover bg-white/10" />
                            ) : (
                                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                    {brandName.charAt(0)}
                                </div>
                            )}
                            <h3 className="text-xl font-bold tracking-tight">{brandName}</h3>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed max-w-xs">{footerText}</p>

                        <div className="flex gap-4">
                            {/* Social placeholders */}
                            <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-indigo-600 transition-colors cursor-pointer">
                                <span className="sr-only">Instagram</span>
                                <svg className="h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772 4.902 4.902 0 011.772-1.153c.636-.247 1.363-.416 2.427-.465 1.067-.047 1.407-.06 3.808-.06h.63zm1.538 1.554c-2.633 0-2.915.01-3.951.058-.921.042-1.42.196-1.756.327-.442.172-.76.376-1.093.709-.333.333-.537.651-.709 1.093-.131.336-.285.835-.327 1.756-.047 1.036-.058 1.318-.058 3.951v.922c0 2.633.01 2.915.058 3.951.042.921.196 1.42.327 1.756.172.442.376.76.709 1.093.333.333.651.537 1.093.709.336.131.835.285 1.756.327 1.036.047 1.318.058 3.951.058h.922c2.633 0 2.915-.01 3.951-.058.921-.042 1.42-.196 1.756-.327.442-.172.76-.376 1.093-.709.333-.333.537-.651.709-1.093.131-.336.285-.835.327-1.756.047-1.036.058-1.318.058-3.951v-.922c0-2.633-.01-2.915-.058-3.951-.042-.921-.196-1.42-.327-1.756-.172-.442-.376-.76-.709-1.093-.333-.333-.651-.537-1.093-.709-.336-.131-.835-.285-1.756-.327-1.035-.047-1.318-.058-3.951-.058h-.922z" clipRule="evenodd" /></svg>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-lg mb-6">Explore</h4>
                        <ul className="space-y-4 text-gray-400">
                            {[
                                { name: "Home", href: `/${tenantId}` },
                                { name: "Portfolio", href: `/${tenantId}/portfolio` },
                                { name: "Testimonials", href: `/${tenantId}/testimonials` },
                                { name: "About", href: `/${tenantId}/about` },
                                ...customPageLinks,
                            ].map((link) => (
                                <li key={link.name}>
                                    <Link href={link.href} className="hover:text-indigo-400 transition-colors">{link.name}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-lg mb-6">Services</h4>
                        <ul className="space-y-4 text-gray-400">
                            <li><a href="#" className="hover:text-indigo-400 transition-colors">Residential Design</a></li>
                            <li><a href="#" className="hover:text-indigo-400 transition-colors">Commercial Spaces</a></li>
                            <li><a href="#" className="hover:text-indigo-400 transition-colors">Consultations</a></li>
                            <li><Link href={`/${tenantId}/estimate`} className="hover:text-indigo-400 transition-colors">Get an Estimate</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-lg mb-6">Contact</h4>
                        <ul className="space-y-4 text-gray-400">
                            {phone && (
                                <li className="flex items-start gap-3">
                                    <Phone className="h-5 w-5 text-indigo-500 mt-1" />
                                    <span>{phone}</span>
                                </li>
                            )}
                            {email && (
                                <li className="flex items-start gap-3">
                                    <svg className="h-5 w-5 text-indigo-500 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    <span>{email}</span>
                                </li>
                            )}
                        </ul>
                        <Link href={`/${tenantId}/book-consultation`}>
                            <Button className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white border-0">
                                Book a Call
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="container mx-auto px-6 md:px-12 mt-16 pt-8 border-t border-gray-800 text-center md:text-left flex flex-col md:flex-row justify-between items-center text-gray-500 text-sm">
                    <p>&copy; {new Date().getFullYear()} {brandName}. All rights reserved.</p>
                    <div className="flex gap-6 mt-4 md:mt-0">
                        <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                    </div>
                </div>

            </footer >

            <StorefrontAuthDialog
                open={authOpen}
                onOpenChange={setAuthOpen}
                defaultTab={authTab}
                tenantId={tenantId}
            />
        </div >
    );
}
