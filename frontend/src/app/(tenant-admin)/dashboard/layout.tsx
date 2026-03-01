"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    ShoppingBag,
    MessageSquare,
    Image as ImageIcon,
    Settings,
    LogOut,
    Plus,
    Globe,
    Users,
    Briefcase,
    DollarSign,
    BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useBrand } from "@/hooks/useWebsiteBuilder";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getAllowedSidebarHrefs } from "@/lib/permissions";


const SIDEBAR_ITEMS = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Sales Pipeline", href: "/dashboard/orders", icon: ShoppingBag },
    { label: "Projects", href: "/dashboard/projects", icon: Briefcase },
    { label: "Finance", href: "/dashboard/finance", icon: DollarSign },
    { label: "Customers", href: "/dashboard/customers", icon: Users },
    { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    { label: "Consultation Requests", href: "/dashboard/consultation-requests", icon: MessageSquare },
    { label: "Website Setup", href: "/dashboard/website-setup", icon: Globe },
    { label: "Employees", href: "/dashboard/employees", icon: Users },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function TenantLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { tenant, loading, isAuthenticated, logout } = useTenantAuth();
    const { brand } = useBrand(tenant?.id || "");
    const { roles } = useCurrentUser();

    // Filter sidebar items based on user roles
    const allowedHrefs = getAllowedSidebarHrefs(roles.length > 0 ? roles : ["owner"]);
    const filteredSidebarItems = SIDEBAR_ITEMS.filter(
        (item) => allowedHrefs.has(item.href)
    );

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push("/login");
        }
    }, [loading, isAuthenticated, router]);

    const handleLogout = async () => {
        await logout();
        router.push("/login");
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="flex min-h-screen bg-[#F8FAFC]">
            {/* Sidebar */}
            <aside className="fixed left-0 top-0 h-full w-64 border-r bg-white flex flex-col">
                <div className="p-6">
                    <div className="flex items-center gap-3">
                        {brand?.logoUrl ? (
                            <img
                                src={brand.logoUrl}
                                alt={brand.brandName || "Logo"}
                                className="h-8 w-auto"
                            />
                        ) : (
                            <div className="h-8 w-8 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">
                                    {brand?.brandName?.charAt(0) || "A"}
                                </span>
                            </div>
                        )}
                        <span className="text-xl font-bold tracking-tight">{brand?.brandName || "Admin"}</span>
                    </div>

                    {/* Workspace Selector */}
                    <div className="mb-6">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Workspace</label>
                        <div className="p-2 border rounded-md bg-gray-50 flex items-center justify-between cursor-pointer">
                            <span className="text-sm font-medium truncate">{tenant?.name || "Amit Interiors"}</span>
                        </div>
                    </div>

                    <Button
                        className="w-full mb-6 bg-[#0F172A] hover:bg-[#1E293B] text-white py-6"
                        size="lg"
                        onClick={() => {
                            if (tenant?.id) {
                                window.open(`/${tenant.id}/estimate`, '_blank');
                            }
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add New Estimate
                    </Button>

                    <nav className="space-y-1">
                        {filteredSidebarItems.map((item) => {
                            const isActive = pathname === item.href;
                            const Icon = item.icon;

                            return (
                                <Link key={item.href} href={item.href} className="block">
                                    <div className={cn(
                                        "flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                                        isActive
                                            ? "bg-gray-100 text-[#0F172A]"
                                            : "text-gray-500 hover:bg-gray-50 hover:text-[#0F172A]"
                                    )}>
                                        <Icon className={cn("mr-3 h-5 w-5", isActive ? "text-[#0F172A]" : "text-gray-400")} />
                                        {item.label}
                                    </div>
                                </Link>
                            )
                        })}
                    </nav>
                </div>

                <div className="mt-auto p-4 border-t">
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-gray-500 hover:text-destructive py-6"
                        onClick={handleLogout}
                    >
                        <LogOut className="mr-3 h-5 w-5" />
                        Logout
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 flex-1">
                <div className="p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}

