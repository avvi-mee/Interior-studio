"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

/**
 * DashboardGuard — redirects to /login if not authenticated as admin.
 * Used by the tenant dashboard layout.
 */
export function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { loading, role, tenant } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (role !== "admin" || !tenant)) {
      router.push("/login");
    }
  }, [loading, role, tenant, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (role !== "admin" || !tenant) return null;

  return <>{children}</>;
}

/**
 * AdminGuard — redirects to /admin if not authenticated as superadmin.
 * Used by super-admin pages.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { loading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && role !== "superadmin") {
      router.push("/admin");
    }
  }, [loading, role, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (role !== "superadmin") return null;

  return <>{children}</>;
}
