import type { Metadata } from "next";
import { isActiveLocale } from "@/i18n/locales";
import { routing } from "@/i18n/routing";

// Page marketing B2B → canonicals/hreflang ancrés sur pro.feedplug.com.
const siteUrl =
  process.env.NEXT_PUBLIC_MARKETING_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://feedplug.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang = isActiveLocale(locale) ? locale : routing.defaultLocale;
  const isFr = lang === "fr";
  const isEs = lang === "es";
  const title = isFr
    ? "Intégrations et canaux | FeedPlug — Google Shopping, Amazon, Cdiscount, Meta"
    : isEs
    ? "Integraciones y canales | FeedPlug — Google Shopping, Amazon, Cdiscount, Meta"
    : "Integrations and channels | FeedPlug — Google Shopping, Amazon, Cdiscount, Meta";
  const description = isFr
    ? "FeedPlug connecte votre catalogue à Google Shopping, Google Merchant Center, Meta, Amazon, Cdiscount, Mirakl, Fnac, Rakuten, Shopify. Un flux, des exports conformes."
    : isEs
    ? "FeedPlug conecta tu catálogo a Google Shopping, Google Merchant Center, Meta, Amazon, Cdiscount, Mirakl, Fnac, Rakuten, Shopify. Un feed, exportaciones conformes."
    : "FeedPlug connects your catalog to Google Shopping, Google Merchant Center, Meta, Amazon, Cdiscount, Mirakl, Fnac, Rakuten, Shopify. One feed, compliant exports.";
  const path = lang === "fr" ? "/integrations" : lang === "es" ? "/es/integrations" : "/en/integrations";
  const canonicalUrl = `${siteUrl}${path}`;

  return {
    title,
    description,
    openGraph: { title, description, url: canonicalUrl, siteName: "FeedPlug", type: "website" },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        fr: `${siteUrl}/integrations`,
        en: `${siteUrl}/en/integrations`,
        es: `${siteUrl}/es/integrations`,
        "x-default": `${siteUrl}/integrations`,
      },
    },
    robots: { index: true, follow: true },
  };
}

export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
