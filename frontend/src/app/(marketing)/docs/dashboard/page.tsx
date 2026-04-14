"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

export default function DocsDashboardPage() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <LayoutDashboard size={28} style={{ color: "#0a0a0a" }} />
        <h1 style={{ fontSize: "2rem", fontWeight: 600, margin: 0 }}>
          Dashboard
        </h1>
      </div>

      <p style={{ color: "#6b7280", fontSize: "1.05rem", marginBottom: 32, lineHeight: 1.6 }}>
        Toute votre activité en un coup d&apos;œil : sources, flux, catalogue, score et mises à jour.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>Ce que vous voyez en temps réel</h2>
        <ul style={{ margin: "0 0 16px", paddingLeft: 20, color: "#4a4a4a", fontSize: 15, lineHeight: 1.7 }}>
          <li>Le nombre de sources et de flux connectés.</li>
          <li>La taille de votre catalogue.</li>
          <li>Le score moyen de vos fiches et son évolution sur les 30 derniers jours.</li>
          <li>Le volume de produits déjà enrichis par l&apos;IA.</li>
          <li>Le statut des dernières mises à jour (succès ou alerte).</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>Emails automatiques</h2>
        <p style={{ margin: 0, color: "#4a4a4a", fontSize: 15, lineHeight: 1.6 }}>
          Vous recevez des emails automatiques : mise à jour terminée, export prêt, alerte en cas de problème, et message de bienvenue à l&apos;inscription.
        </p>
      </section>

      <p style={{ fontSize: 14, color: "#6b7280" }}>
        <Link href="/docs" style={{ color: "#0a0a0a", textDecoration: "underline" }}>← Retour à la documentation</Link>
      </p>
    </>
  );
}
