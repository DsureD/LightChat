import { NextRequest, NextResponse } from "next/server";

const CORS_METHODS = "GET,POST,PATCH,DELETE,OPTIONS";
const CORS_HEADERS = "Content-Type, Authorization, X-Requested-With";
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0"
};

function noStore(response: NextResponse) {
  for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

function configuredOrigins() {
  return (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolveCorsOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const origins = configuredOrigins();

  if (!origin || origins.length === 0) {
    return null;
  }

  if (origins.includes("*")) {
    return "*";
  }

  return origins.includes(origin) ? origin : null;
}

function applyCorsHeaders(response: NextResponse, allowedOrigin: string | null) {
  if (!allowedOrigin) {
    return response;
  }

  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", CORS_METHODS);
  response.headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.set("Vary", "Origin");

  if (allowedOrigin !== "*") {
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return response;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/chat" || pathname === "/login") {
    return noStore(NextResponse.next());
  }

  const allowedOrigin = resolveCorsOrigin(request);
  const hasCorsConfig = configuredOrigins().length > 0;

  if (request.method === "OPTIONS") {
    if (hasCorsConfig && !allowedOrigin) {
      return new NextResponse(null, { status: 403 });
    }

    return applyCorsHeaders(new NextResponse(null, { status: 204 }), allowedOrigin);
  }

  return applyCorsHeaders(NextResponse.next(), allowedOrigin);
}

export const config = {
  matcher: ["/api/:path*", "/chat", "/login"]
};
