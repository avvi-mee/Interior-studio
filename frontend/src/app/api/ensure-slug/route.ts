import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { verifyAuth, verifyTenantAccess } from "@/lib/firestoreServer";
import { isReservedSlug } from "@/lib/reservedSlugs";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const { user, response: authError } = await verifyAuth(req);
    if (authError) return authError;

    const body = await req.json();
    const { tenantId, tenantName } = body;

    if (!tenantId || !tenantName) {
      return NextResponse.json(
        { error: "tenantId and tenantName are required" },
        { status: 400 }
      );
    }

    const hasAccess = await verifyTenantAccess(user!.id, tenantId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    const tenantRef = db.collection("tenants").doc(tenantId);

    // Verify tenant exists
    const tenantDoc = await tenantRef.get();
    if (!tenantDoc.exists) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const tenantData = tenantDoc.data();

    // If slug already exists, activate tenant and return slug
    if (tenantData?.slug) {
      if (tenantData?.status === "pending") {
        await tenantRef.update({ status: "active", approvedAt: new Date().toISOString() });
      }
      return NextResponse.json({ slug: tenantData.slug });
    }

    // Generate slug from tenant name
    let base = generateSlug(tenantName);

    if (!base || base.length < 2) {
      return NextResponse.json(
        { error: "Cannot generate a valid slug from the tenant name" },
        { status: 400 }
      );
    }

    // Avoid reserved slugs
    if (isReservedSlug(base)) {
      base = `${base}-studio`;
    }

    // Find unique slug
    let slug = base;
    let counter = 1;
    const tenantsRef = db.collection("tenants");

    while (true) {
      const existing = await tenantsRef
        .where("slug", "==", slug)
        .limit(1)
        .get();

      if (existing.empty) break;

      slug = `${base}-${counter}`;
      counter++;

      if (counter > 100) {
        return NextResponse.json(
          { error: "Could not generate a unique slug" },
          { status: 500 }
        );
      }
    }

    // Write slug using Admin SDK (bypasses security rules)
    await tenantRef.update({ slug });

    // Activate tenant so storefront rules allow public reads
    if (tenantData?.status === "pending") {
      await tenantRef.update({ status: "active", approvedAt: new Date().toISOString() });
    }

    return NextResponse.json({ slug });
  } catch (err: any) {
    console.error("Error ensuring slug:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate slug" },
      { status: 500 }
    );
  }
}
