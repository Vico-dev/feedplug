"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Download, Trash2, Upload } from "lucide-react";
import { apiClient } from "@/lib/api";

interface StoreOption {
  storeCode: string;
  name: string | null;
}

interface InventoryRow {
  storeCode: string;
  offerId: string;
  quantity: number;
  availability: string | null;
  price: number | null;
  salePrice: number | null;
  pickupMethod: string | null;
  pickupSla: string | null;
  updatedAt: string;
}

interface UploadPreview {
  rows: Partial<InventoryRow>[];
  errors: { line: number; reason: string }[];
}

interface ApiErrorMessage {
  message?: string;
  response?: { data?: { message?: string; errors?: { line: number; reason: string }[] } };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const apiError = error as ApiErrorMessage;
    return apiError.response?.data?.message || apiError.message || fallback;
  }
  return fallback;
}

const VALID_AVAILABILITIES = ["in stock", "out of stock", "limited availability", "on display to order"];
const VALID_PICKUP_METHODS = ["buy", "reserve", "ship to store", "not supported"];
const VALID_PICKUP_SLAS = ["same day", "next day", "2-day", "3-day", "4-day", "5-day", "6-day", "7-day", "multi-week"];

// Colonnes attendues dans le CSV uploadé. Doit matcher les noms acceptés par
// POST /api/v1/platforms/lia/inventory côté backend (validateInventoryRows).
const CSV_COLUMNS = [
  "storeCode",
  "offerId",
  "quantity",
  "availability",
  "price",
  "salePrice",
  "pickupMethod",
  "pickupSla",
] as const;
type CsvColumn = (typeof CSV_COLUMNS)[number];

const panelStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "18px",
  border: "1px solid var(--app-border)",
  boxShadow: "var(--card-shadow)",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--app-border)",
  borderRadius: "10px",
  fontSize: "14px",
  backgroundColor: "#fff",
  color: "var(--app-text)",
  outline: "none",
};

const buttonPrimary: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  background: "var(--app-primary, #111)",
  color: "#fff",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 500,
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
};

const buttonSecondary: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--app-border)",
  background: "#fff",
  color: "var(--app-text)",
  cursor: "pointer",
  fontSize: "13px",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

/**
 * Parse un CSV en respectant les guillemets (un champ entre `"` peut contenir
 * des virgules et un guillemet échappé `""`). Pas de dépendance externe ; on
 * tient un volume ≤ 5000 lignes (limite backend), donc le coût est négligeable.
 */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === "," || c === ";" || c === "\t") {
        row.push(cell);
        cell = "";
      } else if (c === "\n" || c === "\r") {
        if (cell.length > 0 || row.length > 0) {
          row.push(cell);
          out.push(row);
          row = [];
          cell = "";
        }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else {
        cell += c;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function buildInventoryPreview(csvText: string, knownStoreCodes: Set<string>): UploadPreview {
  const matrix = parseCsv(csvText);
  if (matrix.length === 0) {
    return { rows: [], errors: [{ line: 0, reason: "Fichier CSV vide" }] };
  }
  const header = matrix[0].map((c) => c.trim().replace(/^﻿/, ""));
  const indexByColumn: Partial<Record<CsvColumn, number>> = {};
  for (const col of CSV_COLUMNS) {
    const idx = header.findIndex((h) => h.toLowerCase() === col.toLowerCase());
    if (idx !== -1) indexByColumn[col] = idx;
  }
  if (indexByColumn.storeCode == null || indexByColumn.offerId == null || indexByColumn.quantity == null) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          reason: "Colonnes obligatoires manquantes : storeCode, offerId, quantity",
        },
      ],
    };
  }

  const rows: Partial<InventoryRow>[] = [];
  const errors: { line: number; reason: string }[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const lineNumber = i + 1;
    const row = matrix[i];

    const storeCode = (row[indexByColumn.storeCode] || "").trim();
    const offerId = (row[indexByColumn.offerId] || "").trim();
    const quantityRaw = (row[indexByColumn.quantity] || "").trim();

    if (!storeCode || !offerId) {
      errors.push({ line: lineNumber, reason: "storeCode ou offerId vide" });
      continue;
    }
    if (!knownStoreCodes.has(storeCode)) {
      errors.push({ line: lineNumber, reason: `Magasin "${storeCode}" inconnu (créez-le d'abord)` });
      continue;
    }
    const quantity = Number(quantityRaw);
    if (!Number.isFinite(quantity) || quantity < 0) {
      errors.push({ line: lineNumber, reason: `Quantité invalide "${quantityRaw}"` });
      continue;
    }

    const availability =
      indexByColumn.availability != null
        ? (row[indexByColumn.availability] || "").trim().toLowerCase() || null
        : null;
    if (availability && !VALID_AVAILABILITIES.includes(availability)) {
      errors.push({ line: lineNumber, reason: `availability invalide "${availability}"` });
      continue;
    }
    const pickupMethod =
      indexByColumn.pickupMethod != null
        ? (row[indexByColumn.pickupMethod] || "").trim().toLowerCase() || null
        : null;
    if (pickupMethod && !VALID_PICKUP_METHODS.includes(pickupMethod)) {
      errors.push({ line: lineNumber, reason: `pickupMethod invalide "${pickupMethod}"` });
      continue;
    }
    const pickupSla =
      indexByColumn.pickupSla != null
        ? (row[indexByColumn.pickupSla] || "").trim().toLowerCase() || null
        : null;
    if (pickupSla && !VALID_PICKUP_SLAS.includes(pickupSla)) {
      errors.push({ line: lineNumber, reason: `pickupSla invalide "${pickupSla}"` });
      continue;
    }

    const priceRaw = indexByColumn.price != null ? (row[indexByColumn.price] || "").trim() : "";
    const salePriceRaw = indexByColumn.salePrice != null ? (row[indexByColumn.salePrice] || "").trim() : "";
    const price = priceRaw ? Number(priceRaw) : null;
    const salePrice = salePriceRaw ? Number(salePriceRaw) : null;
    if (price != null && (!Number.isFinite(price) || price < 0)) {
      errors.push({ line: lineNumber, reason: `Prix invalide "${priceRaw}"` });
      continue;
    }
    if (salePrice != null && (!Number.isFinite(salePrice) || salePrice < 0)) {
      errors.push({ line: lineNumber, reason: `Sale price invalide "${salePriceRaw}"` });
      continue;
    }

    rows.push({
      storeCode,
      offerId,
      quantity,
      availability,
      price,
      salePrice,
      pickupMethod,
      pickupSla,
    });
  }

  return { rows, errors };
}

const CSV_TEMPLATE = `storeCode,offerId,quantity,availability,price,salePrice,pickupMethod,pickupSla
STORE_PARIS_01,SKU-001,12,in stock,49.90,,buy,same day
STORE_PARIS_01,SKU-002,0,out of stock,,,reserve,next day
STORE_LYON_02,SKU-001,5,limited availability,49.90,39.90,buy,same day
`;

/**
 * Gestion de l'inventaire local par magasin × produit pour Google Local
 * Inventory Ads (LIA).
 *
 * Permet au merchant d'uploader son stock magasin via CSV (cas le plus
 * fréquent : export depuis le système caisse/ERP) puis de visualiser /
 * filtrer / supprimer les lignes ligne par ligne.
 *
 * L'éditeur unitaire (saisie produit par produit dans un tableau) n'est
 * volontairement pas fait dans cette v1 : au-delà d'une centaine de
 * lignes, c'est ingérable. Le CSV reste l'interface naturelle pour
 * synchroniser avec l'ERP magasin.
 */
export function LocalInventoryPanel() {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterStoreCode, setFilterStoreCode] = useState<string>("");
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const knownStoreCodes = useMemo(() => new Set(stores.map((s) => s.storeCode)), [stores]);

  const loadStores = useCallback(async () => {
    try {
      const res = await apiClient.get<{ stores: StoreOption[] }>("/platforms/lia/stores");
      setStores(res.data.stores || []);
    } catch (err) {
      setError(getErrorMessage(err, "Erreur lors du chargement des magasins"));
    }
  }, []);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const query = filterStoreCode ? `?storeCode=${encodeURIComponent(filterStoreCode)}` : "";
      const res = await apiClient.get<{ inventory: InventoryRow[] }>(`/platforms/lia/inventory${query}`);
      setInventory(res.data.inventory || []);
    } catch (err) {
      setError(getErrorMessage(err, "Erreur lors du chargement de l'inventaire"));
    } finally {
      setLoading(false);
    }
  }, [filterStoreCode]);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const onFilePicked = useCallback(
    async (file: File) => {
      setError(null);
      setSuccess(null);
      const text = await file.text();
      const result = buildInventoryPreview(text, knownStoreCodes);
      setPreview(result);
    },
    [knownStoreCodes]
  );

  const onImport = useCallback(async () => {
    if (!preview || preview.rows.length === 0) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiClient.post<{ message: string; upserted: number }>(
        "/platforms/lia/inventory",
        { rows: preview.rows }
      );
      setSuccess(res.data.message || `${preview.rows.length} ligne(s) importée(s)`);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadInventory();
    } catch (err) {
      setError(getErrorMessage(err, "Échec de l'import"));
    } finally {
      setUploading(false);
    }
  }, [preview, loadInventory]);

  const onDelete = useCallback(
    async (row: InventoryRow) => {
      const key = `${row.storeCode}::${row.offerId}`;
      setDeletingKey(key);
      setError(null);
      try {
        await apiClient.delete(
          `/platforms/lia/inventory/${encodeURIComponent(row.storeCode)}/${encodeURIComponent(row.offerId)}`
        );
        setInventory((curr) => curr.filter((r) => !(r.storeCode === row.storeCode && r.offerId === row.offerId)));
      } catch (err) {
        setError(getErrorMessage(err, "Erreur lors de la suppression"));
      } finally {
        setDeletingKey(null);
      }
    },
    []
  );

  const downloadTemplate = useCallback(() => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feedplug-lia-template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, []);

  const inventoryByStore = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of inventory) {
      counts.set(row.storeCode, (counts.get(row.storeCode) || 0) + 1);
    }
    return counts;
  }, [inventory]);

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Boxes size={20} />
        <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Inventaire local par magasin</h3>
      </div>
      <p style={{ color: "var(--app-text-secondary)", fontSize: 14, lineHeight: 1.55, marginBottom: 20 }}>
        Renseignez la quantité disponible de chaque produit dans chaque magasin physique pour activer les
        Local Inventory Ads sur Google Shopping. Le flux LIA est ensuite généré automatiquement et peut être
        connecté à Google Merchant Center.
      </p>

      {stores.length === 0 ? (
        <div
          style={{
            padding: "16px 18px",
            background: "var(--paper-2)",
            borderRadius: 12,
            border: "1px solid var(--app-border)",
            color: "var(--app-text-secondary)",
            fontSize: 14,
          }}
        >
          Vous devez d&apos;abord créer au moins un magasin dans la section « Magasins » au-dessus avant de
          pouvoir importer un inventaire.
        </div>
      ) : null}

      {/* === Upload CSV === */}
      <div style={{ marginBottom: 24, opacity: stores.length === 0 ? 0.5 : 1 }}>
        <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 600 }}>Importer un CSV</h4>
        <p style={{ color: "var(--app-text-secondary)", fontSize: 13, marginBottom: 12 }}>
          Colonnes attendues : <code>storeCode, offerId, quantity, availability, price, salePrice, pickupMethod, pickupSla</code>.
          Le séparateur peut être virgule, point-virgule ou tabulation.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            disabled={stores.length === 0 || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFilePicked(file);
            }}
            style={{ ...inputStyle, padding: 8 }}
          />
          <button onClick={downloadTemplate} style={buttonSecondary} type="button">
            <Download size={14} /> Modèle CSV
          </button>
        </div>

        {preview ? (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              background: "var(--paper-2)",
              borderRadius: 12,
              border: "1px solid var(--app-border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 14 }}>
                <strong>{preview.rows.length}</strong> ligne(s) prête(s) à importer
                {preview.errors.length > 0 ? (
                  <span style={{ color: "var(--app-danger, #b91c1c)", marginLeft: 12 }}>
                    {preview.errors.length} erreur(s) ignorée(s)
                  </span>
                ) : null}
              </div>
              <button
                style={{ ...buttonPrimary, opacity: preview.rows.length === 0 ? 0.5 : 1 }}
                disabled={preview.rows.length === 0 || uploading}
                onClick={() => void onImport()}
              >
                <Upload size={14} />
                {uploading ? "Import…" : `Importer ${preview.rows.length} ligne(s)`}
              </button>
            </div>
            {preview.errors.length > 0 ? (
              <details style={{ marginTop: 12, fontSize: 13, color: "var(--app-text-secondary)" }}>
                <summary style={{ cursor: "pointer" }}>Voir les erreurs ({preview.errors.length})</summary>
                <ul style={{ margin: "8px 0 0 16px", padding: 0, maxHeight: 200, overflow: "auto" }}>
                  {preview.errors.slice(0, 50).map((err, idx) => (
                    <li key={idx}>
                      Ligne {err.line} : {err.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>

      {success ? (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            color: "rgb(21, 128, 61)",
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          {success}
        </div>
      ) : null}
      {error ? (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "rgb(185, 28, 28)",
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      ) : null}

      {/* === Listing === */}
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
            Inventaire actuel{loading ? "…" : ` (${inventory.length})`}
          </h4>
          <select
            value={filterStoreCode}
            onChange={(e) => setFilterStoreCode(e.target.value)}
            style={inputStyle}
          >
            <option value="">Tous les magasins</option>
            {stores.map((s) => (
              <option key={s.storeCode} value={s.storeCode}>
                {s.storeCode}
                {s.name ? ` — ${s.name}` : ""}
                {inventoryByStore.get(s.storeCode) ? ` (${inventoryByStore.get(s.storeCode)})` : ""}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p style={{ color: "var(--app-text-secondary)", fontSize: 14 }}>Chargement…</p>
        ) : inventory.length === 0 ? (
          <p style={{ color: "var(--app-text-secondary)", fontSize: 14 }}>
            Aucune ligne d&apos;inventaire pour l&apos;instant. Importez un CSV pour démarrer.
          </p>
        ) : (
          <div style={{ overflow: "auto", border: "1px solid var(--app-border)", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "var(--paper-2)" }}>
                <tr>
                  <th style={tdStyle}>Magasin</th>
                  <th style={tdStyle}>Produit (offerId)</th>
                  <th style={{ ...tdStyle, textAlign: "right" }}>Quantité</th>
                  <th style={tdStyle}>Disponibilité</th>
                  <th style={{ ...tdStyle, textAlign: "right" }}>Prix</th>
                  <th style={tdStyle}>Retrait</th>
                  <th style={tdStyle}></th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((row) => {
                  const key = `${row.storeCode}::${row.offerId}`;
                  return (
                    <tr key={key} style={{ borderTop: "1px solid var(--app-border)" }}>
                      <td style={tdStyle}>{row.storeCode}</td>
                      <td style={{ ...tdStyle, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>{row.offerId}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{row.quantity}</td>
                      <td style={tdStyle}>{row.availability || "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {row.price != null ? (
                          <>
                            {row.price.toFixed(2)} €
                            {row.salePrice != null ? (
                              <span style={{ color: "var(--app-text-secondary)", marginLeft: 4 }}>
                                / {row.salePrice.toFixed(2)} €
                              </span>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={tdStyle}>
                        {row.pickupMethod || "—"}
                        {row.pickupSla ? ` · ${row.pickupSla}` : ""}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button
                          onClick={() => void onDelete(row)}
                          disabled={deletingKey === key}
                          style={{ ...buttonSecondary, padding: "6px 10px", color: "var(--app-danger, #b91c1c)" }}
                          aria-label={`Supprimer ${row.offerId} de ${row.storeCode}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  verticalAlign: "middle",
};
