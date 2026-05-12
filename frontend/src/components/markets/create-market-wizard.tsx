"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe2, Languages, Layers3, Wand2 } from "lucide-react";
import { PageButtonPrimary, PageButtonSecondary, PageCard, StatusBadge } from "@/components/layout";
import type { CreateMarketPayload, Market } from "@/lib/services/markets.service";
import {
  formatLocaleLabel,
  formatMarketName,
  getMarketBlueprint,
  getPlatformLabel,
  MARKET_BLUEPRINTS,
  PLATFORM_OPTIONS,
  platformUsesLocales,
} from "@/lib/markets";

type CreateMarketWizardProps = {
  markets: Market[];
  errorMessage?: string | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onCreate: (payload: CreateMarketPayload) => Promise<void>;
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  padding: "0 14px",
  border: "1px solid var(--app-border)",
  borderRadius: 12,
  backgroundColor: "#fff",
  color: "var(--app-text)",
  fontSize: 14,
};

export function CreateMarketWizard({
  markets,
  errorMessage,
  isSubmitting,
  onCancel,
  onCreate,
}: CreateMarketWizardProps) {
  const locale = useLocale();
  const t = useTranslations("dashboard.markets");
  const existingCodes = new Set(markets.map((market) => market.code));
  const availableBlueprints = MARKET_BLUEPRINTS.filter((entry) => !existingCodes.has(entry.code));
  const [targetMarketCode, setTargetMarketCode] = useState(availableBlueprints[0]?.code ?? "");
  const [sourceMarketId, setSourceMarketId] = useState(markets[0]?.id ?? "");
  const [marketName, setMarketName] = useState(
    availableBlueprints[0] ? formatMarketName(locale, availableBlueprints[0].code) : ""
  );
  const [nameTouched, setNameTouched] = useState(false);
  const [selectedLocales, setSelectedLocales] = useState<string[]>(
    availableBlueprints[0]?.defaultLocales ?? []
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    availableBlueprints[0]?.recommendedPlatforms ?? []
  );

  const selectedBlueprint = getMarketBlueprint(targetMarketCode);
  const sourceMarkets = markets.filter((market) => market.code !== targetMarketCode);
  const selectedSourceMarket = sourceMarkets.find((market) => market.id === sourceMarketId) ?? null;

  useEffect(() => {
    if (availableBlueprints.length === 0) {
      setTargetMarketCode("");
      setSourceMarketId("");
      setSelectedLocales([]);
      setSelectedPlatforms([]);
      setMarketName("");
      return;
    }

    if (!availableBlueprints.some((entry) => entry.code === targetMarketCode)) {
      setTargetMarketCode(availableBlueprints[0].code);
    }
  }, [availableBlueprints, targetMarketCode]);

  useEffect(() => {
    if (!selectedBlueprint) return;
    setSelectedLocales(selectedBlueprint.defaultLocales);
  }, [selectedBlueprint]);

  useEffect(() => {
    if (!selectedBlueprint) return;

    if (!nameTouched) {
      setMarketName(formatMarketName(locale, selectedBlueprint.code));
    }
  }, [locale, nameTouched, selectedBlueprint]);

  useEffect(() => {
    if (sourceMarketId && !sourceMarkets.some((market) => market.id === sourceMarketId)) {
      setSourceMarketId("");
    }
  }, [sourceMarketId, sourceMarkets]);

  useEffect(() => {
    if (selectedSourceMarket) {
      const inheritedPlatforms = selectedSourceMarket.channels
        .filter((channel) => channel.isEnabled)
        .map((channel) => channel.platformKey);
      setSelectedPlatforms(inheritedPlatforms.length > 0 ? inheritedPlatforms : (selectedBlueprint?.recommendedPlatforms ?? []));
      return;
    }

    setSelectedPlatforms(selectedBlueprint?.recommendedPlatforms ?? []);
  }, [selectedBlueprint, selectedSourceMarket]);

  const reviewDestinationCount = selectedPlatforms.reduce((sum, platformKey) => {
    return sum + (platformUsesLocales(platformKey) ? selectedLocales.length : 1);
  }, 0);

  function toggleLocale(localeCode: string) {
    setSelectedLocales((current) => {
      if (current.includes(localeCode)) {
        if (current.length === 1) return current;
        return current.filter((entry) => entry !== localeCode);
      }
      return [...current, localeCode];
    });
  }

  function togglePlatform(platformKey: string) {
    setSelectedPlatforms((current) => {
      if (current.includes(platformKey)) {
        if (current.length === 1) return current;
        return current.filter((entry) => entry !== platformKey);
      }
      return [...current, platformKey];
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBlueprint || selectedLocales.length === 0 || selectedPlatforms.length === 0) {
      return;
    }

    await onCreate({
      code: selectedBlueprint.code,
      name: marketName.trim() || formatMarketName(locale, selectedBlueprint.code),
      sourceMarketId: sourceMarketId || null,
      countryCodes: [selectedBlueprint.code],
      defaultCurrencyCode: selectedBlueprint.defaultCurrencyCode,
      status: "draft",
      locales: selectedLocales.map((localeCode, index) => {
        const [languageCode = "en", countryCode = selectedBlueprint.code] = localeCode.split("-");
        return {
          localeCode,
          languageCode: languageCode.toLowerCase(),
          countryCode: countryCode.toUpperCase(),
          isDefault: index === 0,
          isRequiredLaunch: index === 0,
          translationMode: index === 0 ? "manual" : "translate",
        };
      }),
      channels: selectedPlatforms,
    });
  }

  return (
    <PageCard style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--app-accent)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {t("wizardEyebrow")}
          </p>
          <h2 style={{ margin: "8px 0 0", fontSize: 26, lineHeight: 1.1, letterSpacing: "-0.03em", color: "var(--app-text)" }}>
            {t("wizardTitle")}
          </h2>
          <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.6, color: "var(--app-text-muted)", maxWidth: 760 }}>
            {t("wizardSubtitle")}
          </p>
        </div>
        <StatusBadge variant="neutral">{t("wizardShopifyHint")}</StatusBadge>
      </div>

      {availableBlueprints.length === 0 ? (
        <div
          style={{
            padding: 18,
            borderRadius: 16,
            border: "1px dashed var(--app-border)",
            backgroundColor: "var(--app-surface-subtle, var(--paper-2))",
            color: "var(--app-text-muted)",
          }}
        >
          {t("wizardNoMarketsLeft")}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--app-text)" }}>{t("wizardMarketLabel")}</span>
              <select
                value={targetMarketCode}
                onChange={(event) => {
                  setNameTouched(false);
                  setTargetMarketCode(event.target.value);
                }}
                style={fieldStyle}
              >
                {availableBlueprints.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {formatMarketName(locale, entry.code)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--app-text)" }}>{t("wizardSourceLabel")}</span>
              <select
                value={sourceMarketId}
                onChange={(event) => setSourceMarketId(event.target.value)}
                style={fieldStyle}
              >
                <option value="">{t("wizardSourcePlaceholder")}</option>
                {sourceMarkets.map((market) => (
                  <option key={market.id} value={market.id}>
                    {market.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--app-text)" }}>{t("wizardNameLabel")}</span>
              <input
                type="text"
                value={marketName}
                onChange={(event) => {
                  setNameTouched(true);
                  setMarketName(event.target.value);
                }}
                placeholder={selectedBlueprint ? formatMarketName(locale, selectedBlueprint.code) : ""}
                style={fieldStyle}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
            <div
              style={{
                border: "1px solid var(--app-border)",
                borderRadius: 18,
                padding: 18,
                background: "linear-gradient(180deg, rgba(15,23,42,0.02), rgba(15,23,42,0))",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    backgroundColor: "rgba(14, 165, 233, 0.14)",
                    color: "var(--accent-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Languages size={18} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--app-text)" }}>{t("wizardLocalesTitle")}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--app-text-muted)", lineHeight: 1.5 }}>
                    {t("wizardLocalesHint")}
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {(selectedBlueprint?.defaultLocales ?? []).map((localeCode) => {
                  const isSelected = selectedLocales.includes(localeCode);
                  return (
                    <button
                      key={localeCode}
                      type="button"
                      onClick={() => toggleLocale(localeCode)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: 14,
                        border: isSelected ? "1px solid rgba(14, 165, 233, 0.5)" : "1px solid var(--app-border)",
                        backgroundColor: isSelected ? "rgba(14, 165, 233, 0.08)" : "#fff",
                        color: "var(--app-text)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{formatLocaleLabel(locale, localeCode)}</span>
                      {isSelected && <StatusBadge variant="success">{t("wizardSelected")}</StatusBadge>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                border: "1px solid var(--app-border)",
                borderRadius: 18,
                padding: 18,
                background: "linear-gradient(180deg, rgba(16,185,129,0.06), rgba(16,185,129,0))",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    backgroundColor: "rgba(16, 185, 129, 0.14)",
                    color: "var(--success)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Globe2 size={18} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--app-text)" }}>{t("wizardChannelsTitle")}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--app-text-muted)", lineHeight: 1.5 }}>
                    {t("wizardChannelsHint")}
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {PLATFORM_OPTIONS.map((platform) => {
                  const isSelected = selectedPlatforms.includes(platform.key);
                  return (
                    <button
                      key={platform.key}
                      type="button"
                      onClick={() => togglePlatform(platform.key)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: 14,
                        border: isSelected ? "1px solid rgba(16, 185, 129, 0.55)" : "1px solid var(--app-border)",
                        backgroundColor: isSelected ? "rgba(16, 185, 129, 0.08)" : "#fff",
                        color: "var(--app-text)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{getPlatformLabel(platform.key)}</div>
                        <div style={{ fontSize: 12, color: "var(--app-text-muted)", marginTop: 4 }}>
                          {platform.requiresConnection ? t("wizardRequiredConnection") : t("wizardOptionalConnection")}
                        </div>
                      </div>
                      {isSelected && <StatusBadge variant="success">{t("wizardSelected")}</StatusBadge>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 18,
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                borderRadius: 18,
                padding: 18,
                border: "1px solid rgba(15, 23, 42, 0.08)",
                background: "linear-gradient(140deg, rgba(15,23,42,0.95), rgba(30,41,59,0.92))",
                color: "var(--paper-2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Wand2 size={18} />
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t("wizardReviewTitle")}</p>
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.7, color: "rgba(248,250,252,0.78)" }}>
                {t("wizardReviewLine", {
                  market: selectedBlueprint ? formatMarketName(locale, selectedBlueprint.code) : "",
                  locales: selectedLocales.length,
                  channels: selectedPlatforms.length,
                  destinations: reviewDestinationCount,
                })}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <StatusBadge variant="neutral">{selectedLocales.length} {t("wizardReviewLocales")}</StatusBadge>
                <StatusBadge variant="neutral">{selectedPlatforms.length} {t("wizardReviewChannels")}</StatusBadge>
                <StatusBadge variant="neutral">{reviewDestinationCount} {t("wizardReviewDestinations")}</StatusBadge>
              </div>
            </div>

            <div
              style={{
                border: "1px solid var(--app-border)",
                borderRadius: 18,
                padding: 18,
                backgroundColor: "#fff",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Layers3 size={18} color="var(--app-accent)" />
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--app-text)" }}>
                  {t("wizardInheritanceTitle")}
                </p>
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--app-text-muted)" }}>
                {selectedSourceMarket
                  ? t("wizardInheritanceFrom", { market: selectedSourceMarket.name })
                  : t("wizardInheritanceScratch")}
              </p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--app-text-muted)" }}>
                {t("wizardInheritanceHint")}
              </p>
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              style={{
                padding: 14,
                borderRadius: 14,
                backgroundColor: "var(--alert-error-bg)",
                border: "1px solid var(--alert-error-border)",
                color: "var(--alert-error-color)",
                fontSize: 14,
              }}
            >
              {errorMessage}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <PageButtonSecondary type="button" onClick={onCancel}>
              {t("wizardCancel")}
            </PageButtonSecondary>
            <PageButtonPrimary
              type="submit"
              disabled={!selectedBlueprint || selectedLocales.length === 0 || selectedPlatforms.length === 0 || isSubmitting}
            >
              {isSubmitting ? t("wizardCreating") : t("wizardCreate")}
            </PageButtonPrimary>
          </div>
        </form>
      )}
    </PageCard>
  );
}
