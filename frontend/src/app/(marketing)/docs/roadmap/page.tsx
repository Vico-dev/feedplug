"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Circle, Send } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

const API_URL = API_BASE_URL;

export default function RoadmapPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch(`${API_URL}/marketing/feature-idea`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, idea: idea.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.message || "Une erreur est survenue.");
        return;
      }
      setStatus("success");
      setEmail("");
      setName("");
      setIdea("");
      setMessage(data.message || "Merci ! Votre idée a bien été enregistrée.");
    } catch {
      setStatus("error");
      setMessage("Erreur de connexion. Réessayez plus tard.");
    }
  };

  return (
    <>
      <h1 style={{ fontSize: "2rem", fontWeight: 600, marginBottom: 8 }}>
        Roadmap FeedPlug
      </h1>
      <p style={{ color: "#6b7280", fontSize: "1.05rem", marginBottom: 48 }}>
        Les évolutions prévues pour vous aider à mieux vendre et piloter vos campagnes. Les délais sont indicatifs.
      </p>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>
          Déjà disponible
        </h2>
        <p style={{ color: "#4a4a4a", marginBottom: 16, lineHeight: 1.6 }}>
          Import depuis Shopify ou depuis des fichiers d&apos;export, enrichissement IA avec des templates par secteur (mode, beauté, tech, food, home), score qualité 0–100, export vers Google Merchant Center, tests A/B par segment, tableau de bord avec évolution du score, rôles et facturation, parcours de démarrage guidé, et emails de suivi (mise à jour terminée, export prêt, alerte en cas d&apos;erreur).
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 8 }}>
          Prochaines étapes — Pilotage et canaux
        </h2>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
          Objectif : vous donner plus de visibilité sur l&apos;impact de vos optimisations et élargir vos canaux. Cible : mars 2026.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          <RoadmapItem done={false} title="Mesure d'impact de vos campagnes (performances Google Ads, état de vos annonces Merchant Center)" />
          <RoadmapItem done={false} title="Tests A/B avancés avec historique et application automatique des versions gagnantes" />
          <RoadmapItem done={false} title="Rapports téléchargeables (PDF, Excel) et envoi automatique par email" />
          <RoadmapItem done={false} title="Connexion WooCommerce pour importer vos produits depuis votre boutique" />
          <RoadmapItem done={false} title="Alertes et notifications vers vos autres outils (quand une mise à jour est terminée, etc.)" />
          <RoadmapItem done={false} title="Planification des mises à jour de catalogue directement dans l'interface" />
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 8 }}>
          À plus long terme — Intelligence et canaux
        </h2>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
          Objectif : anticiper les performances et vous différencier de la concurrence. Cible : mai 2026 et au-delà.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          <RoadmapItem done={false} title="Estimation du potentiel d'un titre ou d'une description avant mise en ligne" />
          <RoadmapItem done={false} title="Création et test automatique de plusieurs versions de vos annonces (rotation et sélection des meilleures)" />
          <RoadmapItem done={false} title="Benchmark de vos annonces par rapport à la concurrence sur Google Shopping" />
          <RoadmapItem done={false} title="Alertes en cas de baisse de visibilité ou d'anomalie sur vos produits" />
          <RoadmapItem done={false} title="Intégrations pour connecter FeedPlug à vos autres outils (CRM, analytics, etc.)" />
          <RoadmapItem done={false} title="Nouvelles plateformes : PrestaShop, Magento, BigCommerce et autres" />
        </ul>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>
          Où en est-on ?
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 16,
          }}
        >
          <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Fondations</div>
            <div style={{ fontWeight: 600 }}>En place</div>
            <div style={{ fontSize: 13, color: "#4a4a4a" }}>Fév. 2026</div>
          </div>
          <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Pilotage & canaux</div>
            <div style={{ fontWeight: 600 }}>À venir</div>
            <div style={{ fontSize: 13, color: "#4a4a4a" }}>Cible mars 2026</div>
          </div>
          <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Intelligence & canaux</div>
            <div style={{ fontWeight: 600 }}>À venir</div>
            <div style={{ fontSize: 13, color: "#4a4a4a" }}>Cible mai 2026</div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 16 }}>
          Proposer une idée
        </h2>
        <p style={{ color: "#4a4a4a", fontSize: 15, marginBottom: 20, lineHeight: 1.5 }}>
          Une fonctionnalité vous manque ? Dites-nous ce qui vous aiderait au quotidien.
        </p>
        {status === "success" ? (
          <div
            style={{
              padding: 20,
              borderRadius: 8,
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
              fontSize: 15,
            }}
          >
            {message}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
            <div>
              <label htmlFor="feature-email" style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6, color: "#374151" }}>
                Email <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                id="feature-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 15,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label htmlFor="feature-name" style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6, color: "#374151" }}>
                Nom (optionnel)
              </label>
              <input
                id="feature-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom ou prénom"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 15,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label htmlFor="feature-idea" style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6, color: "#374151" }}>
                Votre idée <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <textarea
                id="feature-idea"
                required
                minLength={10}
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Décrivez la fonctionnalité que vous aimeriez voir dans FeedPlug..."
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontSize: 15,
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {status === "error" && message && (
              <div style={{ fontSize: 14, color: "#dc2626" }}>{message}</div>
            )}
            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 20px",
                backgroundColor: "#0a0a0a",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 15,
                fontWeight: 500,
                cursor: status === "sending" ? "not-allowed" : "pointer",
                opacity: status === "sending" ? 0.7 : 1,
              }}
            >
              <Send size={18} />
              {status === "sending" ? "Envoi…" : "Envoyer mon idée"}
            </button>
          </form>
        )}
      </section>

      <p style={{ fontSize: 14, color: "#6b7280" }}>
        <Link href="/docs" style={{ color: "#0a0a0a", textDecoration: "underline" }}>
          Retour à la documentation
        </Link>
      </p>
    </>
  );
}

function RoadmapItem({
  done,
  title,
}: {
  done: boolean;
  title: string;
}) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        marginBottom: 12,
        color: done ? "#6b7280" : "#0a0a0a",
      }}
    >
      {done ? (
        <Check size={18} style={{ flexShrink: 0, color: "#16a34a" }} />
      ) : (
        <Circle size={18} style={{ flexShrink: 0, color: "#9ca3af" }} strokeWidth={2} />
      )}
      <span>{title}</span>
    </li>
  );
}
