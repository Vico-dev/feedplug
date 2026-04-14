"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { ArrowRight, BarChart3, CheckCircle2, Copy, Download, ExternalLink, Link2, Share2 } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import {
  connectMarketingAuditFile,
  connectMarketingAuditPrestashop,
  getMarketingAudit,
  getMarketingAuditGmcAuthUrl,
  getMarketingAuditPdfUrl,
  getMarketingAuditShopifyAuthUrl,
  type MarketingAudit,
  type MarketingAuditIssue,
} from "@/lib/services/marketing-audit.service";

function getIssueStyle(severity: MarketingAuditIssue["severity"]) {
  if (severity === "high") return { border: "#fecaca", bg: "#fef2f2", text: "#b91c1c", label: "Priorite haute" };
  if (severity === "medium") return { border: "#fde68a", bg: "#fffbeb", text: "#b45309", label: "Priorite moyenne" };
  return { border: "#cbd5e1", bg: "#f8fafc", text: "#475569", label: "Priorite basse" };
}

function getAuditStageLabel(status?: string) {
  if (status === "source_connected") return "Source connectee";
  if (status === "analyzing") return "Analyse en cours";
  if (status === "ready") return "Audit disponible";
  return "Connexion source requise";
}

export default function MarketingAuditReportPage() {
  const params = useParams<{ shareToken: string }>();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const [audit, setAudit] = useState<MarketingAudit | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState<"" | "shopify" | "gmc" | "prestashop" | "file">("");
  const [prestashopCredentials, setPrestashopCredentials] = useState({ shopUrl: "", apiKey: "" });
  const [fileConnection, setFileConnection] = useState({ feedUrl: "" });

  useEffect(() => {
    const shareToken = params?.shareToken;
    if (!shareToken) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await getMarketingAudit(shareToken);
        if (!cancelled) setAudit(result);
      } catch (reportError) {
        if (!cancelled) {
          setError(reportError instanceof Error ? reportError.message : "Audit introuvable");
          setAudit(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const isNew = searchParams.get("new") === "1";
  const isReady = Boolean(audit?.report) && audit?.status === "ready";
  const shopifyConnected = Boolean(audit?.input?.shopifyConnection?.connectedAt);
  const gmcConnected = Boolean(audit?.input?.gmcConnection?.connectedAt);
  const prestashopConnected = Boolean((audit?.input as { prestashopConnection?: { connectedAt?: string } } | undefined)?.prestashopConnection?.connectedAt);
  const fileConnected = Boolean((audit?.input as { csvConnection?: { connectedAt?: string } } | undefined)?.csvConnection?.connectedAt);

  const handleCopy = async () => {
    if (!audit?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(audit.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const handleShopifyConnect = async () => {
    if (!audit?.shareToken) return;
    const shopRaw = window.prompt("Nom de boutique Shopify (ex: ma-boutique ou ma-boutique.myshopify.com)");
    if (!shopRaw) return;
    try {
      setConnecting("file");
      const url = await getMarketingAuditShopifyAuthUrl(audit.shareToken, shopRaw.trim());
      window.location.href = url;
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Connexion Shopify indisponible");
      setConnecting("");
    }
  };

  const handleGmcConnect = async () => {
    if (!audit?.shareToken) return;
    try {
      setConnecting("gmc");
      const url = await getMarketingAuditGmcAuthUrl(audit.shareToken);
      window.location.href = url;
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Connexion GMC indisponible");
      setConnecting("");
    }
  };

  const handlePrestashopConnect = async () => {
    if (!audit?.shareToken) return;
    try {
      setConnecting("shopify");
      await connectMarketingAuditPrestashop(audit.shareToken, {
        shopUrl: prestashopCredentials.shopUrl.trim(),
        apiKey: prestashopCredentials.apiKey.trim(),
      });
      const refreshed = await getMarketingAudit(audit.shareToken);
      setAudit(refreshed);
      setPrestashopCredentials({ shopUrl: "", apiKey: "" });
      setConnecting("");
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Connexion PrestaShop indisponible");
      setConnecting("");
    }
  };

  const handleFileConnect = async () => {
    if (!audit?.shareToken) return;
    try {
      setConnecting("prestashop");
      await connectMarketingAuditFile(audit.shareToken, {
        feedUrl: fileConnection.feedUrl.trim(),
      });
      const refreshed = await getMarketingAudit(audit.shareToken);
      setAudit(refreshed);
      setFileConnection({ feedUrl: "" });
      setConnecting("");
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Connexion flux indisponible");
      setConnecting("");
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          header, .audit-actions, .audit-cta, .audit-banner { display: none !important; }
          main { background: white !important; }
          .audit-shell, .audit-card { box-shadow: none !important; border-color: #d1d5db !important; }
        }
      ` }} />
      <MarketingHeader />
      <main style={{ background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)", minHeight: "100vh", padding: "124px 24px 48px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          {loading ? (
            <div className="audit-shell" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 28, padding: 32 }}>Chargement de l audit...</div>
          ) : error || !audit ? (
            <div className="audit-shell" style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 28, padding: 32, color: "#b91c1c" }}>{error || "Audit introuvable"}</div>
          ) : (
            <>
              {isNew ? (
                <div className="audit-banner" style={{ marginBottom: 20, padding: "14px 18px", borderRadius: 18, background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#166534", fontSize: 14, fontWeight: 600 }}>
                  Demande d audit enregistree. Aucune note n est affichee tant que la source reelle n est pas connectee.
                </div>
              ) : null}

              <section className="audit-shell" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 28, padding: 28, boxShadow: "0 20px 48px rgba(15,23,42,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                  <div style={{ maxWidth: 720 }}>
                    <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0f766e" }}>Audit de flux</p>
                    <h1 style={{ margin: "0 0 12px", fontSize: "clamp(34px, 5vw, 54px)", lineHeight: 1.02, letterSpacing: "-0.05em", color: "#0f172a" }}>
                      {audit.company}
                    </h1>
                    <p style={{ margin: 0, fontSize: 18, lineHeight: 1.7, color: "#475569" }}>
                      Source {audit.cmsUsed || audit.connectorType} · {audit.catalogSize} produits · canaux cibles {audit.targetChannels.join(", ")}
                    </p>
                  </div>

                  <div className="audit-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <button type="button" onClick={handleCopy} style={{ minHeight: 46, padding: "0 16px", borderRadius: 14, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", fontSize: 14, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <Copy size={15} />
                      {copied ? "Lien copie" : "Copier le lien"}
                    </button>
                    <a href={getMarketingAuditPdfUrl(audit.shareToken)} target="_blank" rel="noreferrer" style={{ minHeight: 46, padding: "0 16px", borderRadius: 14, border: "1px solid #0f172a", background: "#0f172a", color: "#fff", fontSize: 14, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", textDecoration: "none" }}>
                      <Download size={15} />
                      Exporter en PDF
                    </a>
                  </div>
                </div>

                {!isReady ? (
                  <>
                    <div style={{ marginTop: 28, display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                      {[
                        { label: "Statut", value: getAuditStageLabel(audit.status), hint: "Le score gratuit apparait uniquement apres connexion de la vraie source.", accent: "#0f766e" },
                        { label: "Source attendue", value: audit.cmsUsed || audit.connectorType, hint: "Source que FeedPlug doit connecter pour lancer l analyse.", accent: "#2563eb" },
                        { label: "Canaux cibles", value: audit.targetChannels.length, hint: audit.targetChannels.join(", "), accent: "#16a34a" },
                        { label: "Catalogue declare", value: audit.catalogSize, hint: "Volume annonce pour preparer l audit.", accent: "#7c3aed" },
                      ].map((card) => (
                        <div key={card.label} className="audit-card" style={{ border: "1px solid #e2e8f0", borderRadius: 22, padding: 22, background: "#fff" }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#64748b" }}>{card.label}</p>
                          <p style={{ margin: "12px 0 8px", fontSize: 30, lineHeight: 1, fontWeight: 700, letterSpacing: "-0.05em", color: card.accent }}>{card.value}</p>
                          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#475569" }}>{card.hint}</p>
                        </div>
                      ))}
                    </div>

                    <div className="audit-cta" style={{ marginTop: 28, padding: 24, borderRadius: 24, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ maxWidth: 760 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <CheckCircle2 size={18} color="#0f766e" />
                            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0f766e" }}>Prochaine etape</span>
                          </div>
                          <h2 style={{ margin: "0 0 8px", fontSize: 22, color: "#0f172a" }}>Connectez une vraie source pour declencher l audit technique gratuit.</h2>
                          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#475569" }}>
                            Tant que FeedPlug n’a pas acces a Shopify, Google Merchant Center ou au flux reel, aucun score n’est affiche. C’est volontaire pour garder un audit credible.
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button type="button" onClick={handleShopifyConnect} disabled={connecting !== "" || shopifyConnected} style={{ minHeight: 48, padding: "0 18px", borderRadius: 14, background: "#fff", border: "1px solid #cbd5e1", color: "#0f172a", display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", fontSize: 14, fontWeight: 700, cursor: connecting ? "wait" : "pointer", opacity: shopifyConnected ? 0.6 : 1 }}>
                            {shopifyConnected ? "Shopify connecte" : connecting === "shopify" ? "Connexion..." : "Connecter Shopify"}
                          </button>
                          <button type="button" onClick={handleGmcConnect} disabled={connecting !== "" || gmcConnected} style={{ minHeight: 48, padding: "0 18px", borderRadius: 14, background: "#fff", border: "1px solid #cbd5e1", color: "#0f172a", display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", fontSize: 14, fontWeight: 700, cursor: connecting ? "wait" : "pointer", opacity: gmcConnected ? 0.6 : 1 }}>
                            {gmcConnected ? "GMC connecte" : connecting === "gmc" ? "Connexion..." : "Connecter GMC"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 18, display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 0.9fr)" }}>
                      <div className="audit-card" style={{ border: "1px solid #e2e8f0", borderRadius: 22, padding: 24, background: "#fff" }}>
                        <h2 style={{ margin: "0 0 16px", fontSize: 20, color: "#0f172a" }}>Ce qui est inclus gratuitement</h2>
                        <div style={{ display: "grid", gap: 12 }}>
                          {[
                            "Score de qualite du flux sur 100",
                            "Couverture attributaire et diffusabilite",
                            "Problemes bloquants prioritaires",
                            "Potentiel structurel du catalogue",
                          ].map((item) => (
                            <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, color: "#334155", fontSize: 14 }}>
                              <CheckCircle2 size={16} color="#0f766e" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="audit-card" style={{ border: "1px solid #e2e8f0", borderRadius: 22, padding: 24, background: "#0f172a", color: "#fff" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                          <BarChart3 size={18} />
                          <h2 style={{ margin: 0, fontSize: 20 }}>Ce qui reste payant</h2>
                        </div>
                        <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.76)" }}>
                          Le scoring performance n’est pas dans l’audit gratuit.
                        </p>
                        <div style={{ display: "grid", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
                          <span>Impressions, clics, CTR et conversion par produit</span>
                          <span>Scoring rentabilite et priorisation business</span>
                          <span>Lecture ROAS / CPA / produits sous-performants</span>
                        </div>
                      </div>
                    </div>

                    {(audit.connectorType === "PRESTASHOP" || (audit.cmsUsed || "").toLowerCase().includes("presta")) ? (
                      <div style={{ marginTop: 18 }} className="audit-card">
                        <div style={{ border: "1px solid #e2e8f0", borderRadius: 22, padding: 24, background: "#fff" }}>
                          <h2 style={{ margin: "0 0 12px", fontSize: 20, color: "#0f172a" }}>Connecter PrestaShop</h2>
                          <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.7, color: "#475569" }}>
                            Renseignez l URL de la boutique et la cle API webservice pour lancer l analyse technique reelle.
                          </p>
                          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                            <input
                              type="text"
                              value={prestashopCredentials.shopUrl}
                              onChange={(event) => setPrestashopCredentials((current) => ({ ...current, shopUrl: event.target.value }))}
                              placeholder="https://ma-boutique.com"
                              style={{ minHeight: 48, borderRadius: 14, border: "1px solid #cbd5e1", padding: "0 14px", fontSize: 14, color: "#0f172a" }}
                            />
                            <input
                              type="password"
                              value={prestashopCredentials.apiKey}
                              onChange={(event) => setPrestashopCredentials((current) => ({ ...current, apiKey: event.target.value }))}
                              placeholder="Cle API webservice"
                              style={{ minHeight: 48, borderRadius: 14, border: "1px solid #cbd5e1", padding: "0 14px", fontSize: 14, color: "#0f172a" }}
                            />
                          </div>
                          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={handlePrestashopConnect}
                              disabled={connecting !== "" || prestashopConnected || !prestashopCredentials.shopUrl.trim() || !prestashopCredentials.apiKey.trim()}
                              style={{ minHeight: 48, padding: "0 18px", borderRadius: 14, background: "#0f172a", border: "1px solid #0f172a", color: "#fff", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, cursor: connecting ? "wait" : "pointer", opacity: prestashopConnected ? 0.6 : 1 }}
                            >
                              {prestashopConnected ? "PrestaShop connecte" : connecting === "prestashop" ? "Connexion..." : "Connecter PrestaShop"}
                            </button>
                            <span style={{ fontSize: 13, color: "#64748b" }}>
                              Webservice PrestaShop requis avec lecture des produits.
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {(audit.connectorType === "CSV" || (audit.cmsUsed || "").toLowerCase().includes("csv") || (audit.cmsUsed || "").toLowerCase().includes("xml")) ? (
                      <div style={{ marginTop: 18 }} className="audit-card">
                        <div style={{ border: "1px solid #e2e8f0", borderRadius: 22, padding: 24, background: "#fff" }}>
                          <h2 style={{ margin: "0 0 12px", fontSize: 20, color: "#0f172a" }}>Connecter un flux CSV / XML</h2>
                          <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.7, color: "#475569" }}>
                            Renseignez l URL publique du flux pour lancer l analyse technique reelle du catalogue.
                          </p>
                          <input
                            type="text"
                            value={fileConnection.feedUrl}
                            onChange={(event) => setFileConnection({ feedUrl: event.target.value })}
                            placeholder="https://ma-boutique.com/feed.xml"
                            style={{ width: "100%", minHeight: 48, borderRadius: 14, border: "1px solid #cbd5e1", padding: "0 14px", fontSize: 14, color: "#0f172a" }}
                          />
                          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={handleFileConnect}
                              disabled={connecting !== "" || fileConnected || !fileConnection.feedUrl.trim()}
                              style={{ minHeight: 48, padding: "0 18px", borderRadius: 14, background: "#0f172a", border: "1px solid #0f172a", color: "#fff", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, cursor: connecting ? "wait" : "pointer", opacity: fileConnected ? 0.6 : 1 }}
                            >
                              {fileConnected ? "Flux connecte" : connecting === "file" ? "Connexion..." : "Connecter le flux"}
                            </button>
                            <span style={{ fontSize: 13, color: "#64748b" }}>
                              Formats supportes: CSV, TSV, XML type Google Merchant.
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div style={{ marginTop: 28, display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                      {[
                        { label: "Score actuel", value: `${audit.report?.score}/100`, hint: "Etat technique du flux aujourd hui", accent: "#0f766e" },
                        { label: "Potentiel avec FeedPlug", value: `${audit.report?.potentialScore}/100`, hint: "Score projetable apres correction des points critiques", accent: "#2563eb" },
                        { label: "Produits recuperables", value: audit.report?.estimatedAdditionalApprovedProducts ?? 0, hint: "Produits additionnels potentiellement diffusables", accent: "#16a34a" },
                        { label: "Gain de visibilite estime", value: `${audit.report?.estimatedVisibilityLiftPct ?? 0}%`, hint: "Projection basee sur l analyse technique reelle", accent: "#7c3aed" },
                      ].map((card) => (
                        <div key={card.label} className="audit-card" style={{ border: "1px solid #e2e8f0", borderRadius: 22, padding: 22, background: "#fff" }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#64748b" }}>{card.label}</p>
                          <p style={{ margin: "12px 0 8px", fontSize: 34, lineHeight: 1, fontWeight: 700, letterSpacing: "-0.05em", color: card.accent }}>{card.value}</p>
                          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#475569" }}>{card.hint}</p>
                        </div>
                      ))}
                    </div>

                    {audit.report?.scoreBand ? (
                      <div style={{ marginTop: 18, padding: 22, borderRadius: 22, border: "1px solid #dbeafe", background: "#f8fbff" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2563eb", marginBottom: 8 }}>
                          Niveau de maturite
                        </div>
                        <h2 style={{ margin: "0 0 8px", fontSize: 22, color: "#0f172a" }}>{audit.report.scoreBand.label}</h2>
                        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#475569" }}>{audit.report.scoreBand.description}</p>
                      </div>
                    ) : null}

                    {audit.report?.auditPillars?.length ? (
                      <div style={{ marginTop: 18 }}>
                        <h2 style={{ margin: "0 0 16px", fontSize: 22, color: "#0f172a" }}>4 leviers de valeur</h2>
                        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                          {audit.report.auditPillars.map((pillar) => (
                            <div key={pillar.key} className="audit-card" style={{ border: "1px solid #e2e8f0", borderRadius: 22, padding: 22, background: "#fff" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{pillar.label}</span>
                                <span style={{ fontSize: 18, fontWeight: 700, color: "#0f766e" }}>{pillar.score}/100</span>
                              </div>
                              <div style={{ height: 10, borderRadius: 999, background: "#e2e8f0", overflow: "hidden", marginBottom: 10 }}>
                                <div style={{ width: `${Math.max(4, Math.min(pillar.score, 100))}%`, height: "100%", borderRadius: 999, background: "#0f766e" }} />
                              </div>
                              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "#475569" }}>{pillar.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div style={{ marginTop: 28, display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 0.9fr)" }}>
                      <div className="audit-card" style={{ border: "1px solid #e2e8f0", borderRadius: 22, padding: 24, background: "#fff" }}>
                        <h2 style={{ margin: "0 0 16px", fontSize: 20, color: "#0f172a" }}>Breakdown du score</h2>
                        {[
                          { label: "Couverture des donnees", value: audit.report?.scoreBreakdown.dataCoverage ?? 0, accent: "#0f766e" },
                          { label: "Qualite produit moyenne", value: audit.report?.scoreBreakdown.productQuality ?? 0, accent: "#2563eb" },
                          { label: "Readiness canal", value: audit.report?.scoreBreakdown.channelReadiness ?? 0, accent: "#7c3aed" },
                          { label: "Produits deja prets", value: audit.report?.summary.approvalReadyRate ?? 0, accent: "#16a34a", suffix: "%" },
                        ].map((item) => (
                          <div key={item.label} style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>{item.label}</span>
                              <span style={{ fontSize: 14, fontWeight: 700, color: item.accent }}>{item.value}{item.suffix || "/100"}</span>
                            </div>
                            <div style={{ height: 10, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                              <div style={{ width: `${Math.max(4, Math.min(item.value, 100))}%`, height: "100%", borderRadius: 999, background: item.accent }} />
                            </div>
                          </div>
                        ))}
                        <p style={{ margin: "18px 0 0", fontSize: 13, lineHeight: 1.7, color: "#64748b" }}>{audit.report?.methodology.estimation}</p>
                      </div>

                      <div className="audit-card" style={{ border: "1px solid #e2e8f0", borderRadius: 22, padding: 24, background: "#0f172a", color: "#fff" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                          <BarChart3 size={18} />
                          <h2 style={{ margin: 0, fontSize: 20 }}>Synthese commerciale</h2>
                        </div>
                        {(audit.report?.opportunities || []).map((opportunity) => (
                          <div key={opportunity.label} style={{ padding: "14px 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.64)", marginBottom: 6 }}>{opportunity.label}</div>
                            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em", marginBottom: 6 }}>{opportunity.value}</div>
                            <div style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.72)" }}>{opportunity.detail}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: 28 }}>
                      <h2 style={{ margin: "0 0 16px", fontSize: 22, color: "#0f172a" }}>5 priorites a traiter</h2>
                      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                        {(audit.report?.topIssues || []).map((issue) => {
                          const style = getIssueStyle(issue.severity);
                          return (
                            <div key={issue.key} className="audit-card" style={{ border: `1px solid ${style.border}`, borderRadius: 22, padding: 22, background: style.bg }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: style.text }}>{style.label}</div>
                                  <h3 style={{ margin: "10px 0 0", fontSize: 18, color: "#0f172a" }}>{issue.label}</h3>
                                </div>
                                <div style={{ padding: "8px 10px", borderRadius: 999, background: "#fff", border: `1px solid ${style.border}`, color: style.text, fontSize: 12, fontWeight: 700 }}>{issue.affectedRate}%</div>
                              </div>
                              <p style={{ margin: "0 0 8px", fontSize: 14, lineHeight: 1.7, color: "#334155" }}>{issue.affectedProducts} produits concernes. {issue.impact}</p>
                              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "#475569" }}>Action recommandee: {issue.recommendation}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap", color: "#64748b", fontSize: 13 }}>
                  <span>Source: {audit.cmsUsed || audit.connectorType}</span>
                  {audit.shopUrl ? <a href={audit.shopUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}><ExternalLink size={14} />{audit.shopUrl}</a> : null}
                  {audit.merchantId ? <span>Merchant ID: {audit.merchantId}</span> : null}
                </div>

                <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link href={`/register?email=${encodeURIComponent(audit.email)}`} style={{ minHeight: 48, padding: "0 18px", borderRadius: 14, background: "#0f172a", color: "#fff", display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
                    Creer mon espace
                    <ArrowRight size={15} />
                  </Link>
                  <Link href={`/${locale}/audit-flux`} style={{ minHeight: 48, padding: "0 18px", borderRadius: 14, background: "#fff", border: "1px solid #cbd5e1", color: "#0f172a", display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
                    <Share2 size={15} />
                    Nouveau diagnostic
                  </Link>
                  {!isReady ? (
                    <span style={{ minHeight: 48, padding: "0 18px", borderRadius: 14, background: "#fff", border: "1px solid #cbd5e1", color: "#475569", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700 }}>
                      <Link2 size={15} />
                      En attente de donnees reelles
                    </span>
                  ) : null}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
