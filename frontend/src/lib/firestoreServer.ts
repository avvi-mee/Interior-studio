import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "./firebaseAdmin";

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns { user, error, response } — if error, return `response` immediately.
 */
export async function verifyAuth(req: NextRequest): Promise<{
  user: { id: string; email?: string } | null;
  error: string | null;
  response: NextResponse | null;
}> {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      user: null,
      error: "Missing or invalid Authorization header",
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return {
      user: { id: decoded.uid, email: decoded.email },
      error: null,
      response: null,
    };
  } catch (err: any) {
    return {
      user: null,
      error: err.message || "Invalid token",
      response: NextResponse.json(
        { error: "Unauthorized: invalid token" },
        { status: 401 }
      ),
    };
  }
}

/**
 * Verify that the authenticated user is a member of the given tenant.
 * Checks ownership (by UID or email) or employee membership (by userId field).
 *
 * @param userId  Firebase Auth UID from the decoded token
 * @param tenantId  Firestore tenant document ID
 * @param userEmail  Optional email from the decoded token (fallback owner check)
 */
export async function verifyTenantAccess(
  userId: string,
  tenantId: string,
  userEmail?: string
): Promise<boolean> {
  const db = getAdminDb();

  // 1. Check if user is the tenant owner (by UID or email)
  const tenantDoc = await db.collection("tenants").doc(tenantId).get();
  if (tenantDoc.exists) {
    const data = tenantDoc.data();
    if (data?.ownerId === userId || data?.owner_id === userId) return true;
    // Fallback: tenants created before ownerId was set — match by email
    if (userEmail && data?.email && data.email.toLowerCase() === userEmail.toLowerCase()) return true;
  }

  // 2. Check if user is an active employee of this tenant.
  //    Employees are created with addDoc (auto-generated IDs), so we must query
  //    by the userId *field* rather than looking up by document ID.
  const empByField = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("employees")
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (!empByField.empty) {
    const data = empByField.docs[0].data();
    if (data?.isActive !== false && data?.is_active !== false) return true;
  }

  return false;
}

/**
 * Verify a cron secret for server-to-server API calls (e.g., scheduled jobs).
 */
export function verifyCronSecret(req: NextRequest): boolean {
  const secret = req.headers.get("x-cron-secret");
  return !!secret && secret === process.env.CRON_SECRET;
}
