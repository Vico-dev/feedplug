"use client";

import Link from "next/link";
import {
  FileInput,
  Package,
  Sparkles,
  BarChart3,
  Share2,
  Shield,
  LayoutDashboard,
  CheckCircle,
  HelpCircle,
  BookOpen,
  ArrowRight,
} from "lucide-react";

const docLinks = [
  { href: "/docs/sources", label: "Sources et import", icon: FileInput, description: "Connecter Shopify et vos fichiers d'export." },
  { href: "/docs/catalogue", label: "Catalogue", icon: Package, description: "Vue unifiée des produits, filtres, score et recommandations." },
  { href: "/docs/enrichissement", label: "Enrichissement IA", icon: Sparkles, description: "Optimiser titres, descriptions et visuels avec l'IA." },
  { href: "/docs/score", label: "Score FeedPlug", icon: BarChart3, description: "Un score 0–100 pour savoir où progresser." },
  { href: "/docs/export", label: "Export et flux", icon: Share2, description: "Google Shopping, téléchargement, canaux." },
  { href: "/docs/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Piloter votre activité en temps réel." },
  { href: "/docs/compte", label: "Compte et équipe", icon: Shield, description: "Connexion, rôles, facturation, confidentialité." },
  { href: "/docs/demarrage", label: "Démarrer", icon: CheckCircle, description: "Parcours guidé pas à pas pour être opérationnel." },
  { href: "/docs/faq", label: "FAQ et dépannage", icon: HelpCircle, description: "Questions fréquentes et résolution des problèmes courants." },
  { href: "/docs/glossaire", label: "Glossaire", icon: BookOpen, description: "Définitions : GTIN, MPN, Google Product Category, etc." },
  { href: "/docs/roadmap", label: "Roadmap", icon: ArrowRight, description: "Évolutions prévues et planning." },
];

export default function DocsIndexPage() {
  return (
    <>
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 24,
          background: "#fbfdff",
          padding: "24px 24px 22px",
          marginBottom: 28,
        }}
      >
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#94a3b8", marginBottom: 10 }}>
          Vue d&apos;ensemble
        </div>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.04em", marginBottom: 8, color: "#0f172a" }}>
          Documentation FeedPlug
        </h1>
        <p style={{ color: "#475569", fontSize: "1.05rem", marginBottom: 16, lineHeight: 1.7 }}>
          Cette documentation s&apos;adresse aux e-commerçants et équipes qui gèrent leurs flux produits (feed) pour Google Shopping, Google Merchant Center, Meta, Amazon et les marketplaces (Cdiscount, Mirakl, Fnac, Rakuten). Vous y trouverez comment importer vos catalogues, les optimiser avec le score et l&apos;enrichissement IA, et exporter des flux conformes vers chaque canal.
        </p>
        <p style={{ color: "#475569", fontSize: "1rem", marginBottom: 0, lineHeight: 1.7 }}>
          FeedPlug centralise un seul catalogue et génère des exports adaptés aux exigences de chaque plateforme — plus besoin de maintenir plusieurs fichiers ou d&apos;intégrer des APIs. Les guides ci-dessous détaillent les sources (Shopify, fichiers), le catalogue et le score qualité, l&apos;enrichissement IA, l&apos;export vers Google Merchant Center et les marketplaces, ainsi que le démarrage pas à pas.
        </p>
      </div>

      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 12, marginTop: 40 }}>
        Pour commencer
      </h2>
      <p style={{ color: "#4a4a4a", fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>
        Créez un compte, connectez une source (Shopify ou fichier d&apos;export), lancez une synchronisation puis consultez votre catalogue. Le parcours <Link href="/docs/demarrage" style={{ color: "#0a0a0a", textDecoration: "underline" }}>Démarrer</Link> détaille chaque étape. Pour l&apos;import depuis Shopify ou un fichier CSV/tableur, voir <Link href="/docs/sources" style={{ color: "#0a0a0a", textDecoration: "underline" }}>Sources et import</Link>.
      </p>

      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 12, marginTop: 32 }}>
        Export et canaux
      </h2>
      <p style={{ color: "#4a4a4a", fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>
        Une fois votre catalogue importé et optimisé, vous créez des flux d&apos;export vers Google Merchant Center (Google Shopping), Meta, Amazon, Cdiscount, Mirakl ou d&apos;autres marketplaces. Chaque canal reçoit le format attendu (flux XML, CSV, attributs obligatoires). Le guide <Link href="/docs/export" style={{ color: "#0a0a0a", textDecoration: "underline" }}>Export et flux</Link> explique la connexion à Google Merchant Center et la génération des flux. Pour améliorer la conformité et la qualité de vos fiches, consultez le <Link href="/docs/score" style={{ color: "#0a0a0a", textDecoration: "underline" }}>Score FeedPlug</Link> et le <Link href="/docs/glossaire" style={{ color: "#0a0a0a", textDecoration: "underline" }}>Glossaire</Link> (GTIN, MPN, Google Product Category, etc.).
      </p>

      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 12, marginTop: 32 }}>
        Référence
      </h2>
      <p style={{ color: "#4a4a4a", fontSize: 15, marginBottom: 32, lineHeight: 1.6 }}>
        <Link href="/docs/faq" style={{ color: "#0a0a0a", textDecoration: "underline" }}>FAQ et dépannage</Link> pour les questions fréquentes (connexion, synchro, rejets Google Merchant Center, enrichissement IA). <Link href="/docs/glossaire" style={{ color: "#0a0a0a", textDecoration: "underline" }}>Glossaire</Link> pour les définitions des termes (flux produit, feed, GMC, marketplace). <Link href="/docs/roadmap" style={{ color: "#0a0a0a", textDecoration: "underline" }}>Roadmap</Link> pour les évolutions prévues.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {docLinks.map(({ href, label, icon: Icon, description }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: 20,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              backgroundColor: "#fafafa",
              textDecoration: "none",
              color: "#0a0a0a",
              transition: "background-color 0.2s, border-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f3f4f6";
              e.currentTarget.style.borderColor = "#d1d5db";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#fafafa";
              e.currentTarget.style.borderColor = "#e5e7eb";
            }}
          >
            <Icon size={24} style={{ flexShrink: 0, color: "#0a0a0a" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: "1.05rem", marginBottom: 4 }}>{label}</div>
              <div style={{ color: "#6b7280", fontSize: 14 }}>{description}</div>
            </div>
            <ArrowRight size={18} style={{ flexShrink: 0, color: "#6b7280" }} />
          </Link>
        ))}
      </div>

      <p style={{ marginTop: 32, fontSize: 14, color: "#6b7280" }}>
        <a
          href="https://app.feedplug.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#0a0a0a", textDecoration: "underline" }}
        >
          Accéder à l&apos;application FeedPlug
        </a>{" "}
        — Connexion requise.
      </p>
    </>
  );
}
