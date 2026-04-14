import type { Metadata } from "next";
import { createDocMetadata } from "@/lib/seo";
import { FAQ_DOCS_FLAT } from "@/lib/faq-docs";

type FaqEntry = {
  q: string;
  a: string;
};

export const metadata: Metadata = createDocMetadata(
  "FAQ et dépannage",
  "Questions fréquentes et résolution des problèmes courants : connexion Shopify, rejets Google, export, score et synchronisation.",
  "/faq",
  ["FAQ FeedPlug", "dépannage", "aide", "Shopify", "rejets Google"]
);

function FaqPageJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_DOCS_FLAT.map(({ q, a }: FaqEntry) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FaqPageJsonLd />
      {children}
    </>
  );
}
