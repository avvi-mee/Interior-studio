const TENANT_DOMAIN =
  process.env.NEXT_PUBLIC_TENANT_DOMAIN || "unmatrix.app";
const PLATFORM_DOMAIN =
  process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "unmatrix.com";

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Returns the public-facing URL for a tenant storefront.
 * - Production: https://unmatrix.app/{slug}
 * - Development: auto-detects from current window location
 */
export function getTenantUrl(slug: string): string {
  if (isDev()) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/${slug}`;
    }
    const port = process.env.NEXT_PUBLIC_DEV_PORT || "3000";
    return `http://localhost:${port}/${slug}`;
  }
  return `https://${TENANT_DOMAIN}/${slug}`;
}

/**
 * Returns the full URL for a specific page on a tenant storefront.
 */
export function getTenantPageUrl(slug: string, path: string): string {
  const base = getTenantUrl(slug);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export { TENANT_DOMAIN, PLATFORM_DOMAIN };
