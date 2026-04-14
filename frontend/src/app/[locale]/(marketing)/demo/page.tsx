"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileSearch,
  Mail,
  PlayCircle,
} from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import { apiClient } from "@/lib/api";
import { trackEvent } from "@/components/analytics/GoogleAnalytics";

type DemoFormState = {
  firstName: string;
  company: string;
  email: string;
  jobTitle: string;
};

type LeadSource =
  | "landing_page"
  | "demo_page"
  | "pricing_contact"
  | "use_case_demo"
  | "audit_request";

const initialForm: DemoFormState = {
  firstName: "",
  company: "",
  email: "",
  jobTitle: "",
};

function getJourneyContent(locale: string, leadSource: LeadSource) {
  if (locale === "en") {
    if (leadSource === "pricing_contact") {
      return {
        eyebrow: "Quote context",
        title: "You likely need help sizing a plan beyond the self-serve package.",
        points: [
          "We can scope catalog size, channels, and sync cadence.",
          "Reply within 24 business hours with the right next step.",
          "You can still choose trial, audit, or custom quote afterward.",
        ],
      };
    }

    if (leadSource === "use_case_demo") {
      return {
        eyebrow: "Use-case context",
        title: "We can focus the conversation on the channel you care about most.",
        points: [
          "Google Shopping, Amazon, marketplaces, or AI assistants.",
          "Examples of clean exports and the errors to avoid.",
          "Recommended setup based on your source catalog.",
        ],
      };
    }

    if (leadSource === "audit_request") {
      return {
        eyebrow: "Audit context",
        title: "If you are unsure, we can start with the lightest qualification path.",
        points: [
          "A technical audit can come before any live conversation.",
          "Phone is not required to get initial guidance.",
          "The goal is to surface the top blockers and fastest wins.",
        ],
      };
    }

    return {
      eyebrow: "Right entry point",
      title: "We help you choose the fastest path based on your catalog setup.",
      points: [
        "Catalog size, priority channels, and operational constraints.",
        "Need for self-serve trial versus guided onboarding.",
        "Quick orientation toward demo, audit, or direct trial.",
      ],
    };
  }

  if (locale === "es") {
    if (leadSource === "pricing_contact") {
      return {
        eyebrow: "Contexto de presupuesto",
        title: "Probablemente necesitas ayuda para dimensionar un plan mas alla del self-serve.",
        points: [
          "Podemos valorar volumen de catalogo, canales y ritmo de sincronizacion.",
          "Respuesta en 24 horas laborables con la siguiente etapa adecuada.",
          "Despues podras elegir entre prueba, auditoria o presupuesto a medida.",
        ],
      };
    }

    if (leadSource === "use_case_demo") {
      return {
        eyebrow: "Contexto de caso de uso",
        title: "Podemos centrar la conversacion en el canal que mas te importa.",
        points: [
          "Google Shopping, Amazon, marketplaces o asistentes IA.",
          "Ejemplos de exports limpios y errores a evitar.",
          "Setup recomendado segun tu catalogo de origen.",
        ],
      };
    }

    if (leadSource === "audit_request") {
      return {
        eyebrow: "Contexto de auditoria",
        title: "Si dudas, podemos empezar por el recorrido de cualificacion mas ligero.",
        points: [
          "La auditoria tecnica puede llegar antes de cualquier llamada.",
          "El telefono no es obligatorio para una primera orientacion.",
          "El objetivo es detectar bloqueos y ganancias rapidas.",
        ],
      };
    }

    return {
      eyebrow: "Punto de entrada adecuado",
      title: "Te ayudamos a elegir la via mas rapida segun tu contexto catalogo.",
      points: [
        "Volumen de catalogo, canales prioritarios y limites operativos.",
        "Necesidad de prueba self-serve o onboarding guiado.",
        "Orientacion rapida hacia demo, auditoria o prueba directa.",
      ],
    };
  }

  if (leadSource === "pricing_contact") {
    return {
      eyebrow: "Contexte devis",
      title: "Vous avez sans doute besoin d'un cadrage au-delà du package self-serve.",
      points: [
        "On peut dimensionner le volume catalogue, les canaux et la fréquence de synchro.",
        "Réponse sous 24h ouvrées avec la bonne prochaine étape.",
        "Vous gardez ensuite le choix entre essai, audit ou devis sur mesure.",
      ],
    };
  }

  if (leadSource === "use_case_demo") {
    return {
      eyebrow: "Contexte cas d'usage",
      title: "On peut centrer l'échange sur le canal qui compte le plus pour vous.",
      points: [
        "Google Shopping, Amazon, marketplaces ou assistants IA.",
        "Exemples d'exports propres et erreurs à éviter.",
        "Recommandation de setup selon votre source catalogue.",
      ],
    };
  }

  if (leadSource === "audit_request") {
    return {
      eyebrow: "Contexte audit",
      title: "Si vous hésitez encore, on peut démarrer par le parcours le plus léger.",
      points: [
        "L'audit technique peut précéder tout échange commercial.",
        "Le téléphone n'est pas indispensable pour une première orientation.",
        "L'objectif est de faire ressortir les blocages et gains rapides.",
      ],
    };
  }

  return {
    eyebrow: "Bon point d'entrée",
    title: "On vous aide à choisir la voie la plus rapide selon votre contexte catalogue.",
    points: [
      "Volume catalogue, canaux prioritaires et contraintes opérationnelles.",
      "Besoin d'autonomie immédiate ou d'un cadrage guidé.",
      "Orientation rapide vers essai, audit ou démo selon votre maturité.",
    ],
  };
}

function getContent(locale: string) {
  if (locale === "en") {
    return {
      eyebrow: "Demo / Contact",
      title: "See how FeedPlug would fit your catalog operations.",
      description:
        "Tell us where your catalog is slowing you down. We'll point you to the right next step: a product demo, a free audit, or a self-serve trial.",
      highlights: [
        "Reply within 24 business hours",
        "Demo tailored to your channels and catalog size",
        "Fallback contact: hello@feedplug.com",
      ],
      primaryCardTitle: "Start a free trial",
      primaryCardDescription:
        "Already ready to test the product? Open your account and go straight into onboarding.",
      primaryCardCta: "Start my free trial",
      auditCardTitle: "Request a free audit",
      auditCardDescription:
        "If you need a diagnostic first, start with a feed audit and get a score plus top issues to fix.",
      auditCardCta: "Launch the audit",
      formTitle: "Prefer a tailored demo?",
      formDescription:
        "Leave your details and the team will come back with the right format for your use case.",
      firstName: "First name",
      company: "Company",
      email: "Work email",
      jobTitle: "Role (optional)",
      submit: "Request a demo",
      submitting: "Sending...",
      successTitle: "Your request has been received.",
      successDescription:
        "The team will get back to you shortly. In the meantime, you can also start a trial or launch a free audit.",
      reassurance: "No hard sell. We will orient you toward the fastest path for your context.",
    };
  }

  if (locale === "es") {
    return {
      eyebrow: "Demo / Contacto",
      title: "Ve como FeedPlug encaja en tus operaciones de catalogo.",
      description:
        "Cuentanos donde tu catalogo os frena hoy. Te orientaremos hacia la mejor siguiente etapa: demo, auditoria gratuita o prueba self-serve.",
      highlights: [
        "Respuesta en 24 horas laborables",
        "Demo adaptada a tus canales y a tu volumen de catalogo",
        "Contacto alternativo: hello@feedplug.com",
      ],
      primaryCardTitle: "Empezar la prueba gratuita",
      primaryCardDescription:
        "Si ya quieres probar el producto, abre tu cuenta y entra directamente en el onboarding.",
      primaryCardCta: "Comenzar mi prueba gratuita",
      auditCardTitle: "Solicitar una auditoria gratuita",
      auditCardDescription:
        "Si primero necesitas un diagnostico, empieza con una auditoria de feed y recibe un score con los principales bloqueos.",
      auditCardCta: "Lanzar la auditoria",
      formTitle: "Prefieres una demo adaptada?",
      formDescription:
        "Dejanos tus datos y el equipo volvera contigo con el formato adecuado para tu caso de uso.",
      firstName: "Nombre",
      company: "Empresa",
      email: "Email profesional",
      jobTitle: "Cargo (opcional)",
      submit: "Solicitar una demo",
      submitting: "Enviando...",
      successTitle: "Tu solicitud ha sido registrada.",
      successDescription:
        "El equipo volvera contigo pronto. Mientras tanto, tambien puedes iniciar una prueba o una auditoria gratuita.",
      reassurance: "Sin presion comercial. Te orientaremos hacia el recorrido mas rapido para tu contexto.",
    };
  }

  return {
    eyebrow: "Demo / Contact",
    title: "Voyez comment FeedPlug s'intègre dans vos opérations catalogue.",
    description:
      "Expliquez-nous où votre catalogue vous ralentit aujourd'hui. On vous oriente vers la bonne suite: démo produit, audit gratuit ou essai self-serve.",
    highlights: [
      "Réponse sous 24h ouvrées",
      "Démo adaptée à vos canaux et à votre volume catalogue",
      "Contact de secours: hello@feedplug.com",
    ],
    primaryCardTitle: "Démarrer l'essai gratuit",
    primaryCardDescription:
      "Si vous êtes déjà prêt à tester le produit, ouvrez votre compte et passez directement à l'onboarding.",
    primaryCardCta: "Démarrer mon essai gratuit",
    auditCardTitle: "Demander un audit gratuit",
    auditCardDescription:
      "Si vous avez d'abord besoin d'un diagnostic, lancez un audit de flux et récupérez un score avec les principaux blocages.",
    auditCardCta: "Lancer l'audit",
    formTitle: "Vous préférez une démo adaptée ?",
    formDescription:
      "Laissez vos coordonnées et l'équipe reviendra vers vous avec le bon format selon votre cas d'usage.",
    firstName: "Prénom",
    company: "Entreprise",
    email: "Email professionnel",
    jobTitle: "Fonction (optionnel)",
    submit: "Demander une démo",
    submitting: "Envoi en cours...",
    successTitle: "Votre demande a bien été prise en compte.",
    successDescription:
      "L'équipe reviendra vers vous très vite. En attendant, vous pouvez aussi démarrer un essai ou lancer un audit gratuit.",
    reassurance:
      "Pas de tunnel commercial opaque. On vous oriente vers le parcours le plus rapide pour votre contexte.",
  };
}

function Field({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (nextValue: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          minHeight: 52,
          borderRadius: 14,
          border: "1px solid #cbd5e1",
          padding: "0 16px",
          fontSize: 15,
          color: "#0f172a",
          backgroundColor: "#ffffff",
        }}
      />
    </label>
  );
}

export default function DemoPage() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const content = getContent(locale);
  const localeBase = `/${locale}`;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.feedplug.com").replace(/\/$/, "");
  const [form, setForm] = useState<DemoFormState>({
    ...initialForm,
    email: (searchParams.get("email") || "").trim(),
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const leadSource = useMemo<LeadSource>(() => {
    const source = (searchParams.get("source") || "").trim().toLowerCase();
    if (source === "landing_page") return "landing_page";
    if (source === "pricing_contact") return "pricing_contact";
    if (source === "use_case_demo") return "use_case_demo";
    if (source === "audit_request") return "audit_request";
    return "demo_page";
  }, [searchParams]);
  const journey = useMemo(() => getJourneyContent(locale, leadSource), [locale, leadSource]);
  const registerHref = useMemo(() => {
    const params = new URLSearchParams({ source: leadSource });
    const trimmedEmail = form.email.trim();
    if (trimmedEmail) {
      params.set("email", trimmedEmail);
    }
    return `${appUrl}/register?${params.toString()}`;
  }, [appUrl, form.email, leadSource]);
  const auditHref = useMemo(() => {
    const params = new URLSearchParams({ source: leadSource });
    const trimmedEmail = form.email.trim();
    if (trimmedEmail) {
      params.set("email", trimmedEmail);
    }
    return `${localeBase}/audit-flux?${params.toString()}`;
  }, [form.email, leadSource, localeBase]);

  const canSubmit =
    form.firstName.trim().length > 0 &&
    form.company.trim().length > 0 &&
    form.email.trim().length > 0 &&
    !submitting;

  useEffect(() => {
    trackEvent("view_demo_page", { source: leadSource });
  }, [leadSource]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");

    try {
      await apiClient.post("/marketing/early-access", {
        firstName: form.firstName.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        jobTitle: form.jobTitle.trim(),
        locale,
        source: leadSource,
      });

      trackEvent("generate_lead", {
        currency: "EUR",
        value: 0,
        source: leadSource,
      });
      setSubmitted(true);
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : locale === "en"
            ? "Unable to send your request."
            : locale === "es"
              ? "No se pudo enviar tu solicitud."
              : "Impossible d'envoyer votre demande.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #ffffff 34%, #f8fafc 100%)",
        color: "#111827",
      }}
    >
      <MarketingHeader />

      <section
        style={{
          padding: "132px 24px 80px",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.05fr) minmax(340px, 0.95fr)",
              gap: 28,
              alignItems: "start",
            }}
          >
            <div
              style={{
                padding: 32,
                borderRadius: 28,
                border: "1px solid #e5e7eb",
                backgroundColor: "#ffffff",
                boxShadow: "0 22px 64px rgba(15,23,42,0.06)",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#f8fafc",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#64748b",
                  marginBottom: 20,
                }}
              >
                {content.eyebrow}
              </div>
              <h1
                style={{
                  fontSize: "clamp(36px, 5vw, 56px)",
                  lineHeight: 1.04,
                  letterSpacing: "-0.04em",
                  fontWeight: 620,
                  margin: "0 0 18px",
                  maxWidth: 780,
                }}
              >
                {content.title}
              </h1>
              <p
                style={{
                  margin: "0 0 24px",
                  fontSize: 18,
                  lineHeight: 1.7,
                  color: "#475569",
                  maxWidth: 720,
                }}
              >
                {content.description}
              </p>

              <div
                style={{
                  marginBottom: 24,
                  padding: 18,
                  borderRadius: 22,
                  border: "1px solid #e2e8f0",
                  background:
                    "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(255,255,255,1) 100%)",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 11px",
                    borderRadius: 999,
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#64748b",
                    marginBottom: 12,
                  }}
                >
                  {journey.eyebrow}
                </div>
                <p
                  style={{
                    margin: "0 0 14px",
                    fontSize: 17,
                    lineHeight: 1.6,
                    color: "#0f172a",
                  }}
                >
                  {journey.title}
                </p>
                <div style={{ display: "grid", gap: 10 }}>
                  {journey.points.map((point) => (
                    <div
                      key={point}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: "#475569",
                      }}
                    >
                      <CheckCircle2
                        style={{ width: 16, height: 16, color: "#059669", flexShrink: 0, marginTop: 2 }}
                      />
                      {point}
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                  marginBottom: 22,
                }}
              >
                <div
                  style={{
                    padding: 20,
                    borderRadius: 20,
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 14,
                    }}
                  >
                    <PlayCircle style={{ width: 20, height: 20 }} />
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
                    {content.primaryCardTitle}
                  </h2>
                  <p style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.65, color: "#64748b" }}>
                    {content.primaryCardDescription}
                  </p>
                  <a
                    href={registerHref}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#111827",
                      textDecoration: "none",
                    }}
                  >
                    {content.primaryCardCta}
                    <ArrowRight style={{ width: 16, height: 16 }} />
                  </a>
                </div>

                <div
                  style={{
                    padding: 20,
                    borderRadius: 20,
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 14,
                    }}
                  >
                    <FileSearch style={{ width: 20, height: 20 }} />
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
                    {content.auditCardTitle}
                  </h2>
                  <p style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.65, color: "#64748b" }}>
                    {content.auditCardDescription}
                  </p>
                  <Link
                    href={auditHref}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#111827",
                      textDecoration: "none",
                    }}
                  >
                    {content.auditCardCta}
                    <ArrowRight style={{ width: 16, height: 16 }} />
                  </Link>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {content.highlights.map((highlight) => (
                  <div
                    key={highlight}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 14,
                      color: "#475569",
                    }}
                  >
                    <CheckCircle2 style={{ width: 16, height: 16, color: "#059669", flexShrink: 0 }} />
                    {highlight}
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                padding: 28,
                borderRadius: 28,
                border: "1px solid #e5e7eb",
                backgroundColor: "#ffffff",
                boxShadow: "0 22px 64px rgba(15,23,42,0.05)",
              }}
            >
              {!submitted ? (
                <>
                  <h2 style={{ fontSize: 24, fontWeight: 620, margin: "0 0 10px" }}>
                    {content.formTitle}
                  </h2>
                  <p style={{ margin: "0 0 20px", fontSize: 15, lineHeight: 1.7, color: "#64748b" }}>
                    {content.formDescription}
                  </p>

                  <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
                    <Field
                      label={content.firstName}
                      value={form.firstName}
                      onChange={(firstName) => setForm((current) => ({ ...current, firstName }))}
                    />
                    <Field
                      label={content.company}
                      value={form.company}
                      onChange={(company) => setForm((current) => ({ ...current, company }))}
                    />
                    <Field
                      label={content.email}
                      type="email"
                      value={form.email}
                      onChange={(email) => setForm((current) => ({ ...current, email }))}
                    />
                    <Field
                      label={content.jobTitle}
                      value={form.jobTitle}
                      onChange={(jobTitle) => setForm((current) => ({ ...current, jobTitle }))}
                    />

                    {error ? (
                      <div
                        style={{
                          borderRadius: 14,
                          backgroundColor: "#fef2f2",
                          border: "1px solid #fecaca",
                          padding: "12px 14px",
                          fontSize: 14,
                          color: "#b91c1c",
                        }}
                      >
                        {error}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={!canSubmit}
                      style={{
                        minHeight: 54,
                        borderRadius: 14,
                        border: "none",
                        backgroundColor: "#111827",
                        color: "#ffffff",
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: canSubmit ? "pointer" : "not-allowed",
                        opacity: canSubmit ? 1 : 0.6,
                      }}
                    >
                      {submitting ? content.submitting : content.submit}
                    </button>
                  </form>
                </>
              ) : (
                <div
                  style={{
                    borderRadius: 20,
                    border: "1px solid #d1fae5",
                    backgroundColor: "#f0fdf4",
                    padding: 20,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <CheckCircle2 style={{ width: 18, height: 18, color: "#059669" }} />
                    <strong style={{ fontSize: 16, color: "#065f46" }}>{content.successTitle}</strong>
                  </div>
                  <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.65, color: "#047857" }}>
                    {content.successDescription}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <a
                      href={registerHref}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 16px",
                        borderRadius: 12,
                        backgroundColor: "#111827",
                        color: "#ffffff",
                        textDecoration: "none",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {content.primaryCardCta}
                    </a>
                    <Link
                      href={auditHref}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 16px",
                        borderRadius: 12,
                        border: "1px solid #bbf7d0",
                        backgroundColor: "#ffffff",
                        color: "#065f46",
                        textDecoration: "none",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {content.auditCardCta}
                    </Link>
                  </div>
                </div>
              )}

              <div
                style={{
                  marginTop: 22,
                  paddingTop: 18,
                  borderTop: "1px solid #e5e7eb",
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#475569" }}>
                  <Clock3 style={{ width: 16, height: 16, color: "#64748b", flexShrink: 0 }} />
                  {content.reassurance}
                </div>
                <a
                  href="mailto:hello@feedplug.com"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                    textDecoration: "none",
                  }}
                >
                  <Mail style={{ width: 16, height: 16 }} />
                  hello@feedplug.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
