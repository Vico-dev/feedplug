"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Sliders, Settings, CheckCircle, X, Loader2 } from "lucide-react";
import { API_BASE_URL, authFetch } from "@/lib/api";
import {
  PageLayout,
  PageHeader,
  PageCard,
  PageLoading,
  PageError,
  PageButtonSecondary,
} from "@/components/layout";

const API_URL = API_BASE_URL;

interface ChannelConfig {
  id: string;
  enabled: boolean;
  qualityWeight: number;
  performanceWeight: number;
  performanceMetrics: Record<string, unknown>;
  period: string;
  updatedAt: string;
}

interface ChannelItem {
  channel: string;
  name: string;
  config: ChannelConfig | null;
}

interface ChannelsResponse {
  channels: ChannelItem[];
}

const PERIODS = [
  { value: "LAST_7_DAYS", label: "7 derniers jours" },
  { value: "LAST_30_DAYS", label: "30 derniers jours" },
  { value: "LAST_90_DAYS", label: "90 derniers jours" },
];

export default function ScoringCanauxPage() {
  const t = useTranslations("dashboard");
  const [data, setData] = useState<ChannelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingChannel, setEditingChannel] = useState<ChannelItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formQuality, setFormQuality] = useState(50);
  const [formPerf, setFormPerf] = useState(50);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formPeriod, setFormPeriod] = useState("LAST_30_DAYS");
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch(`${API_URL}/scoring-canaux`);
      if (res.status === 401) {
        setError("Connectez-vous pour accéder à cette page.");
        return;
      }
      if (!res.ok) throw new Error("Erreur chargement des canaux");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const openEdit = (item: ChannelItem) => {
    setSaveError(null);
    setEditingChannel(item);
    const c = item.config;
    if (c) {
      setFormQuality(Math.round(c.qualityWeight * 100));
      setFormPerf(Math.round(c.performanceWeight * 100));
      setFormEnabled(c.enabled);
      setFormPeriod(c.period || "LAST_30_DAYS");
    } else {
      setFormQuality(50);
      setFormPerf(50);
      setFormEnabled(true);
      setFormPeriod("LAST_30_DAYS");
    }
  };

  const closeEdit = () => {
    setEditingChannel(null);
    setSaving(false);
  };

  const handleQualityChange = (v: number) => {
    setFormQuality(v);
    setFormPerf(100 - v);
  };

  const handlePerfChange = (v: number) => {
    setFormPerf(v);
    setFormQuality(100 - v);
  };

  const saveConfig = async () => {
    if (!editingChannel) return;
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/scoring-canaux/${editingChannel.channel}`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: formEnabled,
          qualityWeight: formQuality / 100,
          performanceWeight: formPerf / 100,
          period: formPeriod,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erreur lors de l’enregistrement");
      }
      await fetchChannels();
      closeEdit();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <PageLoading message="Chargement des canaux…" style={{ paddingTop: 80 }} />
      </PageLayout>
    );
  }

  if (error && !data) {
    return (
      <PageLayout>
        <PageError message={error} onRetry={fetchChannels} style={{ marginTop: 80 }} />
      </PageLayout>
    );
  }

  const channels = data?.channels ?? [];

  return (
    <PageLayout>
      <PageHeader
        title={t("scoringCanaux.title")}
        subtitle={
          <>
            Combinez le <strong>score qualité</strong> de vos fiches produit (Feedplug) et les{" "}
            <strong>performances commerciales</strong> sur chaque canal pour obtenir un score unique par canal.
            Configurez les poids qualité / performance ci‑dessous.
          </>
        }
        icon={Sliders}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginTop: 24 }}>
        {channels.map((item) => (
          <PageCard key={item.channel}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 16 }}>{item.name}</span>
              {item.config?.enabled ? (
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--success)", fontSize: 13 }}>
                  <CheckCircle size={14} /> Activé
                </span>
              ) : (
                <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
                  {item.config ? t("common.disabled") : t("common.notConfigured")}
                </span>
              )}
            </div>
            {item.config && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)", marginBottom: 12 }}>
                {Math.round((item.config.qualityWeight || 0) * 100)} % qualité ·{" "}
                {Math.round((item.config.performanceWeight || 0) * 100)} % performance
              </p>
            )}
            <PageButtonSecondary
              onClick={() => openEdit(item)}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Settings size={14} style={{ marginRight: 6 }} />
              Configurer
            </PageButtonSecondary>
          </PageCard>
        ))}
      </div>

      {editingChannel && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 24,
          }}
          onClick={closeEdit}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Scoring — {editingChannel.name}</h3>
              <button
                type="button"
                onClick={closeEdit}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={formEnabled}
                onChange={(e) => setFormEnabled(e.target.checked)}
              />
              <span>Scoring actif pour ce canal</span>
            </label>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>Qualité des données</span>
                <span style={{ fontSize: 14, color: "var(--ink-3)" }}>{formQuality} %</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={formQuality}
                onChange={(e) => handleQualityChange(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--ink)" }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>Performance commerciale</span>
                <span style={{ fontSize: 14, color: "var(--ink-3)" }}>{formPerf} %</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={formPerf}
                onChange={(e) => handlePerfChange(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--ink)" }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                Période des performances
              </label>
              <select
                value={formPeriod}
                onChange={(e) => setFormPeriod(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontSize: 14,
                }}
              >
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <p style={{ margin: "0 0 20px", fontSize: 12, color: "var(--ink-3)" }}>
              Score canal = {formQuality} % score qualité Feedplug + {formPerf} % performance (données à venir via APIs).
            </p>

            {saveError && (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--danger)" }}>{saveError}</p>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <PageButtonSecondary onClick={closeEdit}>Annuler</PageButtonSecondary>
              <button
                type="button"
                onClick={saveConfig}
                disabled={saving}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--ink)",
                  color: "#fff",
                  fontWeight: 500,
                  cursor: saving ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {saving ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : null}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </PageLayout>
  );
}
