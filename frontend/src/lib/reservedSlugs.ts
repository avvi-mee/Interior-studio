/**
 * Reserved slugs that cannot be used as tenant slugs.
 * These collide with platform routes and internal paths.
 */
export const RESERVED_SLUGS = new Set([
  // Platform auth routes
  "login",
  "signup",
  "forgot-password",
  "reset-password",
  "logout",

  // Platform admin
  "admin",
  "dashboard",
  "super-admin",

  // Platform pages
  "pricing",
  "about",
  "contact",
  "terms",
  "privacy",
  "help",
  "support",

  // Internal / technical
  "api",
  "_next",
  "static",
  "public",
  "assets",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",

  // Employee routes
  "employee-dashboard",
  "employee-register",

  // Common reserved words
  "www",
  "app",
  "mail",
  "blog",
  "docs",
  "status",
  "cdn",
  "media",
  "null",
  "undefined",
  "test",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

export function validateTenantSlug(slug: string): {
  valid: boolean;
  reason?: string;
} {
  if (!slug || slug.trim().length === 0) {
    return { valid: false, reason: "Slug cannot be empty" };
  }

  const trimmed = slug.trim().toLowerCase();

  if (trimmed.length < 3) {
    return { valid: false, reason: "Slug must be at least 3 characters" };
  }

  if (trimmed.length > 63) {
    return { valid: false, reason: "Slug must be 63 characters or fewer" };
  }

  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(trimmed)) {
    return {
      valid: false,
      reason:
        "Slug must start and end with a letter or number, and contain only lowercase letters, numbers, and hyphens",
    };
  }

  if (isReservedSlug(trimmed)) {
    return {
      valid: false,
      reason: `"${trimmed}" is a reserved name and cannot be used as a slug`,
    };
  }

  return { valid: true };
}
