"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { trackEvent } from "@/components/analytics/GoogleAnalytics";
import { appendShopifyEmbeddedParams } from "@/lib/shopify-navigation";
import { buildLocalizedPath, getLocalePrefixFromPathname } from "@/lib/locale-navigation";
import {
  PRODUCT_TIERS,
  CHANNEL_OPTIONS,
  ADDON_IA_PRICE_EUR,
  getPriceFromGrid,
  getProductTierLabel,
  estimateTtc,
  type ProductTier,
  type ChannelCount,
} from "@/config/pricing-grid-v2";

/** Formate un montant EUR (avec décimales si non entier). */
function formatEur(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const CHOOSE_PLAN_DRAFT_KEY = "feedplug_choose_plan_draft_v1";

/** Configuration mise en avant (« Recommandé ») — équivalent au plan Pro Shopify. */
const RECOMMENDED_CONFIG = { productTier: 1000 as ProductTier, channelCount: 2 as ChannelCount };

/**
 * Cartes packagées lisibles pour ancrer le choix. Le configurateur reste
 * disponible en dessous (« Affiner ma configuration ») sans casser le flux Stripe.
 */
const PLAN_PRESETS: {
  key: string;
  name: string;
  tagline: string;
  productTier: ProductTier;
  channelCount: ChannelCount;
  addonIA: boolean;
  recommended?: boolean;
}[] = [
  { key: "starter", name: "Starter", tagline: "Pour démarrer sur Google Shopping", productTier: 100, channelCount: 1, addonIA: false },
  { key: "pro", name: "Pro", tagline: "La majorité des boutiques", productTier: 1000, channelCount: 2, addonIA: false, recommended: true },
  { key: "business", name: "Business", tagline: "Catalogues larges + Pack IA", productTier: 10000, channelCount: 3, addonIA: true },
  { key: "premium", name: "Premium", tagline: "Catalogues massifs, multi-canaux", productTier: 50000, channelCount: 5, addonIA: true },
];

/** Bandeau de réassurance — levier de conversion principal sur cette étape. */
function ReassuranceBar() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px 16px",
        padding: "12px 16px",
        backgroundColor: "var(--paper-2)",
        border: "1px solid var(--line)",
        borderRadius: "8px",
        marginBottom: "24px",
        fontSize: "13px",
        color: "var(--ink-3)",
      }}
    >
      <span style={{ fontWeight: 600, color: "#0a0a0a" }}>14 jours d&apos;essai gratuit</span>
      <span style={{ opacity: 0.5 }}>·</span>
      <span>Sans engagement</span>
      <span style={{ opacity: 0.5 }}>·</span>
      <span>Résiliable en 1 clic depuis votre espace</span>
      <span style={{ opacity: 0.5 }}>·</span>
      <span>Sans carte bancaire</span>
    </div>
  );
}

type BillingFormState = {
  companyName: string;
  siret: string;
  siren: string;
  vatNumber: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
  billingEmail: string;
};

type CompanyInfoResponse = {
  companyName?: string | null;
  billingEmail?: string | null;
  vatNumber?: string | null;
  siren?: string | null;
  billingAddress?: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
};

type ChoosePlanDraft = {
  step: 1 | 2 | 3;
  productTier: ProductTier;
  channelCount: ChannelCount;
  addonIA: boolean;
  billing: BillingFormState;
};

export default function ChoosePlanPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const localePrefix = getLocalePrefixFromPathname(pathname);
  const [locationSearch, setLocationSearch] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [productTier, setProductTier] = useState<ProductTier>(1000);
  const [channelCount, setChannelCount] = useState<ChannelCount>(2);
  const [addonIA, setAddonIA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [billing, setBilling] = useState({
    companyName: "",
    siret: "",
    siren: "",
    vatNumber: "",
    addressLine1: "",
    addressLine2: "",
    postalCode: "",
    city: "",
    country: "FR",
    billingEmail: "",
  });

  const mergeBillingState = useCallback((incoming: Partial<BillingFormState>) => {
    setBilling((prev) => ({
      companyName: incoming.companyName || prev.companyName,
      siret: incoming.siret || prev.siret,
      siren: incoming.siren || prev.siren,
      vatNumber: incoming.vatNumber || prev.vatNumber,
      addressLine1: incoming.addressLine1 || prev.addressLine1,
      addressLine2: incoming.addressLine2 || prev.addressLine2,
      postalCode: incoming.postalCode || prev.postalCode,
      city: incoming.city || prev.city,
      country: incoming.country || prev.country,
      billingEmail: incoming.billingEmail || prev.billingEmail,
    }));
  }, []);

  const basePrice = useMemo(() => getPriceFromGrid(productTier, channelCount), [productTier, channelCount]);
  const totalPrice = basePrice != null ? basePrice + (addonIA ? ADDON_IA_PRICE_EUR : 0) : null;
  const isWithinGrid = totalPrice != null;
  // Estimation TTC indicative selon le pays de facturation (Stripe Tax fait foi).
  const taxEstimate = useMemo(
    () => (totalPrice != null ? estimateTtc(totalPrice, billing.country) : null),
    [totalPrice, billing.country]
  );
  const vatPercentLabel = taxEstimate ? `${Math.round(taxEstimate.rate * 100)} %` : "";

  const isRecommendedConfig =
    productTier === RECOMMENDED_CONFIG.productTier && channelCount === RECOMMENDED_CONFIG.channelCount;

  /** Applique une carte packagée au configurateur (sans quitter le flux Stripe). */
  const applyPreset = useCallback((preset: (typeof PLAN_PRESETS)[number]) => {
    setProductTier(preset.productTier);
    setChannelCount(preset.channelCount);
    setAddonIA(preset.addonIA);
    setError("");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(CHOOSE_PLAN_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<ChoosePlanDraft>;
      if (draft.step === 1 || draft.step === 2 || draft.step === 3) {
        setStep(draft.step);
      }
      if (typeof draft.productTier === "number" && PRODUCT_TIERS.includes(draft.productTier as ProductTier)) {
        setProductTier(draft.productTier as ProductTier);
      }
      if (typeof draft.channelCount === "number" && CHANNEL_OPTIONS.includes(draft.channelCount as ChannelCount)) {
        setChannelCount(draft.channelCount as ChannelCount);
      }
      if (typeof draft.addonIA === "boolean") {
        setAddonIA(draft.addonIA);
      }
      if (draft.billing && typeof draft.billing === "object") {
        setBilling((prev) => ({ ...prev, ...draft.billing }));
      }
    } catch {
      // Ignorer un brouillon corrompu
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncSearch = () => setLocationSearch(window.location.search);
    syncSearch();
    window.addEventListener("popstate", syncSearch);
    return () => window.removeEventListener("popstate", syncSearch);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const draft: ChoosePlanDraft = {
      step,
      productTier,
      channelCount,
      addonIA,
      billing,
    };
    window.sessionStorage.setItem(CHOOSE_PLAN_DRAFT_KEY, JSON.stringify(draft));
  }, [step, productTier, channelCount, addonIA, billing]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const currentSearch = typeof window !== "undefined" ? window.location.search : locationSearch;
      router.replace(appendShopifyEmbeddedParams(buildLocalizedPath("/login", localePrefix), currentSearch));
    }
  }, [authLoading, isAuthenticated, localePrefix, locationSearch, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const [billingResponse, companyInfoResponse] = await Promise.all([
          apiClient.get<BillingFormState | null>("/billing").catch(() => ({ data: null })),
          apiClient.get<CompanyInfoResponse>("/account/company-info").catch(() => ({ data: null })),
        ]);
        if (cancelled) return;

        const billingData = billingResponse.data;
        if (billingData) {
          mergeBillingState(billingData);
        }

        const companyInfo = companyInfoResponse.data;
        if (companyInfo) {
          mergeBillingState({
            companyName: companyInfo.companyName ?? "",
            billingEmail: companyInfo.billingEmail ?? "",
            vatNumber: companyInfo.vatNumber ?? "",
            siren: companyInfo.siren ?? "",
            addressLine1: companyInfo.billingAddress?.addressLine1 ?? "",
            addressLine2: companyInfo.billingAddress?.addressLine2 ?? "",
            postalCode: companyInfo.billingAddress?.postalCode ?? "",
            city: companyInfo.billingAddress?.city ?? "",
            country: companyInfo.billingAddress?.country ?? "FR",
          });
        }

        const currentSearchParams = new URLSearchParams(locationSearch);
        if (currentSearchParams.get("checkout") === "cancelled") {
          setInfoMessage("Paiement interrompu. Vous pouvez reprendre votre souscription sans ressaisir vos informations.");
          setStep(3);
        }
      } catch {
        const currentSearchParams = new URLSearchParams(locationSearch);
        if (!cancelled && currentSearchParams.get("checkout") === "cancelled") {
          setInfoMessage("Paiement interrompu. Vous pouvez reprendre votre souscription.");
          setStep(3);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, locationSearch, mergeBillingState]);

  const handleNextStep1 = () => {
    if (isWithinGrid) setStep(2);
    else setError("Choisissez une configuration dans la grille (produits et canaux).");
  };

  const handleBillingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiClient.post("/billing", billing);
      setStep(3);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Erreur";
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!isWithinGrid) return;
    setError("");
    setLoading(true);
    try {
      const appUrl = typeof window !== "undefined" ? window.location.origin : "";
      const successPath = appendShopifyEmbeddedParams(
        buildLocalizedPath("/dashboard?checkout=success", localePrefix),
        locationSearch
      );
      const cancelPath = appendShopifyEmbeddedParams(
        buildLocalizedPath("/choose-plan?checkout=cancelled", localePrefix),
        locationSearch
      );
      const res = await apiClient.post<{ url: string }>("/billing/create-checkout-session", {
        productTier,
        channelCount,
        addonIA,
        successUrl: `${appUrl}${successPath}`,
        cancelUrl: `${appUrl}${cancelPath}`,
      });
      if (res.data?.url) {
        trackEvent("begin_checkout", {
          currency: "EUR",
          value: totalPrice,
          items: `${productTier}_${channelCount}ch${addonIA ? "_ia" : ""}`,
        });
        window.location.href = res.data.url;
      } else {
        setError("Impossible de créer la session de paiement");
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erreur Stripe");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--paper-2)" }}>
        <p style={{ color: "var(--ink-3)" }}>Chargement...</p>
      </div>
    );
  }

  const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "6px", fontSize: "14px" };
  const labelStyle = { display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "6px" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff", padding: "24px" }}>
      <div style={{ maxWidth: "560px", width: "100%" }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "32px" }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                backgroundColor: step >= s ? "#0a0a0a" : "var(--line)",
              }}
            />
          ))}
        </div>

        <h1 style={{ fontSize: "24px", fontWeight: "600", color: "#0a0a0a", marginBottom: "8px" }}>
          {step === 1 && "Configurez votre forfait"}
          {step === 2 && "Informations de facturation"}
          {step === 3 && "Paiement"}
        </h1>
        <p style={{ fontSize: "15px", color: "var(--ink-3)", marginBottom: "24px" }}>
          {step === 1 && "Produits × canaux + option Pack IA — même grille que sur feedplug.com/tarifs."}
          {step === 2 && "L'essentiel pour votre facture — Stripe collecte et corrige le reste au paiement."}
          {step === 3 && "Vous allez être redirigé vers Stripe pour payer par carte bancaire ou prélèvement SEPA."}
        </p>

        {error && (
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "var(--danger-bg)",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              color: "var(--danger)",
              fontSize: "14px",
              marginBottom: "24px",
            }}
          >
            {error}
          </div>
        )}

        {infoMessage && (
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "var(--accent-bg)",
              border: "1px solid var(--accent-bg)",
              borderRadius: "8px",
              color: "var(--accent-2)",
              fontSize: "14px",
              marginBottom: "24px",
            }}
          >
            {infoMessage}
          </div>
        )}

        {/* Étape 1 : Configurateur */}
        {step === 1 && (
          <>
            {/* Cartes packagées — ancrage + lisibilité avant le configurateur fin */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              {PLAN_PRESETS.map((preset) => {
                const presetPrice = getPriceFromGrid(preset.productTier, preset.channelCount);
                const presetTotal =
                  presetPrice != null ? presetPrice + (preset.addonIA ? ADDON_IA_PRICE_EUR : 0) : null;
                const selected =
                  productTier === preset.productTier &&
                  channelCount === preset.channelCount &&
                  addonIA === preset.addonIA;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    style={{
                      position: "relative",
                      textAlign: "left",
                      padding: "16px 14px",
                      border: `2px solid ${selected ? "#0a0a0a" : preset.recommended ? "#0a0a0a" : "var(--line)"}`,
                      borderRadius: "10px",
                      backgroundColor: selected ? "#0a0a0a" : "#fff",
                      color: selected ? "#fff" : "#0a0a0a",
                      cursor: "pointer",
                    }}
                  >
                    {preset.recommended && (
                      <span
                        style={{
                          position: "absolute",
                          top: "-9px",
                          left: "12px",
                          padding: "1px 8px",
                          fontSize: "10px",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          borderRadius: "999px",
                          backgroundColor: "#0a0a0a",
                          color: "#fff",
                        }}
                      >
                        Recommandé
                      </span>
                    )}
                    <div style={{ fontSize: "14px", fontWeight: 700 }}>{preset.name}</div>
                    <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "4px" }}>
                      {presetTotal != null ? `${presetTotal} €` : "—"}
                      <span style={{ fontSize: "11px", fontWeight: 400, opacity: 0.8 }}> HT/mois</span>
                    </div>
                    <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "6px", lineHeight: 1.3 }}>
                      {preset.tagline}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Offre agence — capter le lead multi-comptes plutôt que le forcer dans un plan marchand */}
            <a
              href={buildLocalizedPath("/demo", localePrefix)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "14px 16px",
                border: "1px dashed var(--line)",
                borderRadius: "10px",
                marginBottom: "28px",
                textDecoration: "none",
                color: "#0a0a0a",
              }}
            >
              <span style={{ fontSize: "13px", lineHeight: 1.4 }}>
                <strong>Agences &amp; multi-comptes ?</strong>
                <br />
                <span style={{ color: "var(--ink-3)" }}>Gérez plusieurs catalogues clients — parlons-en.</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap" }}>
                Nous contacter
                <ArrowRight style={{ width: "15px", height: "15px" }} />
              </span>
            </a>

            <details style={{ marginBottom: "24px" }}>
              <summary style={{ cursor: "pointer", fontSize: "14px", fontWeight: 600, color: "#0a0a0a", marginBottom: "16px" }}>
                Affiner ma configuration (produits × canaux × Pack IA)
              </summary>
            <div style={{ marginBottom: "24px" }}>
              <div style={labelStyle}>Nombre de produits (tranche)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {PRODUCT_TIERS.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setProductTier(tier)}
                    style={{
                      padding: "10px 16px",
                      border: `2px solid ${productTier === tier ? "#0a0a0a" : "var(--line)"}`,
                      borderRadius: "8px",
                      backgroundColor: productTier === tier ? "#fafafa" : "#fff",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#0a0a0a",
                    }}
                  >
                    Jusqu&apos;à {getProductTierLabel(tier)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: "24px" }}>
              <div style={labelStyle}>Nombre de canaux d&apos;export (1 à 5)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {CHANNEL_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setChannelCount(n)}
                    style={{
                      padding: "10px 18px",
                      border: `2px solid ${channelCount === n ? "#0a0a0a" : "var(--line)"}`,
                      borderRadius: "8px",
                      backgroundColor: channelCount === n ? "#fafafa" : "#fff",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#0a0a0a",
                    }}
                  >
                    {n} canal{n > 1 ? "aux" : ""}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "8px", marginBottom: 0 }}>
                Besoin de plus de 5 canaux ? Contactez-nous pour un devis sur mesure.
              </p>
            </div>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={addonIA}
                  onChange={(e) => setAddonIA(e.target.checked)}
                  style={{ width: "18px", height: "18px" }}
                />
                <span style={{ fontSize: "15px", color: "#0a0a0a" }}>
                  Pack IA (génération titres + images) — +{ADDON_IA_PRICE_EUR} € HT/mois
                </span>
              </label>
            </div>
            </details>
            {isWithinGrid && (
              <div
                style={{
                  padding: "16px 20px",
                  backgroundColor: "#0a0a0a",
                  color: "#fff",
                  borderRadius: "8px",
                  marginBottom: "24px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
                  <div style={{ fontSize: "13px", opacity: 0.85 }}>Votre forfait</div>
                  {isRecommendedConfig && (
                    <span
                      style={{
                        padding: "1px 8px",
                        fontSize: "10px",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        borderRadius: "999px",
                        backgroundColor: "#fff",
                        color: "#0a0a0a",
                      }}
                    >
                      Recommandé
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "28px", fontWeight: "700" }}>
                  {totalPrice} € <span style={{ fontSize: "14px", fontWeight: "400", opacity: 0.9 }}>HT / mois</span>
                </div>
                {taxEstimate && (
                  <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "4px" }}>
                    Soit {formatEur(taxEstimate.ttcEur)} TTC / mois ({formatEur(taxEstimate.vatEur)} de TVA {vatPercentLabel})
                  </div>
                )}
                <div style={{ fontSize: "13px", opacity: 0.85, marginTop: "4px" }}>
                  Jusqu&apos;à {getProductTierLabel(productTier)} produits · {channelCount} canal{channelCount > 1 ? "aux" : ""}
                  {addonIA && " · Pack IA inclus"}
                </div>
                <div style={{ fontSize: "11px", opacity: 0.7, marginTop: "6px" }}>
                  TVA estimée pour la France. Le montant exact (autoliquidation B2B intra-UE incluse) est calculé par Stripe au paiement.
                </div>
              </div>
            )}
            <ReassuranceBar />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleNextStep1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 24px",
                  backgroundColor: "#0a0a0a",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Continuer
                <ArrowRight style={{ width: "16px", height: "16px" }} />
              </button>
            </div>
          </>
        )}

        {/* Étape 2 : Formulaire B2B */}
        {step === 2 && (
          <form onSubmit={handleBillingSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Raison sociale *</label>
                <input type="text" required value={billing.companyName} onChange={(e) => setBilling((p) => ({ ...p, companyName: e.target.value }))} style={inputStyle} placeholder="Société Example SARL" />
              </div>
              <div>
                <label style={labelStyle}>Email de facturation *</label>
                <input type="email" required value={billing.billingEmail} onChange={(e) => setBilling((p) => ({ ...p, billingEmail: e.target.value }))} style={inputStyle} placeholder="facturation@entreprise.com" />
              </div>
              <div>
                <label style={labelStyle}>Adresse (ligne 1) *</label>
                <input type="text" required value={billing.addressLine1} onChange={(e) => setBilling((p) => ({ ...p, addressLine1: e.target.value }))} style={inputStyle} placeholder="10 rue de la Paix" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Code postal *</label>
                  <input type="text" required value={billing.postalCode} onChange={(e) => setBilling((p) => ({ ...p, postalCode: e.target.value }))} style={inputStyle} placeholder="75001" />
                </div>
                <div>
                  <label style={labelStyle}>Ville *</label>
                  <input type="text" required value={billing.city} onChange={(e) => setBilling((p) => ({ ...p, city: e.target.value }))} style={inputStyle} placeholder="Paris" />
                </div>
              </div>

              {/* Champs secondaires repliés : on ne demande que l'essentiel par défaut.
                  Le détail (TVA, SIRET, complément d'adresse) reste corrigeable sur Stripe au paiement. */}
              <details>
                <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "var(--ink-3)" }}>
                  Ajouter mes informations fiscales (optionnel)
                </summary>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
                  <div>
                    <label style={labelStyle}>Adresse (ligne 2)</label>
                    <input type="text" value={billing.addressLine2} onChange={(e) => setBilling((p) => ({ ...p, addressLine2: e.target.value }))} style={inputStyle} placeholder="Bâtiment B" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={labelStyle}>SIRET</label>
                      <input type="text" value={billing.siret} onChange={(e) => setBilling((p) => ({ ...p, siret: e.target.value }))} style={inputStyle} placeholder="12345678900012" />
                    </div>
                    <div>
                      <label style={labelStyle}>SIREN</label>
                      <input type="text" value={billing.siren} onChange={(e) => setBilling((p) => ({ ...p, siren: e.target.value }))} style={inputStyle} placeholder="123456789" />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>N° TVA intracommunautaire</label>
                    <input type="text" value={billing.vatNumber} onChange={(e) => setBilling((p) => ({ ...p, vatNumber: e.target.value }))} style={inputStyle} placeholder="FR12345678901" />
                    <p style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "6px", marginBottom: 0 }}>
                      Vous pourrez aussi le saisir ou le corriger directement sur la page de paiement Stripe.
                    </p>
                  </div>
                </div>
              </details>
            </div>
            <div style={{ marginTop: "24px", display: "flex", justifyContent: "space-between" }}>
              <button type="button" onClick={() => setStep(1)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 24px", backgroundColor: "transparent", color: "var(--ink-3)", border: "1px solid var(--line)", borderRadius: "8px", fontSize: "14px", cursor: "pointer" }}>
                <ArrowLeft style={{ width: "16px", height: "16px" }} />
                Retour
              </button>
              <button type="submit" disabled={loading} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 24px", backgroundColor: "#0a0a0a", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "500", cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Enregistrement..." : "Continuer"}
                <ArrowRight style={{ width: "16px", height: "16px" }} />
              </button>
            </div>
          </form>
        )}

        {/* Étape 3 : Paiement Stripe */}
        {step === 3 && (
          <>
            <div style={{ padding: "20px", backgroundColor: "var(--paper-2)", borderRadius: "8px", border: "1px solid var(--line)", marginBottom: "24px" }}>
              <div style={{ fontWeight: "600", color: "#0a0a0a", marginBottom: "4px" }}>
                {totalPrice} € HT / mois — Jusqu&apos;à {getProductTierLabel(productTier)} produits · {channelCount} canal{channelCount > 1 ? "aux" : ""}
                {addonIA && " · Pack IA"}
              </div>
              {taxEstimate && (
                <div style={{ fontSize: "14px", color: "#0a0a0a", marginBottom: "4px" }}>
                  Soit {formatEur(taxEstimate.ttcEur)} TTC / mois{" "}
                  <span style={{ color: "var(--ink-3)" }}>
                    (TVA {vatPercentLabel} estimée — montant exact calculé par Stripe au paiement)
                  </span>
                </div>
              )}
              <div style={{ fontSize: "14px", color: "var(--ink-3)" }}>Paiement sécurisé par carte bancaire ou prélèvement SEPA via Stripe</div>
              <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "8px" }}>
                En cas de prélèvement SEPA, l&apos;accès reste ouvert pendant 10 jours le temps de confirmer l&apos;encaissement.
              </div>
            </div>
            <ReassuranceBar />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button type="button" onClick={() => setStep(2)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 24px", backgroundColor: "transparent", color: "var(--ink-3)", border: "1px solid var(--line)", borderRadius: "8px", fontSize: "14px", cursor: "pointer" }}>
                <ArrowLeft style={{ width: "16px", height: "16px" }} />
                Retour
              </button>
              <button
                type="button"
                onClick={handlePay}
                disabled={loading}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 24px", backgroundColor: "#0a0a0a", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "500", cursor: loading ? "not-allowed" : "pointer" }}
              >
                {loading ? "Redirection..." : "Payer avec Stripe"}
                <ArrowRight style={{ width: "16px", height: "16px" }} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
