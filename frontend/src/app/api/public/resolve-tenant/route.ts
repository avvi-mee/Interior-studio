import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  const rateLimited = rateLimit(req, { max: 30, windowMs: 60_000, keyPrefix: "resolve-tenant" });
  if (rateLimited) return rateLimited;

  const slug = req.nextUrl.searchParams.get("slug");

  if (!slug || slug.trim() === "") {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const db = getAdminDb();
  const normalized = slug.toLowerCase().trim();

  // Primary: query by slug field
  const snapshot = await db
    .collection("tenants")
    .where("slug", "==", normalized)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    const d = doc.data();
    return NextResponse.json({
      id: doc.id,
      name: d.name,
      slug: d.slug,
      email: d.email,
      phone: d.phone,
      status: d.status,
      subscription: d.subscription,
      createdAt: d.createdAt,
    });
  }

  // Fallback: try as direct document ID
  const directDoc = await db.collection("tenants").doc(normalized).get();
  if (directDoc.exists) {
    const d = directDoc.data()!;
    return NextResponse.json({
      id: directDoc.id,
      name: d.name,
      slug: d.slug,
      email: d.email,
      phone: d.phone,
      status: d.status,
      subscription: d.subscription,
      createdAt: d.createdAt,
    });
  }

  return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
}
