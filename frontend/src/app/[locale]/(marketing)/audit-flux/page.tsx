"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useState } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, Database, Link2, PhoneCall, Store } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
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
  { id: 1, title: "Vos coordonnees", caption: "On identifie le bon interlocuteur." },
  { id: 2, title: "Votre source produit", caption: "On capte le CMS et la source reelle." },
  { id: 3, title: "Vos priorites", caption: "On prepare l’audit avant connexion." },
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
      <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{ minHeight: 52, borderRadius: 16, border: "1px solid #cbd5e1", padding: "0 16px", fontSize: 15, color: "#0f172a", background: "#fff" }}
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
  const stepOneValid = [form.firstName, form.lastName, form.jobTitle, form.company, form.email].every((value) => value.trim().length > 0);
  const stepTwoValid = form.sourceValue.trim().length > 0 && form.catalogSize > 0;
  const stepThreeValid = form.targetChannels.length > 0;
  const canSubmit = stepOneValid && stepTwoValid && stepThreeValid && !submitting;

  const nextStep = () => {
    if (step === 1 && !stepOneValid) {
      setError("Renseignez au minimum le prenom, le nom, la fonction, l'entreprise et l'email pour continuer.");
      return;
    }
    if (step === 2 && !stepTwoValid) {
      setError("Choisissez votre source et indiquez l URL ou le Merchant ID.");
      return;
    }
    setError("");
    setStep((current) => Math.min(3, current + 1));
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

    try {
      const isGmc = selectedSource.connectorType === "GMC";
      const audit = await createMarketingAudit({
        firstName: form.firstName.trim(),
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
      <main style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, rgba(14,165,233,0.08), transparent 28%), linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)" }}>
        <section style={{ padding: "124px 24px 48px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            <div style={{ maxWidth: 760, marginBottom: 28 }}>
              <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0f766e" }}>
                Audit technique gratuit
              </p>
              <h1 style={{ margin: "0 0 14px", fontSize: "clamp(36px, 5vw, 58px)", lineHeight: 1.02, letterSpacing: "-0.05em", color: "#0f172a" }}>
                Un audit de flux base sur vos vraies donnees, pas sur du declaratif.
              </h1>
              <p style={{ margin: 0, fontSize: 18, lineHeight: 1.75, color: "#475569" }}>
                Vous laissez vos coordonnees, vous indiquez la source catalogue, puis FeedPlug attend une vraie connexion Shopify, Google Merchant Center ou flux pour produire la note gratuite.
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
                "30 secondes pour lancer la demande",
                "Telephone optionnel au depart",
                "Rapport avec top 5 blocages et potentiel estimé",
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    border: "1px solid #dbeafe",
                    backgroundColor: "#f8fbff",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1d4ed8",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(0, 1.25fr) minmax(320px, 0.75fr)", alignItems: "start" }}>
              <form onSubmit={handleSubmit} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 32, padding: 28, boxShadow: "0 24px 60px rgba(15,23,42,0.08)" }}>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 28 }}>
                  {STEPS.map((item) => {
                    const active = item.id === step;
                    const done = item.id < step;
                    return (
                      <div key={item.id} style={{ borderRadius: 20, border: active ? "1px solid #0f766e" : "1px solid #e2e8f0", background: active ? "#f0fdfa" : "#fff", padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: done || active ? "#0f766e" : "#e2e8f0", color: done || active ? "#fff" : "#64748b", fontSize: 13, fontWeight: 700 }}>
                            {done ? "✓" : item.id}
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{item.title}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#64748b" }}>{item.caption}</p>
                      </div>
                    );
                  })}
                </div>

                {step === 1 ? (
                  <section>
                    <div style={{ marginBottom: 20 }}>
                      <h2 style={{ margin: "0 0 8px", fontSize: 24, color: "#0f172a" }}>Qui doit recevoir l’audit ?</h2>
                      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "#64748b" }}>
                        On collecte les coordonnees du bon contact avant toute connexion technique.
                      </p>
                    </div>
                    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                      <Field label="Prenom" value={form.firstName} onChange={(value) => setForm((current) => ({ ...current, firstName: value }))} />
                      <Field label="Nom" value={form.lastName} onChange={(value) => setForm((current) => ({ ...current, lastName: value }))} />
                      <Field label="Fonction" value={form.jobTitle} onChange={(value) => setForm((current) => ({ ...current, jobTitle: value }))} />
                      <Field label="Telephone (optionnel)" value={form.phone} type="tel" placeholder="+33 6 12 34 56 78" onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
                      <Field label="Entreprise" value={form.company} onChange={(value) => setForm((current) => ({ ...current, company: value }))} />
                      <Field label="Email" value={form.email} type="email" onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
                    </div>
                  </section>
                ) : null}

                {step === 2 ? (
                  <section>
                    <div style={{ marginBottom: 20 }}>
                      <h2 style={{ margin: "0 0 8px", fontSize: 24, color: "#0f172a" }}>Quelle est la vraie source du flux ?</h2>
                      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "#64748b" }}>
                        On capte le CMS ou la source catalogue pour brancher l’audit sur les vraies donnees ensuite.
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
                              border: selected ? "1px solid #0f766e" : "1px solid #e2e8f0",
                              background: selected ? "#f0fdfa" : "#fff",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>{option.label}</div>
                            <div style={{ fontSize: 13, lineHeight: 1.65, color: "#64748b" }}>{option.description}</div>
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
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Taille approximative du catalogue</span>
                        <select
                          value={String(form.catalogSize)}
                          onChange={(event) => setForm((current) => ({ ...current, catalogSize: Number(event.target.value) }))}
                          style={{ minHeight: 52, borderRadius: 16, border: "1px solid #cbd5e1", padding: "0 16px", fontSize: 15, color: "#0f172a", background: "#fff" }}
                        >
                          {CATALOG_SIZE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </section>
                ) : null}

                {step === 3 ? (
                  <section>
                    <div style={{ marginBottom: 20 }}>
                      <h2 style={{ margin: "0 0 8px", fontSize: 24, color: "#0f172a" }}>Que faut-il auditer en priorite ?</h2>
                      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "#64748b" }}>
                        Cette etape ne sert pas a calculer une note. Elle sert a preparer l’analyse technique reelle du flux une fois la source connectee.
                      </p>
                    </div>

                    <div style={{ marginBottom: 24 }}>
                      <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: "#334155" }}>Canaux a regarder en priorite</div>
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
                                border: selected ? "1px solid #0f766e" : "1px solid #cbd5e1",
                                background: selected ? "#ecfdf5" : "#fff",
                                color: selected ? "#0f766e" : "#334155",
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

                    <div style={{ borderRadius: 24, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 22 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0f766e", marginBottom: 8 }}>
                        Ce qui va se passer ensuite
                      </div>
                      <p style={{ margin: "0 0 10px", fontSize: 15, lineHeight: 1.75, color: "#334155" }}>
                        1. Votre demande d’audit est enregistree.
                      </p>
                      <p style={{ margin: "0 0 10px", fontSize: 15, lineHeight: 1.75, color: "#334155" }}>
                        2. Vous connectez Shopify ou Google Merchant Center, ou bien notre equipe reprend votre source Presta, CSV ou PIM.
                      </p>
                      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: "#334155" }}>
                        3. La note gratuite est ensuite calculee sur les vraies donnees du flux.
                      </p>
                    </div>
                  </section>
                ) : null}

                {error ? (
                  <div style={{ marginTop: 22, padding: "14px 16px", borderRadius: 16, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 14 }}>
                    {error}
                  </div>
                ) : null}

                <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {step > 1 ? (
                      <button type="button" onClick={previousStep} style={{ minHeight: 50, padding: "0 18px", borderRadius: 16, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <ChevronLeft size={16} />
                        Retour
                      </button>
                    ) : null}

                    {step < 3 ? (
                      <button type="button" onClick={nextStep} style={{ minHeight: 50, padding: "0 20px", borderRadius: 16, border: "none", background: "#0f172a", color: "#fff", fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                        Continuer
                        <ArrowRight size={16} />
                      </button>
                    ) : (
                      <button type="submit" disabled={!canSubmit} style={{ minHeight: 50, padding: "0 20px", borderRadius: 16, border: "none", background: "#0f172a", color: "#fff", fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 10, cursor: canSubmit ? "pointer" : "not-allowed", opacity: canSubmit ? 1 : 0.6 }}>
                        {submitting ? "Creation..." : "Creer ma demande d audit"}
                        <ArrowRight size={16} />
                      </button>
                    )}
                  </div>

                  <Link href={`/${locale}`} style={{ color: "#64748b", textDecoration: "none", fontSize: 14 }}>
                    Retour au site
                  </Link>
                </div>
              </form>

              <aside style={{ display: "grid", gap: 18 }}>
                <div style={{ background: "#0f172a", color: "#fff", borderRadius: 28, padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <CheckCircle2 size={18} />
                    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Promesse gratuite</span>
                  </div>
                  <h3 style={{ margin: "0 0 10px", fontSize: 24, lineHeight: 1.15 }}>Un audit technique gratuit, puis le scoring performance en offre payante.</h3>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: "rgba(255,255,255,0.74)" }}>
                    Le gratuit porte sur la qualite technique du flux et sa diffusabilite. Le scoring de performance reste reserve a l’offre payante.
                  </p>
                </div>

                {[
                  {
                    icon: <PhoneCall size={18} />,
                    title: "Lead qualifie",
                    text: "Nom, prenom, fonction, entreprise et email sont collectes en amont. Le telephone peut venir ensuite.",
                  },
                  {
                    icon: <Store size={18} />,
                    title: "Source exploitable",
                    text: "Le CMS et la source du catalogue sont identifies pour brancher la vraie analyse.",
                  },
                  {
                    icon: <Link2 size={18} />,
                    title: "Connexion reelle",
                    text: "L’audit gratuit ne sort pas de score tant que Shopify, GMC ou le flux n’est pas connecte.",
                  },
                  {
                    icon: <Database size={18} />,
                    title: "Donnees commerciales",
                    text: "Les donnees collectees servent a qualifier le lead et a preparer la suite commerciale.",
                  },
                ].map((item) => (
                  <div key={item.title} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 22 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "#ecfeff", color: "#0f766e", marginBottom: 14 }}>
                      {item.icon}
                    </div>
                    <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "#0f172a" }}>{item.title}</h3>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#475569" }}>{item.text}</p>
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
