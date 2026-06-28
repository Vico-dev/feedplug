import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// next-intl/middleware tire `next/server` en ESM, mal résolu par jsdom+vitest.
// On le mocke : la branche « servi via intlMiddleware » renvoie alors un
// NextResponse.next() neutre — suffisant pour vérifier l'absence de 301
// cross-host. La logique de classification d'hôte testée reste 100 % réelle.
vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));
// routing.ts tire next-intl/navigation → next/navigation (ESM mal résolu en
// test). Le middleware ne se sert de `routing` que comme argument du
// createMiddleware mocké ci-dessus : un stub suffit.
vi.mock("../i18n/routing", () => ({ routing: {} }));
vi.mock("@/i18n/routing", () => ({ routing: {} }));

const { middleware } = await import("../middleware");

function run(host: string, path: string, query = "") {
  const url = `https://${host}${path}${query ? `?${query}` : ""}`;
  const req = new NextRequest(new URL(url), {
    headers: { host },
  });
  const res = middleware(req);
  const status = res.status;
  const location = res.headers.get("location");
  const rewrite = res.headers.get("x-middleware-rewrite");
  return { status, location, rewrite };
}

describe("rehoming host-routing", () => {
  // ── APEX feedplug.com ─────────────────────────────────────────────────────
  it("apex / → rewrite interne vers /comparateur (FR)", () => {
    const r = run("feedplug.com", "/");
    expect(r.rewrite).toBeTruthy();
    expect(new URL(r.rewrite!).pathname).toBe("/comparateur");
    expect(r.location).toBeFalsy(); // pas de redirect
  });

  it("apex /en → rewrite interne vers /en/comparateur", () => {
    const r = run("feedplug.com", "/en");
    expect(new URL(r.rewrite!).pathname).toBe("/en/comparateur");
  });

  it("apex /es → rewrite interne vers /es/comparateur", () => {
    const r = run("feedplug.com", "/es");
    expect(new URL(r.rewrite!).pathname).toBe("/es/comparateur");
  });

  it("apex / préserve la query ?q=&country=", () => {
    const r = run("feedplug.com", "/", "q=acer&country=FR");
    const u = new URL(r.rewrite!);
    expect(u.pathname).toBe("/comparateur");
    expect(u.searchParams.get("q")).toBe("acer");
    expect(u.searchParams.get("country")).toBe("FR");
  });

  it("apex /comparateur (racine) → 301 vers /", () => {
    const r = run("feedplug.com", "/comparateur");
    expect(r.status).toBe(301);
    const u = new URL(r.location!);
    expect(u.hostname).toBe("feedplug.com");
    expect(u.pathname).toBe("/");
  });

  it("apex /en/comparateur (racine) → 301 vers /en", () => {
    const r = run("feedplug.com", "/en/comparateur");
    expect(r.status).toBe(301);
    expect(new URL(r.location!).pathname).toBe("/en");
  });

  it("apex /comparateur/produit/123 → servi (pas de redirect cross-host)", () => {
    const r = run("feedplug.com", "/comparateur/produit/123", "country=FR");
    // intlMiddleware peut renvoyer un rewrite interne, mais jamais un 301 cross-host
    if (r.location) expect(new URL(r.location).hostname).toBe("feedplug.com");
    expect(r.status).not.toBe(301);
  });

  it("apex /compte/verifier → servi sur l'apex (jamais marketing/301)", () => {
    const r = run("feedplug.com", "/compte/verifier", "token=abc");
    if (r.location) expect(new URL(r.location).hostname).toBe("feedplug.com");
    expect(r.status).not.toBe(301);
  });

  it("apex /legal/mentions → servi sur l'apex", () => {
    const r = run("feedplug.com", "/legal/mentions");
    if (r.location) expect(new URL(r.location).hostname).toBe("feedplug.com");
    expect(r.status).not.toBe(301);
  });

  it("apex /tarifs → 301 vers pro.feedplug.com/tarifs", () => {
    const r = run("feedplug.com", "/tarifs");
    expect(r.status).toBe(301);
    const u = new URL(r.location!);
    expect(u.hostname).toBe("pro.feedplug.com");
    expect(u.pathname).toBe("/tarifs");
  });

  it("apex /en/tarifs → 301 vers pro.feedplug.com/en/tarifs", () => {
    const r = run("feedplug.com", "/en/tarifs");
    expect(r.status).toBe(301);
    const u = new URL(r.location!);
    expect(u.hostname).toBe("pro.feedplug.com");
    expect(u.pathname).toBe("/en/tarifs");
  });

  it("apex /docs → 301 vers pro.feedplug.com/docs", () => {
    const r = run("feedplug.com", "/docs");
    expect(r.status).toBe(301);
    expect(new URL(r.location!).hostname).toBe("pro.feedplug.com");
  });

  it("apex /feedplug-vs-channable → 301 vers pro.", () => {
    const r = run("feedplug.com", "/feedplug-vs-channable");
    expect(r.status).toBe(301);
    expect(new URL(r.location!).hostname).toBe("pro.feedplug.com");
  });

  it("apex /dashboard (app route) → 302 vers app.feedplug.com", () => {
    const r = run("feedplug.com", "/dashboard");
    expect(r.status).toBe(302);
    expect(new URL(r.location!).hostname).toBe("app.feedplug.com");
  });

  // ── PRO pro.feedplug.com ──────────────────────────────────────────────────
  it("pro / → marketing servi (pas de redirect cross-host)", () => {
    const r = run("pro.feedplug.com", "/");
    if (r.location) expect(new URL(r.location).hostname).toBe("pro.feedplug.com");
    expect(r.status).not.toBe(301);
    // pas un rewrite vers /comparateur
    if (r.rewrite) expect(new URL(r.rewrite).pathname).not.toBe("/comparateur");
  });

  it("pro /tarifs → marketing servi", () => {
    const r = run("pro.feedplug.com", "/tarifs");
    if (r.location) expect(new URL(r.location).hostname).toBe("pro.feedplug.com");
    expect(r.status).not.toBe(301);
  });

  it("pro /comparateur → 301 vers apex /", () => {
    const r = run("pro.feedplug.com", "/comparateur");
    expect(r.status).toBe(301);
    const u = new URL(r.location!);
    expect(u.hostname).toBe("feedplug.com");
    expect(u.pathname).toBe("/");
  });

  it("pro /comparateur/produit/9 → 301 vers apex (même path)", () => {
    const r = run("pro.feedplug.com", "/comparateur/produit/9");
    expect(r.status).toBe(301);
    const u = new URL(r.location!);
    expect(u.hostname).toBe("feedplug.com");
    expect(u.pathname).toBe("/comparateur/produit/9");
  });

  it("pro /compte/verifier → 301 vers apex", () => {
    const r = run("pro.feedplug.com", "/compte/verifier");
    expect(r.status).toBe(301);
    expect(new URL(r.location!).hostname).toBe("feedplug.com");
  });

  it("pro /dashboard (app) → 302 vers app.", () => {
    const r = run("pro.feedplug.com", "/dashboard");
    expect(r.status).toBe(302);
    expect(new URL(r.location!).hostname).toBe("app.feedplug.com");
  });

  // ── APP app.feedplug.com (inchangé) ───────────────────────────────────────
  it("app /tarifs (marketing) → 302 vers pro.", () => {
    const r = run("app.feedplug.com", "/tarifs");
    expect(r.status).toBe(302);
    expect(new URL(r.location!).hostname).toBe("pro.feedplug.com");
  });

  it("app /comparateur (conso) → 302 vers apex", () => {
    const r = run("app.feedplug.com", "/comparateur");
    expect(r.status).toBe(302);
    expect(new URL(r.location!).hostname).toBe("feedplug.com");
  });

  // ── Assets : jamais 301 cross-host ────────────────────────────────────────
  it("apex /sitemap-comparateur.xml → next() (pas de redirect)", () => {
    const r = run("feedplug.com", "/sitemap-comparateur.xml");
    expect(r.status).not.toBe(301);
    expect(r.location).toBeFalsy();
  });

  it("pro /sitemap.xml → next()", () => {
    const r = run("pro.feedplug.com", "/sitemap.xml");
    expect(r.status).not.toBe(301);
    expect(r.location).toBeFalsy();
  });

  it("apex /robots.txt → next()", () => {
    const r = run("feedplug.com", "/robots.txt");
    expect(r.location).toBeFalsy();
  });
});
