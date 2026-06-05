import { NextRequest } from "next/server";
import { FEEDPLUG_PROXY_PATH, getBackendApiBaseUrl } from "@/config/api";

/**
 * Proxy API FeedPlug — même origine, plus de CORS.
 * Chemin /feedplug-api (PAS sous /api/) pour éviter que le load balancer
 * n'envoie les requêtes au backend (qui n'a que /api/v1/* → 404).
 */
const BACKEND_BASE = getBackendApiBaseUrl();
const PROXY_PREFIX = FEEDPLUG_PROXY_PATH;
const ACCESS_COOKIE = "fp_access_token";
const REFRESH_COOKIE = "fp_refresh_token";
const AUTH_TOKEN_PATHS = new Set([
  "auth/login",
  "auth/register",
  "auth/google",
  "auth/accept-invitation",
  "auth/refresh",
]);
const LOGOUT_PATH = "auth/logout";

// Méthodes qui modifient l'état → soumises à la protection CSRF.
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Origines autorisées à effectuer des mutations via le proxy cookie→bearer.
// L'embedded Shopify utilise `Authorization: Bearer <session_token>` explicite
// (pas le cookie), donc ne passe pas par ce contrôle.
const ALLOWED_ORIGIN_HOSTS = new Set([
  "feedplug.com",
  "www.feedplug.com",
  "app.feedplug.com",
]);

function isAllowedOrigin(origin: string | null, requestHost: string | null): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    if (requestHost && u.host === requestHost) return true;
    if (ALLOWED_ORIGIN_HOSTS.has(u.host)) return true;
    if (process.env.NODE_ENV !== "production" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(u.host)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const dynamic = "force-dynamic";

function applyNoStore(headers: Headers): Headers {
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  return headers;
}

function isSecureRequest(request: Request): boolean {
  try {
    const url = new URL(request.url, "http://localhost");
    return url.protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function buildAuthCookie(name: string, value: string, request: Request): string {
  const secure = isSecureRequest(request);
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    secure ? "SameSite=None" : "SameSite=Lax",
    "Max-Age=2592000",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function buildExpiredCookie(name: string, request: Request): string {
  const secure = isSecureRequest(request);
  const parts = [
    `${name}=`,
    "Path=/",
    "HttpOnly",
    secure ? "SameSite=None" : "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function stripTokensFromPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  const clone = { ...(payload as Record<string, unknown>) };
  delete clone.accessToken;
  delete clone.refreshToken;
  delete clone.token;
  return clone;
}

function getPathFromUrl(request: Request): string | null {
  try {
    const url = new URL(request.url, "http://localhost");
    const pathname = url.pathname || "";
    if (!pathname.startsWith(PROXY_PREFIX)) return null;
    const rest = pathname.slice(PROXY_PREFIX.length).replace(/^\/+/, "").trim();
    return rest || null;
  } catch {
    return null;
  }
}

type RouteContext = { params?: Promise<{ path?: string[] }> };

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[] | undefined
): Promise<Response> {
  let path: string | null = pathSegments?.length ? pathSegments.join("/") : null;
  if (!path) path = getPathFromUrl(request);
  if (!path) {
    return new Response(JSON.stringify({ message: "Proxy path required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url, "http://localhost");
  const search = url.searchParams.toString();
  const backendUrl = `${BACKEND_BASE}/${path}${search ? `?${search}` : ""}`;
  const method = request.method;
  const headers = new Headers();

  const forwardHeaders = ["authorization", "content-type", "accept", "x-forwarded-for", "x-real-ip"];
  request.headers.forEach((value, key) => {
    if (forwardHeaders.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const explicitBearer = headers.has("authorization");
  if (!explicitBearer) {
    const accessToken = getCookieValue(request, ACCESS_COOKIE);
    if (accessToken) {
      headers.set("authorization", `Bearer ${accessToken}`);
    }
  }

  // Protection CSRF : le proxy convertit le cookie en Authorization Bearer.
  // Cookie fp_access_token est SameSite=None (requis pour iframe Shopify),
  // donc un POST cross-origin l'envoie. Sans cette garde, un site tiers peut
  // déclencher des mutations (delete feed, change plan…).
  // Règle : sur une mutation où l'auth provient du cookie (pas d'un Bearer
  // explicite), on exige une Origin dans la liste blanche FeedPlug.
  // Les endpoints d'auth (login/register/refresh) sont publics, pas de cookie
  // à protéger.
  if (
    MUTATING_METHODS.has(method) &&
    !explicitBearer &&
    !AUTH_TOKEN_PATHS.has(path) &&
    headers.has("authorization")
  ) {
    const origin = request.headers.get("origin");
    const requestHost = request.headers.get("host");
    if (!isAllowedOrigin(origin, requestHost)) {
      return new Response(
        JSON.stringify({ message: "Origine non autorisée" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    try {
      body = await request.text();
    } catch {
      body = undefined;
    }
  }

  if (path === "auth/refresh") {
    const refreshToken = getCookieValue(request, REFRESH_COOKIE);
    let parsedBody: Record<string, unknown> = {};
    if (body && body.length > 0) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        parsedBody = {};
      }
    }
    if (refreshToken && !parsedBody.refreshToken) {
      body = JSON.stringify({ ...parsedBody, refreshToken });
      headers.set("content-type", "application/json");
    }
  }

  const init: RequestInit = {
    method,
    headers,
    body: body && body.length > 0 ? body : undefined,
    cache: "no-store",
  };

  try {
    const res = await fetch(backendUrl, init);
    const contentType = res.headers.get("content-type") || "";
    const responseText = await res.text();
    const responseHeaders = new Headers();
    if (contentType) responseHeaders.set("Content-Type", contentType);

    if (path === LOGOUT_PATH) {
      responseHeaders.append("Set-Cookie", buildExpiredCookie(ACCESS_COOKIE, request));
      responseHeaders.append("Set-Cookie", buildExpiredCookie(REFRESH_COOKIE, request));
      applyNoStore(responseHeaders);
      return new Response(null, {
        status: 204,
        statusText: res.statusText,
        headers: responseHeaders,
      });
    }

    if (AUTH_TOKEN_PATHS.has(path) && contentType.includes("application/json")) {
      let payload: unknown;
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        payload = {};
      }

      if (res.ok && payload && typeof payload === "object") {
        const authPayload = payload as Record<string, unknown>;
        if (typeof authPayload.accessToken === "string") {
          responseHeaders.append("Set-Cookie", buildAuthCookie(ACCESS_COOKIE, authPayload.accessToken, request));
        }
        if (typeof authPayload.refreshToken === "string") {
          responseHeaders.append("Set-Cookie", buildAuthCookie(REFRESH_COOKIE, authPayload.refreshToken, request));
        }
      }

      const sanitized = stripTokensFromPayload(payload);
      applyNoStore(responseHeaders);
      return new Response(JSON.stringify(sanitized), {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
      });
    }

    applyNoStore(responseHeaders);
    return new Response(responseText, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("[feedplug-proxy] Backend request failed:", err);
    return new Response(
      JSON.stringify({
        message:
          "Impossible de joindre le serveur. Réessayez dans quelques instants.",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function getPathSegments(context: RouteContext | undefined): Promise<string[] | undefined> {
  if (!context?.params) return undefined;
  const params = await context.params;
  const p = params?.path;
  return Array.isArray(p) && p.length > 0 ? p : undefined;
}

export async function GET(request: NextRequest, context?: RouteContext) {
  return proxyRequest(request, await getPathSegments(context));
}
export async function POST(request: NextRequest, context?: RouteContext) {
  return proxyRequest(request, await getPathSegments(context));
}
export async function PUT(request: NextRequest, context?: RouteContext) {
  return proxyRequest(request, await getPathSegments(context));
}
export async function PATCH(request: NextRequest, context?: RouteContext) {
  return proxyRequest(request, await getPathSegments(context));
}
export async function DELETE(request: NextRequest, context?: RouteContext) {
  return proxyRequest(request, await getPathSegments(context));
}
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
