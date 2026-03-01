"use client";

import Link from "next/link";

export function LandingFooter() {
    return (
        <footer className="border-t border-white/[0.06] py-12 px-6 bg-base">
            <div className="container mx-auto max-w-6xl flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="flex items-center gap-2.5 opacity-50">
                    <div className="w-7 h-7 rounded-md bg-gradient-to-br from-brand-indigo to-brand-violet flex items-center justify-center text-white font-bold text-xs">
                        U
                    </div>
                    <span className="text-sm font-bold tracking-tight text-foreground uppercase">
                        Unmatrix
                    </span>
                </div>
                <div className="flex flex-wrap justify-center gap-8 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Link href="/admin" className="hover:text-foreground transition-colors">
                        Platform Admin
                    </Link>
                    <Link href="/dashboard" className="hover:text-foreground transition-colors">
                        Designer Console
                    </Link>
                    <Link href="/pricing" className="hover:text-foreground transition-colors">
                        Pricing
                    </Link>
                    <span className="text-white/20">&copy; 2025 Unmatrix Inc.</span>
                </div>
            </div>
        </footer>
    );
}
