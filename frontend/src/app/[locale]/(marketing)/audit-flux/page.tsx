"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useState } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, Gauge, Link2, ShieldCheck, Sparkles } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import TurnstileWidget from "@/components/auth/turnstile-widget";
import {
  createMarketingAudit,
  type MarketingAuditChannel,
  type MarketingAuditConnector,
} from "@/lib/services/marketing-audit.service";

type SourceOption = {
  id: string;
  label: string;
  connectorType: MarketingAuditConnector;
  description: string;
  inputLabel: string;
  inputPlaceholder: string;
};

const CHANNEL_OPTIONS: Array<{ value: MarketingAuditChannel; label: string }> = [
  { value: "google_shopping", label: "Google Shopping" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "amazon", label: "Amazon" },
  { value: "marketplaces", label: "Marketplaces" },
  { value: "chatgpt", label: "ChatGPT / IA" },
];

const SOURCE_OPTIONS: SourceOption[] = [
  {
    id: "shopify",
    label: "Shopify",
    connectorType: "SHOPIFY",
    description: "Connexion OAuth immediate pour auditer la vraie structure catalogue.",
    inputLabel: "URL de la boutique",
    inputPlaceholder: "https://ma-boutique.com",
  },
  {
    id: "prestashop",
    label: "PrestaShop",
    connectorType: "PRESTASHOP",
    description: "On identifie la boutique puis on reprend la connexion technique dans l’audit.",
    inputLabel: "URL de la boutique",
    inputPlaceholder: "https://ma-boutique.com",
  },
  {
    id: "woocommerce",
    label: "WooCommerce",
    connectorType: "OTHER",
    description: "Pour un catalogue WordPress / WooCommerce.",
    inputLabel: "URL de la boutique",
    inputPlaceholder: "https://ma-boutique.com",
  },
  {
    id: "magento",
    label: "Magento / Adobe Commerce",
    connectorType: "OTHER",
    description: "Pour une source catalogue Adobe Commerce ou Magento.",
    inputLabel: "URL de la boutique",
    inputPlaceholder: "https://ma-boutique.com",
  },
  {
    id: "gmc",
    label: "Google Merchant Center",
    connectorType: "GMC",
    description: "Connexion OAuth pour exploiter les vraies donnees Merchant Center.",
    inputLabel: "Merchant ID",
    inputPlaceholder: "123456789",
  },
  {
    id: "csv",
    label: "Fichier CSV / XML",
    connectorType: "CSV",
    description: "Pour un flux exporte ou un fichier genere par votre stack.",
    inputLabel: "URL du flux",
    inputPlaceholder: "https://ma-boutique.com/feed.xml",
  },
  {
    id: "custom",
    label: "PIM / ERP / custom",
    connectorType: "OTHER",
    description: "Pour un PIM, ERP ou connecteur interne.",
    inputLabel: "URL boutique ou reference source",
    inputPlaceholder: "https://ma-boutique.com ou nom du systeme",
  },
];

const CATALOG_SIZE_OPTIONS = [
  { value: 150, label: "Moins de 200 produits" },
  { value: 750, label: "200 a 1 000 produits" },
  { value: 3500, label: "1 000 a 5 000 produits" },
  { value: 12000, label: "Plus de 5 000 produits" },
];

const STEPS = [
  { id: 1, title: "Votre flux", caption: "Source catalogue et email pour recevoir le diagnostic." },
  { id: 2, title: "Vos priorites", caption: "Canaux a regarder et contact (optionnel)." },
];

const initialForm = {
  firstName: "",
  lastName: "",
  jobTitle: "",
  phone: "",
  company: "",
  email: "",
  sourceId: "shopify",
  sourceValue: "",
  catalogSize: 750,
  targetChannels: ["google_shopping"] as MarketingAuditChannel[],
};

function Field({
  label,
  value,
  type = "text",
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{ minHeight: 52, borderRadius: 16, border: "1px solid var(--line-strong)", padding: "0 16px", fontSize: 15, color: "var(--ink)", background: "#fff" }}
      />
    </label>
  );
}

export default function AuditFluxPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // companyWebsite (honeypot) retiré — il bloquait les vrais prospects à cause
  // des password managers. Cloudflare Turnstile + risk assessment suffisent.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [formStartedAt] = useState(() => Date.now());
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  const captchaEnabled = turnstileSiteKey.length > 0;
  const [form, setForm] = useState(() => ({
    ...initialForm,
    firstName: (searchParams.get("firstName") || "").trim(),
    lastName: (searchParams.get("lastName") || "").trim(),
    jobTitle: (searchParams.get("jobTitle") || "").trim(),
    phone: (searchParams.get("phone") || "").trim(),
    company: (searchParams.get("company") || "").trim(),
    email: (searchParams.get("email") || "").trim(),
  }));

  const selectedSource = SOURCE_OPTIONS.find((option) => option.id === form.sourceId) || SOURCE_OPTIONS[0];
  // Friction minimale : on ne demande que la source du flux + un email pour
  // envoyer le diagnostic. Les coordonnees (entreprise, fonction, nom) sont
  // optionnelles et collectees en aval, jamais comme barriere au resultat.
  const emailValid = /.+@.+\..+/.test(form.email.trim());
  const stepOneValid = form.sourceValue.trim().length > 0 && form.catalogSize > 0 && emailValid;
  const stepTwoValid = form.targetChannels.length > 0;
  const canSubmit = stepOneValid && stepTwoValid && (!captchaEnabled || !!captchaToken) && !submitting;

  const nextStep = () => {
    if (step === 1 && !stepOneValid) {
      setError("Indiquez votre source de flux (URL ou Merchant ID) et un email valide pour recevoir le diagnostic.");
      return;
    }
    setError("");
    setStep((current) => Math.min(2, current + 1));
  };

  const previousStep = () => {
    setError("");
    setStep((current) => Math.max(1, current - 1));
  };

  const toggleChannel = (channel: MarketingAuditChannel) => {
    setForm((current) => {
      const selected = current.targetChannels.includes(channel);
      return {
        ...current,
        targetChannels: selected
          ? current.targetChannels.filter((item) => item !== channel)
          : [...current.targetChannels, channel],
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");

    if (captchaEnabled && !captchaToken) {
      setError("Merci de valider la verification anti-spam avant d'envoyer votre demande.");
      setSubmitting(false);
      return;
    }

    try {
      const isGmc = selectedSource.connectorType === "GMC";
      // Fallback de courtoisie : si le prospect n'a pas renseigne son nom
      // (champ optionnel), on derive un libelle depuis l'email pour garder
      // la creation d'audit fonctionnelle cote service.
      const emailLocalPart = form.email.trim().split("@")[0] || "Prospect";
      const audit = await createMarketingAudit({
        firstName: form.firstName.trim() || emailLocalPart,
        lastName: form.lastName.trim(),
        jobTitle: form.jobTitle.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        locale,
        connectorType: selectedSource.connectorType,
        cmsUsed: selectedSource.label,
        shopUrl: isGmc ? undefined : form.sourceValue.trim(),
        merchantId: isGmc ? form.sourceValue.trim() : undefined,
        catalogSize: form.catalogSize,
        targetChannels: form.targetChannels,
        goal: "audit_flux",
        captchaToken: captchaToken || undefined,
        formStartedAt,
      });
      router.push(`/${locale}/audit-flux/${audit.shareToken}?new=1`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Impossible de creer l audit.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  };

  return (
    <>
      <MarketingHeader />
      <main style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, rgba(14,165,233,0.08), transparent 28%), linear-gradient(180deg, var(--paper-2) 0%, #ffffff 100%)" }}>
        <section style={{ padding: "124px 24px 48px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            <div style={{ maxWidth: 760, marginBottom: 28 }}>
              <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#2A6FE8" }}>
                Audit de flux gratuit
              </p>
              <h1 style={{ margin: "0 0 14px", fontSize: "clamp(36px, 5vw, 58px)", lineHeight: 1.02, letterSpacing: "-0.05em", color: "var(--ink)" }}>
                Recevez le diagnostic de votre flux produit, gratuitement.
              </h1>
              <p style={{ margin: 0, fontSize: 18, lineHeight: 1.75, color: "var(--ink-2)" }}>
                Indiquez votre source catalogue (Shopify, Google Merchant Center, flux CSV…) et l’email où recevoir votre diagnostic. FeedPlug analyse la qualité technique de votre flux et les blocages qui empêchent vos produits d’être diffusés.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 22,
              }}
            >
              {[
                "Sans carte bancaire",
                "Sans engagement",
                "5 min",
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    border: "1px solid var(--accent-bg)",
                    backgroundColor: "#f8fbff",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--accent-2)",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(0, 1.25fr) minmax(320px, 0.75fr)", alignItems: "start" }}>
              <form onSubmit={handleSubmit} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 32, padding: 28, boxShadow: "0 24px 60px rgba(15,23,42,0.08)" }}>
                {/*
                  Honeypot historique retiré : les gestionnaires de mots de passe
                  (Dashlane, 1Password) remplissaient le champ caché même hors-écran
                  et bloquaient les vraies submissions. Cloudflare Turnstile (étape
                  1) + rate limiter backend + risk assessment couvrent déjà les bots.
                */}
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginBottom: 28 }}>
                  {STEPS.map((item) => {
                    const active = item.id === step;
                    const done = item.id < step;
                    return (
                      <div key={item.id} style={{ borderRadius: 20, border: active ? "1px solid #2A6FE8" : "1px solid var(--line)", background: active ? "#E8EFFB" : "#fff", padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: done || active ? "#2A6FE8" : "var(--line)", color: done || active ? "#fff" : "var(--ink-3)", fontSize: 13, fontWeight: 700 }}>
                            {done ? "✓" : item.id}
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{item.title}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--ink-3)" }}>{item.caption}</p>
                      </div>
                    );
                  })}
                </div>

                {step === 1 ? (
                  <section>
                    <div style={{ marginBottom: 20 }}>
                      <h2 style={{ margin: "0 0 8px", fontSize: 24, color: "var(--ink)" }}>Quelle est la source de votre flux ?</h2>
                      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "var(--ink-3)" }}>
                        On capte la source réelle du catalogue pour brancher l’audit sur vos vraies données.
                      </p>
                    </div>
                    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 20 }}>
                      {SOURCE_OPTIONS.map((option) => {
                        const selected = option.id === form.sourceId;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, sourceId: option.id, sourceValue: "" }))}
                            style={{
                              textAlign: "left",
                              padding: 18,
                              borderRadius: 22,
                              border: selected ? "1px solid #2A6FE8" : "1px solid var(--line)",
                              background: selected ? "#E8EFFB" : "#fff",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{option.label}</div>
                            <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--ink-3)" }}>{option.description}</div>
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                      <Field
                        label={selectedSource.inputLabel}
                        value={form.sourceValue}
                        placeholder={selectedSource.inputPlaceholder}
                        onChange={(value) => setForm((current) => ({ ...current, sourceValue: value }))}
                      />
                      <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>Taille approximative du catalogue</span>
                        <select
                          value={String(form.catalogSize)}
                          onChange={(event) => setForm((current) => ({ ...current, catalogSize: Number(event.target.value) }))}
                          style={{ minHeight: 52, borderRadius: 16, border: "1px solid var(--line-strong)", padding: "0 16px", fontSize: 15, color: "var(--ink)", background: "#fff" }}
                        >
                          {CATALOG_SIZE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <Field
                        label="Email (pour recevoir le diagnostic)"
                        value={form.email}
                        type="email"
                        placeholder="vous@votre-boutique.com"
                        onChange={(value) => setForm((current) => ({ ...current, email: value }))}
                      />
                    </div>

                    {captchaEnabled ? (
                      <div
                        style={{
                          marginTop: 22,
                          borderRadius: 20,
                          border: "1px solid var(--line)",
                          background: "var(--paper-2)",
                          padding: 18,
                        }}
                      >
                        <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-2)" }}>
                          Verification anti-spam
                        </div>
                        <TurnstileWidget siteKey={turnstileSiteKey} onTokenChange={setCaptchaToken} />
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {step === 2 ? (
                  <section>
                    <div style={{ marginBottom: 20 }}>
                      <h2 style={{ margin: "0 0 8px", fontSize: 24, color: "var(--ink)" }}>Que faut-il auditer en priorite ?</h2>
                      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "var(--ink-3)" }}>
                        On prépare l’analyse technique du flux sur les canaux qui comptent pour vous.
                      </p>
                    </div>

                    <div style={{ marginBottom: 24 }}>
                      <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>Canaux a regarder en priorite</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {CHANNEL_OPTIONS.map((channel) => {
                          const selected = form.targetChannels.includes(channel.value);
                          return (
                            <button
                              key={channel.value}
                              type="button"
                              onClick={() => toggleChannel(channel.value)}
                              style={{
                                minHeight: 44,
                                padding: "0 16px",
                                borderRadius: 999,
                                border: selected ? "1px solid #2A6FE8" : "1px solid var(--line-strong)",
                                background: selected ? "var(--success-bg)" : "#fff",
                                color: selected ? "#2A6FE8" : "var(--ink-2)",
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {channel.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", marginBottom: 4 }}>Vos coordonnees (optionnel)</div>
                      <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6, color: "var(--ink-3)" }}>
                        Pour personnaliser le diagnostic et reprendre contact si vous le souhaitez. Aucun de ces champs n’est obligatoire.
                      </p>
                      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                        <Field label="Prenom (optionnel)" value={form.firstName} onChange={(value) => setForm((current) => ({ ...current, firstName: value }))} />
                        <Field label="Nom (optionnel)" value={form.lastName} onChange={(value) => setForm((current) => ({ ...current, lastName: value }))} />
                        <Field label="Entreprise (optionnel)" value={form.company} onChange={(value) => setForm((current) => ({ ...current, company: value }))} />
                        <Field label="Fonction (optionnel)" value={form.jobTitle} onChange={(value) => setForm((current) => ({ ...current, jobTitle: value }))} />
                        <Field label="Telephone (optionnel)" value={form.phone} type="tel" placeholder="+33 6 12 34 56 78" onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
                      </div>
                    </div>
                  </section>
                ) : null}

                {error ? (
                  <div style={{ marginTop: 22, padding: "14px 16px", borderRadius: 16, background: "var(--danger-bg)", border: "1px solid #fecaca", color: "var(--danger)", fontSize: 14 }}>
                    {error}
                  </div>
                ) : null}

                <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {step > 1 ? (
                      <button type="button" onClick={previousStep} style={{ minHeight: 50, padding: "0 18px", borderRadius: 16, border: "1px solid var(--line-strong)", background: "#fff", color: "var(--ink)", fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <ChevronLeft size={16} />
                        Retour
                      </button>
                    ) : null}

                    {step < 2 ? (
                      <button type="button" onClick={nextStep} style={{ minHeight: 50, padding: "0 20px", borderRadius: 16, border: "none", background: "var(--ink)", color: "#fff", fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                        Continuer
                        <ArrowRight size={16} />
                      </button>
                    ) : (
                      <button type="submit" disabled={!canSubmit} style={{ minHeight: 50, padding: "0 20px", borderRadius: 16, border: "none", background: "var(--ink)", color: "#fff", fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 10, cursor: canSubmit ? "pointer" : "not-allowed", opacity: canSubmit ? 1 : 0.6 }}>
                        {submitting ? "Creation..." : "Recevoir mon diagnostic"}
                        <ArrowRight size={16} />
                      </button>
                    )}
                  </div>

                  <Link href={`/${locale}`} style={{ color: "var(--ink-3)", textDecoration: "none", fontSize: 14 }}>
                    Retour au site
                  </Link>
                </div>

                {/* Réassurance sous le CTA principal */}
                <p style={{ margin: "16px 0 0", fontSize: 13, fontWeight: 600, color: "var(--ink-3)" }}>
                  Sans carte bancaire · Sans engagement · 5 min
                </p>
              </form>

              <aside style={{ display: "grid", gap: 18 }}>
                <div style={{ background: "var(--ink)", color: "#fff", borderRadius: 28, padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <CheckCircle2 size={18} />
                    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Diagnostic gratuit</span>
                  </div>
                  <h3 style={{ margin: "0 0 10px", fontSize: 24, lineHeight: 1.15, color: "#fff" }}>Recevez votre diagnostic de flux, sans engagement.</h3>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: "rgba(255,255,255,0.74)" }}>
                    On analyse la qualité technique de votre flux et sa diffusabilité, puis on vous remonte les blocages prioritaires à corriger.
                  </p>
                </div>

                {[
                  {
                    icon: <Gauge size={18} />,
                    title: "Un score clair",
                    text: "Une note sur 100 et le détail par dimension : couverture, qualité produit, conformité canal.",
                  },
                  {
                    icon: <Sparkles size={18} />,
                    title: "Vos blocages prioritaires",
                    text: "Le top des problèmes qui empêchent vos produits d’être diffusés, classés par impact.",
                  },
                  {
                    icon: <Link2 size={18} />,
                    title: "Sur vos vraies donnees",
                    text: "Connectez Shopify, Google Merchant Center ou un flux : l’audit s’appuie sur votre catalogue réel.",
                  },
                  {
                    icon: <ShieldCheck size={18} />,
                    title: "Sans engagement",
                    text: "Pas de carte bancaire, pas d’abonnement. Vous repartez avec votre diagnostic.",
                  },
                ].map((item) => (
                  <div key={item.title} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 24, padding: 22 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "#E8EFFB", color: "#2A6FE8", marginBottom: 14 }}>
                      {item.icon}
                    </div>
                    <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "var(--ink)" }}>{item.title}</h3>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "var(--ink-2)" }}>{item.text}</p>
                  </div>
                ))}
              </aside>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
