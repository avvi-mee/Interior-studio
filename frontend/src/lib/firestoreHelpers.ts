import { getDb } from "./firebase";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { isReservedSlug } from "./reservedSlugs";

export interface Tenant {
  id: string;
  ownerId?: string;
  name: string;
  email: string;
  phone?: string;
  slug: string;
  status: "pending" | "active" | "inactive" | "rejected";
  createdAt: string;
  approvedAt?: string;
  subscription: "free" | "basic" | "pro" | "enterprise";
  settings?: Record<string, any>;
}

export interface Activity {
  id: string;
  type: "signup" | "store_activated" | "payment" | "approval" | "rejection";
  description: string;
  tenantId?: string;
  tenantName?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

function docToTenant(id: string, data: any): Tenant {
  return {
    id,
    ownerId: data.ownerId || data.owner_id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    slug: data.slug,
    status: data.status,
    createdAt: data.createdAt || data.created_at || "",
    approvedAt: data.approvedAt || data.approved_at,
    subscription: data.subscription || "free",
    settings: data.settings,
  };
}

/**
 * Approve a pending tenant
 */
export async function approveTenant(tenantId: string): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, "tenants", tenantId), {
    status: "active",
    approvedAt: serverTimestamp(),
  });
  await createActivity("approval", "Tenant approved", { tenantId });
}

/**
 * Reject a pending tenant
 */
export async function rejectTenant(tenantId: string): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, "tenants", tenantId), { status: "rejected" });
  await createActivity("rejection", "Tenant rejected", { tenantId });
}

/**
 * Create a new activity log entry
 */
export async function createActivity(
  type: Activity["type"],
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  const db = getDb();
  try {
    await addDoc(collection(db, "activities"), {
      type,
      description,
      metadata: metadata || {},
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error creating activity:", error);
  }
}

/**
 * Calculate growth rate percentage
 */
export function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Format timestamp as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: string | Date | any): string {
  const now = new Date();
  const date =
    typeof timestamp === "string"
      ? new Date(timestamp)
      : timestamp instanceof Date
        ? timestamp
        : new Date(timestamp?.toDate?.() || timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString();
}

/**
 * Generate a URL-friendly slug from a name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Add a new designer/tenant
 */
export async function addDesigner(designerData: {
  uid?: string;
  name: string;
  email: string;
  phone?: string;
  slug: string;
  plan: "free" | "basic" | "pro" | "enterprise";
  status?: "active" | "pending" | "inactive";
}): Promise<void> {
  const db = getDb();

  // Check for reserved slugs
  if (isReservedSlug(designerData.slug)) {
    throw new Error(`The slug "${designerData.slug}" is reserved and cannot be used`);
  }

  // Check for slug uniqueness
  let uniqueSlug = designerData.slug;
  let counter = 1;
  let exists = true;

  while (exists) {
    const snap = await getDocs(
      query(collection(db, "tenants"), where("slug", "==", uniqueSlug), limit(1))
    );
    if (snap.empty) {
      exists = false;
    } else {
      uniqueSlug = `${designerData.slug}-${counter}`;
      counter++;
    }
  }

  await addDoc(collection(db, "tenants"), {
    ownerId: designerData.uid || null,
    name: designerData.name,
    email: designerData.email,
    phone: designerData.phone || "",
    slug: uniqueSlug,
    status: designerData.status || "pending",
    subscription: designerData.plan,
    createdAt: serverTimestamp(),
  });

  await createActivity("signup", `New designer signup: ${designerData.name}`, {
    email: designerData.email,
    slug: uniqueSlug,
    status: designerData.status || "pending",
  });
}

/**
 * Update a designer/tenant
 */
export async function updateDesigner(
  tenantId: string,
  updates: Partial<Tenant>
): Promise<void> {
  const db = getDb();

  // Validate slug if being updated
  if (updates.slug !== undefined && isReservedSlug(updates.slug)) {
    throw new Error(`The slug "${updates.slug}" is reserved and cannot be used`);
  }

  const dbUpdates: Record<string, any> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.email !== undefined) dbUpdates.email = updates.email;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.settings !== undefined) dbUpdates.settings = updates.settings;
  if (updates.subscription !== undefined) dbUpdates.subscription = updates.subscription;

  await updateDoc(doc(db, "tenants", tenantId), dbUpdates);
}

/**
 * Delete a designer/tenant (soft delete)
 */
export async function deleteDesigner(tenantId: string): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, "tenants", tenantId), { status: "rejected" });
  await createActivity("rejection", "Designer account deleted", { tenantId });
}

/**
 * Ensures a tenant has a slug. If missing, generates one from the name,
 * checks uniqueness, and persists it to Firestore. Returns the slug.
 */
export async function ensureTenantSlug(tenantId: string, tenantName: string): Promise<string> {
  const db = getDb();
  const tenantRef = doc(db, "tenants", tenantId);
  const snap = await getDoc(tenantRef);
  const existing = snap.exists() ? snap.data()?.slug : undefined;

  if (existing) return existing;

  // Generate and deduplicate
  const base = generateSlug(tenantName);
  let slug = base;
  let counter = 1;

  while (true) {
    const dupeSnap = await getDocs(
      query(collection(db, "tenants"), where("slug", "==", slug), limit(1))
    );
    if (dupeSnap.empty) break;
    slug = `${base}-${counter}`;
    counter++;
  }

  await updateDoc(tenantRef, { slug });
  return slug;
}

/**
 * Get tenant by email
 */
export async function getTenantByEmail(email: string): Promise<Tenant | null> {
  const db = getDb();
  try {
    const snap = await getDocs(
      query(collection(db, "tenants"), where("email", "==", email), limit(1))
    );
    if (snap.empty) return null;
    const d = snap.docs[0];
    return docToTenant(d.id, d.data());
  } catch (error) {
    console.error("Error in getTenantByEmail:", error);
    return null;
  }
}

/**
 * Get tenant by ID
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const db = getDb();
  try {
    const d = await getDoc(doc(db, "tenants", tenantId));
    if (!d.exists()) return null;
    return docToTenant(d.id, d.data());
  } catch (error) {
    console.error("Error in getTenantById:", error);
    return null;
  }
}

/**
 * Get tenant by slug (URL identifier)
 */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const db = getDb();
  try {
    const snap = await getDocs(
      query(collection(db, "tenants"), where("slug", "==", slug), limit(1))
    );
    if (snap.empty) return null;
    const d = snap.docs[0];
    return docToTenant(d.id, d.data());
  } catch (error) {
    console.error("Error in getTenantBySlug:", error);
    return null;
  }
}

/**
 * Resolve a tenant by slug OR document ID.
 * Tries slug first (case-insensitive), then falls back to direct document ID lookup.
 * This allows URLs like /{slug} and /{tenantDocId} to both work.
 */
export async function resolveTenant(identifier: string): Promise<Tenant | null> {
  // Primary: use server API (Admin SDK, bypasses Firestore security rules).
  // Only runs in browser context (storefront pages).
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(
        `/api/public/resolve-tenant?slug=${encodeURIComponent(identifier.toLowerCase())}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.id) return data as Tenant;
      }
    } catch {
      // fall through to client-side resolution
    }
  }

  // Fallback: client-side Firestore (works when rules allow)
  const bySlug =
    (await getTenantBySlug(identifier.toLowerCase())) ||
    (await getTenantBySlug(identifier));
  if (bySlug) return bySlug;

  return getTenantById(identifier);
}
