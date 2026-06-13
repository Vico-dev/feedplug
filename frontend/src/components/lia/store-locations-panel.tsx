"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api";

interface StoreLocation {
  id: string;
  storeCode: string;
  name: string | null;
  address: string | null;
  createdAt: string;
}

interface ApiErrorMessage {
  message?: string;
  response?: { data?: { message?: string } };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const apiError = error as ApiErrorMessage;
    return apiError.response?.data?.message || apiError.message || fallback;
  }
  return fallback;
}

const baseInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "1px solid var(--app-border)",
  borderRadius: "12px",
  fontSize: "14px",
  backgroundColor: "#fff",
  color: "var(--app-text)",
  outline: "none",
};

const panelStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "18px",
  border: "1px solid var(--app-border)",
  boxShadow: "var(--card-shadow)",
};

/**
 * Gestion des magasins physiques pour Google Local Inventory Ads (LIA).
 * Les codes magasins doivent correspondre aux fiches Google Business Profile ;
 * le flux d'inventaire local (export "LIA" de la page Flux) génère une ligne
 * par produit × magasin.
 */
export function StoreLocationsPanel() {
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ storeCode: "", name: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  const loadStores = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get<{ stores: StoreLocation[] }>("/platforms/lia/stores");
      setStores(res.data?.stores ?? []);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Erreur lors du chargement des magasins"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.storeCode.trim()) {
      setError("Le code magasin est requis.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/platforms/lia/stores", {
        storeCode: form.storeCode.trim(),
        name: form.name.trim(),
        address: form.address.trim(),
      });
      setForm({ storeCode: "", name: "", address: "" });
      await loadStores();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Impossible d'enregistrer le magasin"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (storeCode: string) => {
    setDeletingCode(storeCode);
    setError(null);
    try {
      await apiClient.delete(`/platforms/lia/stores/${encodeURIComponent(storeCode)}`);
      await loadStores();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Impossible de supprimer le magasin"));
    } finally {
      setDeletingCode(null);
    }
  };

  return (
    <div style={panelStyle}>
      <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#0a0a0a", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: "8px" }}>
        <MapPin style={{ width: "20px", height: "20px" }} />
        Magasins — Google Local Inventory Ads
      </h2>
      <p style={{ fontSize: "14px", color: "var(--ink-3)", margin: "0 0 24px 0", lineHeight: 1.5 }}>
        Déclarez vos points de vente pour générer le flux d&apos;inventaire local (export « Google Local Inventory Ads »
        depuis la page Flux). Le code magasin doit correspondre au code de votre fiche Google Business Profile.
        Sans stock renseigné par magasin, le stock global du produit est utilisé pour chaque magasin.
      </p>

      <form
        onSubmit={handleCreate}
        style={{
          marginBottom: "24px",
          padding: "20px",
          border: "1px solid var(--app-border)",
          borderRadius: "16px",
          backgroundColor: "#fafafa",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink-2)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <Plus style={{ width: "16px", height: "16px" }} />
          Ajouter un magasin
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "var(--ink-2)", marginBottom: "4px" }}>
              Code magasin *
            </label>
            <input
              type="text"
              value={form.storeCode}
              onChange={(e) => setForm((f) => ({ ...f, storeCode: e.target.value }))}
              style={baseInputStyle}
              placeholder="PARIS_01"
              required
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "var(--ink-2)", marginBottom: "4px" }}>
              Nom
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              style={baseInputStyle}
              placeholder="Boutique Paris Marais"
            />
          </div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "var(--ink-2)", marginBottom: "4px" }}>
            Adresse
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            style={baseInputStyle}
            placeholder="12 rue des Archives, 75004 Paris"
          />
        </div>
        {error && (
          <p style={{ fontSize: "13px", margin: 0, color: "var(--danger)" }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={saving}
          style={{
            alignSelf: "flex-start",
            padding: "10px 20px",
            backgroundColor: "#0a0a0a",
            color: "white",
            border: "none",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "Enregistrement…" : "Ajouter le magasin"}
        </button>
      </form>

      <h3 style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink-2)", margin: "0 0 12px 0" }}>
        Magasins déclarés ({stores.length})
      </h3>
      <div style={{ border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--ink-3)" }}>Chargement…</div>
        ) : stores.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--ink-3)" }}>
            Aucun magasin pour le moment. Ajoutez votre premier point de vente ci-dessus.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {stores.map((store) => (
              <li
                key={store.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--paper-2)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      backgroundColor: "#e6f4ea",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <MapPin style={{ width: "18px", height: "18px", color: "#34a853" }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0a0a0a" }}>
                      {store.storeCode}
                      {store.name ? <span style={{ fontWeight: 400, color: "var(--ink-3)" }}> · {store.name}</span> : null}
                    </p>
                    {store.address && (
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--ink-3)" }}>{store.address}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(store.storeCode)}
                  disabled={deletingCode === store.storeCode}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: "500",
                    color: "var(--danger)",
                    backgroundColor: "transparent",
                    border: "1px solid var(--danger)",
                    borderRadius: "8px",
                    cursor: deletingCode === store.storeCode ? "wait" : "pointer",
                  }}
                >
                  <Trash2 style={{ width: "14px", height: "14px" }} />
                  {deletingCode === store.storeCode ? "Suppression…" : "Retirer"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
