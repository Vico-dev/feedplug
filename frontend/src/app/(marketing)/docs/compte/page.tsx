"use client";

import Link from "next/link";
import { Shield } from "lucide-react";

export default function DocsComptePage() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Shield size={28} style={{ color: "#0a0a0a" }} />
        <h1 style={{ fontSize: "2rem", fontWeight: 600, margin: 0 }}>
          Compte et équipe
        </h1>
      </div>

      <p style={{ color: "var(--ink-3)", fontSize: "1.05rem", marginBottom: 32, lineHeight: 1.6 }}>
        Connexion sécurisée, gestion des accès et facturation.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>Connexion</h2>
        <p style={{ margin: "0 0 16px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Connexion par email et mot de passe ou via Google. En cas d&apos;oubli, un lien de réinitialisation est envoyé par email.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>Rôles</h2>
        <p style={{ margin: "0 0 12px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          Vous pouvez inviter des collaborateurs et leur donner un niveau d&apos;accès :
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.7 }}>
          <li><strong>Propriétaire</strong> — Accès complet, facturation et paramètres du compte.</li>
          <li><strong>Manager</strong> — Gestion des sources, flux, optimisations et exports.</li>
          <li><strong>Lecteur</strong> — Consultation uniquement.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>Facturation</h2>
        <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          La facturation est gérée de façon sécurisée. Les tarifs et la consommation (sources, enrichissement IA, etc.) sont consultables dans votre compte. Les moyens de paiement et les factures sont disponibles dans la section dédiée.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>Données et confidentialité</h2>
        <p style={{ margin: "0 0 12px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          FeedPlug traite vos données produits (titres, descriptions, prix, images, etc.) pour fournir le service : synchronisation, scoring, enrichissement IA et export. Ces données sont hébergées sur des infrastructures sécurisées (Europe) et utilisées uniquement pour faire fonctionner la plateforme et générer vos flux. Nous ne vendons pas vos données à des tiers.
        </p>
        <ul style={{ margin: "0 0 16px", paddingLeft: 20, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.7 }}>
          <li><strong>RGPD</strong> — Conformité au Règlement général sur la protection des données : droits d&apos;accès, de rectification, d&apos;effacement et à la portabilité. Vous pouvez demander l&apos;export ou la suppression de vos données via le compte ou en contactant le support.</li>
          <li><strong>Durée de conservation</strong> — Les données sont conservées tant que votre compte est actif. En cas de clôture de compte, elles sont supprimées selon les délais prévus dans nos conditions et notre politique de confidentialité.</li>
          <li><strong>Sous-traitants</strong> — Les hébergeurs et prestataires techniques (ex. infrastructure cloud, fournisseur d&apos;IA) sont choisis pour leur conformité et leurs garanties de sécurité. Les détails figurent dans notre politique de confidentialité et nos documents contractuels.</li>
        </ul>
        <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 14, lineHeight: 1.6 }}>
          Pour le détail complet, consultez les Conditions générales d&apos;utilisation et la Politique de confidentialité disponibles sur le site FeedPlug.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>Sécurité du compte</h2>
        <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 15, lineHeight: 1.6 }}>
          La connexion est sécurisée (HTTPS, mots de passe hashés). Nous vous recommandons d&apos;utiliser un mot de passe robuste et de ne pas partager vos identifiants. Les rôles (Propriétaire, Manager, Lecteur) permettent de limiter les accès selon les besoins de votre équipe.
        </p>
      </section>

      <p style={{ fontSize: 14, color: "var(--ink-3)" }}>
        <Link href="/docs" style={{ color: "#0a0a0a", textDecoration: "underline" }}>← Retour à la documentation</Link>
      </p>
    </>
  );
}
