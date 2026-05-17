"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api";
import { SESSION_API_CACHE_KEYS, readSessionApiCache, writeSessionApiCache } from "@/lib/session-api-cache";
import { ArrowRight, Building2, Phone, Mail, MapPin, Database, Package, Filter, Sparkles, FileText, BarChart3, Receipt, Hash } from "lucide-react";
import { COUNTRY_DIAL_CODES, buildE164 } from "@/data/country-dial-codes";
import { buildLocalizedPath, getLocalePrefixFromPathname } from "@/lib/locale-navigation";
import { appendShopifyEmbeddedParams } from "@/lib/shopify-navigation";

const COMPANY_INFO_CACHE_TTL_MS = 2 * 60 * 1000;

type CompanyInfo = {
  companyName: string;
  phoneE164: string;
  billingEmail: string;
  hasCompletedCompanyInfo: boolean;
  vatNumber?: string | null;
  siren?: string | null;
};

function OnboardingPageContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const localePrefix = getLocalePrefixFromPathname(pathname);
  const [mounted, setMounted] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [companyInfoLoading, setCompanyInfoLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [phoneCountryDial, setPhoneCountryDial] = useState("+33");
  const [phoneCustomDial, setPhoneCustomDial] = useState("");
  const [phoneNational, setPhoneNational] = useState("");
  const [billingEmail, setBillingEmail] = useState(user?.email ?? "");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("FR");
  const [vatNumber, setVatNumber] = useState("");
  const [siren, setSiren] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || isLoading) return;
    if (!isAuthenticated) {
      router.replace(appendShopifyEmbeddedParams(buildLocalizedPath("/login", localePrefix), searchParams));
    }
  }, [mounted, isLoading, isAuthenticated, localePrefix, router, searchParams]);

  useEffect(() => {
    if (!isAuthenticated || !mounted) return;
    let cancelled = false;
    (async () => {
      setCompanyInfoLoading(true);
      try {
        const cachedCompanyInfo = readSessionApiCache<CompanyInfo>(
          SESSION_API_CACHE_KEYS.companyInfo,
          COMPANY_INFO_CACHE_TTL_MS
        );
        if (cachedCompanyInfo) {
          if (!cancelled) {
            setCompanyInfo(cachedCompanyInfo);
            if (cachedCompanyInfo.vatNumber) setVatNumber(cachedCompanyInfo.vatNumber);
            if (cachedCompanyInfo.siren) setSiren(cachedCompanyInfo.siren);
            setCompanyInfoLoading(false);
          }
          return;
        }
        const res = await apiClient.get<CompanyInfo>("/account/company-info");
        if (!cancelled) {
          writeSessionApiCache(SESSION_API_CACHE_KEYS.companyInfo, res.data);
          writeSessionApiCache(SESSION_API_CACHE_KEYS.companyInfoStatus, {
            hasCompletedCompanyInfo: !!res.data.hasCompletedCompanyInfo,
          });
          setCompanyInfo(res.data);
          if (res.data.vatNumber) setVatNumber(res.data.vatNumber);
          if (res.data.siren) setSiren(res.data.siren);
        }
      } catch {
        if (!cancelled) setCompanyInfo(null);
      } finally {
        if (!cancelled) setCompanyInfoLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, mounted]);

  useEffect(() => {
    if (user?.email && !billingEmail) setBillingEmail(user.email);
  }, [user?.email, billingEmail]);

  const handleSubmitCompanyInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    const name = companyName.trim();
    if (!name) {
      setSubmitError("Le nom de l'entreprise est requis.");
      return;
    }
    // Téléphone, TVA, SIREN et adresse sont optionnels à l'onboarding
    // (collectés au moment du paiement). On valide seulement le format si fournis.
    let e164 = "";
    if (phoneNational.trim()) {
      const dial = phoneCountryDial === "OTHER" ? phoneCustomDial.trim() : phoneCountryDial;
      if (!dial) {
        setSubmitError("Indicatif pays requis pour « Autre ».");
        return;
      }
      e164 = buildE164(dial, phoneNational);
      if (!e164 || e164.length < 10) {
        setSubmitError("Numéro de téléphone invalide (avec indicatif pays).");
        return;
      }
    }
    const email = billingEmail.trim();
    const vat = vatNumber.trim();
    const sirenClean = siren.trim().replace(/\s/g, "");
    if (sirenClean && sirenClean.length !== 9) {
      setSubmitError("Le SIREN doit comporter 9 chiffres.");
      return;
    }
    const addr1 = addressLine1.trim();
    const postal = postalCode.trim();
    const cityVal = city.trim();
    const countryVal = country.trim() || "FR";
    setSubmitting(true);
    try {
      await apiClient.put("/account/company-info", {
        companyName: name,
        phoneE164: e164 || undefined,
        billingEmail: email || undefined,
        addressLine1: addr1 || undefined,
        addressLine2: addressLine2.trim() || undefined,
        postalCode: postal || undefined,
        city: cityVal || undefined,
        country: countryVal,
        vatNumber: vat || undefined,
        siren: sirenClean || undefined,
      });
      setCompanyInfo({
        companyName: name,
        phoneE164: e164,
        billingEmail: email,
        hasCompletedCompanyInfo: true,
        vatNumber: vat,
        siren: sirenClean,
      });
      writeSessionApiCache(SESSION_API_CACHE_KEYS.companyInfo, {
        companyName: name,
        phoneE164: e164,
        billingEmail: email,
        hasCompletedCompanyInfo: true,
        vatNumber: vat,
        siren: sirenClean,
      });
      writeSessionApiCache(SESSION_API_CACHE_KEYS.companyInfoStatus, {
        hasCompletedCompanyInfo: true,
      });
    } catch (err: unknown) {
      let msg = "Erreur lors de l'enregistrement.";
      if (err && typeof err === "object") {
        const e = err as { message?: string; response?: { message?: string } };
        msg = (e.message || e.response?.message || msg) as string;
      }
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const saveOnboardingProgressAndGoTo = async (path: string) => {
    try {
      await apiClient.put("/onboarding/progress", {
        currentStep: "dashboard",
        completedSteps: ["welcome"],
        collectedData: { welcomeCompletedAt: new Date().toISOString() },
      });
    } catch {
      // Non bloquant
    }
    router.push(appendShopifyEmbeddedParams(path, searchParams));
  };

  const handleConnectSource = () => saveOnboardingProgressAndGoTo(buildLocalizedPath("/sources", localePrefix));
  const handleStartTour = () => saveOnboardingProgressAndGoTo(buildLocalizedPath("/dashboard?startTour=1", localePrefix));

  if (!mounted || isLoading || !isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--paper-2)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid var(--line)",
              borderTop: "4px solid var(--accent)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ color: "var(--ink-3)", fontSize: "14px" }}>Chargement...</p>
        </div>
      </div>
    );
  }

  const showCompanyForm = companyInfoLoading === false && !companyInfo?.hasCompletedCompanyInfo;

  if (showCompanyForm) {
    const inputStyle = {
      width: "100%" as const,
      padding: "10px 12px",
      border: "1px solid var(--line)",
      borderRadius: "6px",
      fontSize: "14px",
      color: "#0a0a0a",
      backgroundColor: "#ffffff",
    };
    const labelStyle = { display: "block" as const, fontSize: "14px", fontWeight: "500" as const, color: "var(--ink-2)", marginBottom: "6px" };

    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--paper-2)", padding: "24px" }}>
        <div style={{ maxWidth: "480px", width: "100%" }}>
          <h1 style={{ fontSize: "24px", fontWeight: "600", color: "#0a0a0a", marginBottom: "8px" }}>
            Informations entreprise
          </h1>
          <p style={{ fontSize: "15px", color: "var(--ink-3)", marginBottom: "24px" }}>
            Seul le nom de votre entreprise est requis pour démarrer. Les informations de
            facturation pourront être complétées plus tard, au moment du paiement.
          </p>

          <form onSubmit={handleSubmitCompanyInfo} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {submitError && (
              <div style={{ padding: "12px", backgroundColor: "var(--danger-bg)", border: "1px solid #fecaca", borderRadius: "6px", color: "var(--danger)", fontSize: "14px" }}>
                {submitError}
              </div>
            )}

            <div>
              <label style={labelStyle}>
                <Building2 style={{ width: "16px", height: "16px", display: "inline-block", verticalAlign: "middle", marginRight: "6px" }} />
                Nom de l&apos;entreprise <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                placeholder="Raison sociale"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                <Phone style={{ width: "16px", height: "16px", display: "inline-block", verticalAlign: "middle", marginRight: "6px" }} />
                Téléphone (avec indicatif pays){" "}
                <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>(optionnel)</span>
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <select
                  value={phoneCountryDial}
                  onChange={(e) => setPhoneCountryDial(e.target.value)}
                  style={{ ...inputStyle, width: "auto", minWidth: "140px" }}
                >
                  {COUNTRY_DIAL_CODES.map((c) => (
                    <option key={c.code} value={c.dial}>{c.dial === "OTHER" ? "… " : `${c.dial} `}{c.label}</option>
                  ))}
                </select>
                {phoneCountryDial === "OTHER" && (
                  <input
                    type="text"
                    value={phoneCustomDial}
                    onChange={(e) => setPhoneCustomDial(e.target.value)}
                    placeholder="+XX"
                    style={{ ...inputStyle, width: "80px" }}
                  />
                )}
                <input
                  type="tel"
                  value={phoneNational}
                  onChange={(e) => setPhoneNational(e.target.value)}
                  placeholder="6 12 34 56 78"
                  style={{ ...inputStyle, flex: 1, minWidth: "140px" }}
                />
              </div>
              <p style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>Sans le 0 initial pour la France (ex. 6 12 34 56 78)</p>
            </div>

            <div>
              <label style={labelStyle}>
                <Mail style={{ width: "16px", height: "16px", display: "inline-block", verticalAlign: "middle", marginRight: "6px" }} />
                Email de facturation{" "}
                <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>(optionnel)</span>
              </label>
              <input
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                placeholder="facturation@entreprise.com"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                <Receipt style={{ width: "16px", height: "16px", display: "inline-block", verticalAlign: "middle", marginRight: "6px" }} />
                N° de TVA intracommunautaire{" "}
                <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>(optionnel)</span>
              </label>
              <input
                type="text"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder="FR12345678901"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                <Hash style={{ width: "16px", height: "16px", display: "inline-block", verticalAlign: "middle", marginRight: "6px" }} />
                SIREN <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>(optionnel)</span>
              </label>
              <input
                type="text"
                value={siren}
                onChange={(e) => setSiren(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="SIREN (9 chiffres)"
                style={inputStyle}
              />
              <p style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>Numéro SIREN à 9 chiffres.</p>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "16px", marginTop: "8px" }}>
              <p style={{ fontSize: "13px", fontWeight: "500", color: "var(--ink-2)", marginBottom: "12px" }}>
                <MapPin style={{ width: "14px", height: "14px", display: "inline-block", verticalAlign: "middle", marginRight: "4px" }} />
                Adresse de facturation{" "}
                <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>(optionnel)</span>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Adresse ligne 1" style={inputStyle} />
                <input type="text" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Ligne 2" style={inputStyle} />
                <div style={{ display: "flex", gap: "8px" }}>
                  <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Code postal" style={{ ...inputStyle, flex: 1 }} />
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ville" style={{ ...inputStyle, flex: 2 }} />
                </div>
                <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Pays (ex. FR)" style={{ ...inputStyle, maxWidth: "100px" }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "14px 24px",
                backgroundColor: submitting ? "var(--ink-4)" : "#0a0a0a",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "500",
                cursor: submitting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {submitting ? "Enregistrement…" : "Continuer"}
              {!submitting && <ArrowRight style={{ width: "18px", height: "18px" }} />}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const features = [
    { icon: Database, label: "Sources", desc: "Connectez Shopify, CSV, API ou autres" },
    { icon: Package, label: "Catalogue", desc: "Vos produits centralisés, score qualité et mapping" },
    { icon: Filter, label: "Règles & optimisation", desc: "Titres, descriptions, A/B par canal" },
    { icon: Sparkles, label: "IA", desc: "Enrichissement et optimisation assistés par l'IA" },
    { icon: FileText, label: "Flux d'export", desc: "GMC, Meta, Amazon, TikTok, ChatGPT, etc." },
    { icon: BarChart3, label: "Rapports & scoring", desc: "Score catalogue et canaux" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--paper-2)",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: "560px", width: "100%" }}>
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "var(--success-bg)",
            border: "1px solid #BBF7D0",
            borderRadius: "8px",
            marginBottom: "24px",
          }}
        >
          <p style={{ margin: 0, fontSize: "14px", color: "var(--success)", fontWeight: "500" }}>
            ✓ 30 jours d&apos;essai gratuit — Sans carte bancaire
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--success)", opacity: 0.9 }}>
            Testez toutes les fonctionnalités sans engagement
          </p>
        </div>

        <h1 style={{ fontSize: "28px", fontWeight: "600", color: "#0a0a0a", marginBottom: "8px" }}>
          Bienvenue{user?.firstName ? ` ${user.firstName}` : ""} !
        </h1>
        <p style={{ fontSize: "16px", color: "var(--ink-3)", marginBottom: "8px", lineHeight: 1.6 }}>
          FeedPlug centralise, optimise et distribue vos fiches produit sur tous vos canaux.
        </p>
        <p style={{ fontSize: "14px", color: "var(--ink-4)", marginBottom: "24px" }}>
          Première étape : connectez une source pour voir le score qualité de votre catalogue.
        </p>

        <div style={{ marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "var(--ink-2)" }}>
          Ce que vous pouvez faire avec FeedPlug
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "12px",
            marginBottom: "32px",
          }}
        >
          {features.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "14px",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                backgroundColor: "#ffffff",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  backgroundColor: "var(--accent-bg)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon style={{ width: "18px", height: "18px" }} />
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "#0a0a0a" }}>{label}</div>
                <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "2px" }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            type="button"
            onClick={handleConnectSource}
            style={{
              width: "100%",
              padding: "14px 24px",
              backgroundColor: "var(--accent)",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "500",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            Connecter ma première source
            <ArrowRight style={{ width: "18px", height: "18px" }} />
          </button>
          <button
            type="button"
            onClick={handleStartTour}
            style={{
              width: "100%",
              padding: "12px 24px",
              backgroundColor: "transparent",
              color: "var(--ink-3)",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              fontSize: "15px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            Faire la visite guidée (2 min)
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "var(--paper-2)" }} />}>
      <OnboardingPageContent />
    </Suspense>
  );
}
