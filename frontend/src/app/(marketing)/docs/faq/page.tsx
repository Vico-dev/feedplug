"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { FAQ_DOCS } from "@/lib/faq-docs";

export default function DocsFaqPage() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <HelpCircle size={28} style={{ color: "#0a0a0a" }} />
        <h1 style={{ fontSize: "2rem", fontWeight: 600, margin: 0 }}>
          FAQ et dépannage
        </h1>
      </div>

      <p style={{ color: "#6b7280", fontSize: "1.05rem", marginBottom: 32, lineHeight: 1.6 }}>
        Réponses aux questions fréquentes et pistes pour résoudre les problèmes courants. Si votre situation n&apos;est pas couverte, contactez le support via la page <Link href="/demo" style={{ color: "#0a0a0a", textDecoration: "underline" }}>Contact</Link>.
      </p>

      {FAQ_DOCS.map(({ category, items }) => (
        <section key={category} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>{category}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {items.map(({ q, a }) => (
              <div key={q} style={{ padding: "16px 0", borderBottom: "1px solid #e5e7eb" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8, color: "#0a0a0a" }}>{q}</h3>
                <p style={{ margin: 0, color: "#4a4a4a", fontSize: 15, lineHeight: 1.6 }}>{a}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <p style={{ fontSize: 14, color: "#6b7280" }}>
        <Link href="/docs" style={{ color: "#0a0a0a", textDecoration: "underline" }}>← Retour à la documentation</Link>
      </p>
    </>
  );
}
