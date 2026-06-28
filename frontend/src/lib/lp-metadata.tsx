/**
 * Métadonnées et hreflang pour les LP (landing pages)
 * Avec localePrefix 'as-needed' : FR = /path, EN = /en/path, ES = /es/path
 */

import React from "react";
import type { Metadata } from "next";
import { seo } from "@/lib/seo";
import { routing } from "@/i18n/routing";

type Locale = "fr" | "en" | "es";

function lpUrl(path: string, locale: Locale): string {
  const base = `${seo.marketingUrl}`;
  if (locale === routing.defaultLocale) {
    return `${base}${path}`;
  }
  return `${base}/${locale}${path}`;
}

export type LPMetaConfig = {
  path: string;
  fr: { title: string; description: string; keywords: string[] };
  en: { title: string; description: string; keywords: string[] };
  es: { title: string; description: string; keywords: string[] };
  breadcrumbNameFr: string;
  breadcrumbNameEn: string;
  breadcrumbNameEs: string;
  howToNameFr: string;
  howToNameEn: string;
  howToNameEs: string;
  howToDescFr: string;
  howToDescEn: string;
  howToDescEs: string;
  steps: {
    nameFr: string;
    nameEn: string;
    nameEs: string;
    textFr: string;
    textEn: string;
    textEs: string;
  }[];
};

export type FAQJsonLdItem = {
  question: string;
  answer: string;
};

export function createLPMetadata(config: LPMetaConfig, locale: Locale): Metadata {
  const meta =
    locale === "fr" ? config.fr : locale === "es" ? config.es : config.en;
  const canonical = lpUrl(config.path, locale);

  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonical,
      siteName: "FeedPlug",
      type: "website",
      locale:
        locale === "fr" ? "fr_FR" : locale === "es" ? "es_ES" : "en_GB",
      alternateLocale:
        locale === "fr"
          ? ["en_GB", "es_ES"]
          : locale === "es"
            ? ["fr_FR", "en_GB"]
            : ["fr_FR", "es_ES"],
      images: [
        {
          url: seo.ogImage,
          width: seo.defaultImages.width,
          height: seo.defaultImages.height,
          alt: seo.defaultImages.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [seo.ogImage],
    },
    alternates: {
      canonical,
      languages: {
        fr: lpUrl(config.path, "fr"),
        en: lpUrl(config.path, "en"),
        es: lpUrl(config.path, "es"),
        "x-default": lpUrl(config.path, "fr"),
      },
    },
    robots: { index: true, follow: true },
  };
}

export function createBreadcrumbJsonLd(config: LPMetaConfig, locale: Locale) {
  const name =
    locale === "fr"
      ? config.breadcrumbNameFr
      : locale === "es"
        ? config.breadcrumbNameEs
        : config.breadcrumbNameEn;
  const homeName = locale === "fr" ? "Accueil" : locale === "es" ? "Inicio" : "Home";
  const url = lpUrl(config.path, locale);

  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: homeName, item: seo.marketingUrl },
      { "@type": "ListItem", position: 2, name, item: url },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function createHowToJsonLd(config: LPMetaConfig, locale: Locale) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name:
      locale === "fr"
        ? config.howToNameFr
        : locale === "es"
          ? config.howToNameEs
          : config.howToNameEn,
    description:
      locale === "fr"
        ? config.howToDescFr
        : locale === "es"
          ? config.howToDescEs
          : config.howToDescEn,
    step: config.steps.map((s) => ({
      "@type": "HowToStep",
      name: locale === "fr" ? s.nameFr : locale === "es" ? s.nameEs : s.nameEn,
      text: locale === "fr" ? s.textFr : locale === "es" ? s.textEs : s.textEn,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function createFaqJsonLd(items: FAQJsonLdItem[]) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
