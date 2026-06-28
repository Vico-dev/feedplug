import { headers } from "next/headers";

// robots.txt host-aware (Route Handler plutôt que app/robots.ts, qui n'a pas
// accès au header Host). On annonce le bon sitemap selon l'hôte :
//   apex feedplug.com → sitemap comparateur conso
//   pro.feedplug.com  → sitemap marketing B2B
//   app.feedplug.com  → aucun sitemap public (dashboard noindex de facto)
export const dynamic = "force-dynamic";

const APEX_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://feedplug.com";
const MARKETING_URL =
  process.env.NEXT_PUBLIC_MARKETING_URL || APEX_URL;

export async function GET() {
  const h = await headers();
  const host = (h.get("host") || "").split(":")[0].toLowerCase();

  const isPro = host === "pro.feedplug.com";
  const isApp = host === "app.feedplug.com" || host.endsWith(".run.app");

  const lines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /oauth/",
    "Disallow: /login",
    "Disallow: /register",
    "Disallow: /_next/",
  ];

  if (isApp) {
    // L'app n'expose pas de sitemap public ; on bloque l'espace authentifié.
    lines.push("Disallow: /dashboard");
  } else if (isPro) {
    lines.push("", `Sitemap: ${MARKETING_URL}/sitemap.xml`);
  } else {
    // Apex conso (par défaut) : sitemap du comparateur.
    lines.push("", `Sitemap: ${APEX_URL}/sitemap-comparateur.xml`);
  }

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
