"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { TalkToSalesModal } from "./TalkToSalesModal";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";

export function LandingNav() {
    const [salesOpen, setSalesOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { scrollY } = useScroll();
    const backdropBlurRaw = useTransform(scrollY, [0, 100], [12, 24]);
    const bgOpacityRaw = useTransform(scrollY, [0, 100], [0.8, 0.95]);
    const backdropFilter = useTransform(backdropBlurRaw, (v) => `blur(${v}px)`);
    const backgroundColor = useTransform(bgOpacityRaw, (v) => `rgba(10, 10, 10, ${v})`);

    return (
        <>
            <motion.nav
                className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06]"
                style={{
                    backdropFilter,
                    WebkitBackdropFilter: backdropFilter,
                    backgroundColor,
                }}
            >
                <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-indigo to-brand-violet flex items-center justify-center text-white font-bold text-sm">
                            U
                        </div>
                        <span className="text-sm font-bold tracking-tight text-foreground uppercase">
                            Unmatrix
                        </span>
                    </Link>

                    <div className="hidden md:flex items-center gap-1">
                        <Link
                            href="#features"
                            className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
                        >
                            Features
                        </Link>
                        <Link
                            href="#process"
                            className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
                        >
                            Process
                        </Link>
                        <Link
                            href="/pricing"
                            className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
                        >
                            Pricing
                        </Link>
                        <div className="w-px h-5 bg-white/10 mx-3" />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs uppercase tracking-wider"
                            onClick={() => setSalesOpen(true)}
                        >
                            Talk to Sales
                        </Button>
                        <Link href="/login">
                            <MagneticButton
                                variant="gradient"
                                size="sm"
                                className="ml-2 text-xs uppercase tracking-wider px-5"
                            >
                                Launch Your Studio
                            </MagneticButton>
                        </Link>
                    </div>

                    <button
                        className="md:hidden p-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Menu"
                    >
                        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {/* Mobile menu */}
                <AnimatePresence>
                    {mobileOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden border-t border-white/[0.06] bg-[#141414]/95 backdrop-blur-xl overflow-hidden"
                        >
                            <div className="px-6 py-4 space-y-3">
                                <Link href="#features" className="block text-sm text-muted-foreground hover:text-foreground py-2" onClick={() => setMobileOpen(false)}>
                                    Features
                                </Link>
                                <Link href="#process" className="block text-sm text-muted-foreground hover:text-foreground py-2" onClick={() => setMobileOpen(false)}>
                                    Process
                                </Link>
                                <Link href="/pricing" className="block text-sm text-muted-foreground hover:text-foreground py-2" onClick={() => setMobileOpen(false)}>
                                    Pricing
                                </Link>
                                <hr className="border-white/[0.06]" />
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start text-sm"
                                    onClick={() => { setSalesOpen(true); setMobileOpen(false); }}
                                >
                                    Talk to Sales
                                </Button>
                                <Link href="/login" className="block">
                                    <Button variant="gradient" className="w-full text-sm">
                                        Launch Your Studio
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.nav>

            <TalkToSalesModal open={salesOpen} onOpenChange={setSalesOpen} />
        </>
    );
}
