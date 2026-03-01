import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through static assets, API routes, and internal Next.js paths
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Extract tenant slug from the first path segment (path-based routing)
  // e.g. /aviraj-interiors/about → slug = "aviraj-interiors"
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0) {
    const response = NextResponse.next();
    response.headers.set("x-tenant-slug", segments[0]);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
