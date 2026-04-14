"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import {
  Search,
  Building2,
  Users,
  Database,
  FileText,
  Calendar,
  Mail,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
} from "lucide-react";
import {
  PageLayout,
  PageHeader,
  PageLoading,
  PageError,
} from "@/components/layout";

interface Account {
  id: string;
  name: string;
  plan: string;
  email: string | null;
  trialEndsAt: string | null;
  addonIA?: boolean;
  createdAt: string;
  updatedAt: string;
  usersCount: number;
  sourcesCount: number;
  feedsCount: number;
}

interface AdminAccountsResponse {
  accounts: Account[];
  total: number;
  totalPages: number;
}

interface AdminMessageResponse {
  message?: string;
}

interface AdminApiError {
  message?: string;
  response?: {
    data?: AdminMessageResponse;
  };
}

function getAdminErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const apiError = error as AdminApiError;
    return apiError.response?.data?.message || apiError.message || fallback;
  }
  return fallback;
}

export default function AdminAccountsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [modalPlan, setModalPlan] = useState<string>("STARTER");
  const [modalAddonIA, setModalAddonIA] = useState<boolean>(false);
  const [extendTrialMonths, setExtendTrialMonths] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user?.isStaff) {
      router.replace("/dashboard");
    }
  }, [authLoading, user?.isStaff, router]);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (searchTerm) params.set("search", searchTerm);
      const response = await apiClient.get<AdminAccountsResponse>(`/admin/accounts?${params}`);
      setAccounts(response.data.accounts || []);
      setTotal(response.data.total || 0);
      setTotalPages(response.data.totalPages || 1);
    } catch (err: unknown) {
      console.error("Error fetching accounts:", err);
      setError(getAdminErrorMessage(err, "Erreur lors du chargement des comptes"));
    } finally {
      setLoading(false);
    }
  }, [limit, page, searchTerm]);

  useEffect(() => {
    if (user?.isStaff) {
      void fetchAccounts();
    }
  }, [fetchAccounts, user?.isStaff]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchInput.trim());
    setPage(1);
  };

  const planLabels: Record<string, string> = {
    STARTER: "Starter",
    PROFESSIONAL: "Pro",
    ENTERPRISE: "Enterprise",
  };

  const PLAN_IDS = ["STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;

  const openPlanModal = (account: Account) => {
    setEditingAccount(account);
    setModalPlan(account.plan || "STARTER");
    setModalAddonIA(!!account.addonIA);
    setExtendTrialMonths(0);
    setSaveError(null);
  };

  const closePlanModal = () => {
    setEditingAccount(null);
    setSaveError(null);
  };

  const applyAddonIAMigration = async () => {
    setMigrationLoading(true);
    setMigrationMessage(null);
    try {
      const res = await apiClient.post<AdminMessageResponse>("/admin/apply-addon-ia-migration", {});
      setMigrationMessage(res.data?.message || "Migration appliquée.");
      void fetchAccounts();
    } catch (err: unknown) {
      setMigrationMessage(getAdminErrorMessage(err, "Erreur lors de la migration"));
    } finally {
      setMigrationLoading(false);
    }
  };

  const handleSavePlan = async () => {
    if (!editingAccount) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body: { plan?: string; trialEndsAt?: string | null; addonIA?: boolean } = {};
      body.plan = modalPlan;
      body.addonIA = modalAddonIA;
      if (extendTrialMonths > 0) {
        const base = editingAccount.trialEndsAt
          ? new Date(editingAccount.trialEndsAt)
          : new Date();
        if (base.getTime() < Date.now()) base.setTime(Date.now());
        base.setMonth(base.getMonth() + extendTrialMonths);
        body.trialEndsAt = base.toISOString();
      }
      await apiClient.patch(`/admin/accounts/${editingAccount.id}`, body);
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editingAccount.id
            ? {
                ...a,
                plan: modalPlan,
                addonIA: modalAddonIA,
                trialEndsAt: body.trialEndsAt ?? a.trialEndsAt,
              }
            : a
        )
      );
      closePlanModal();
    } catch (err: unknown) {
      setSaveError(getAdminErrorMessage(err, "Erreur lors de la mise à jour"));
    } finally {
      setSaving(false);
    }
  };

  if (!authLoading && !user?.isStaff) {
    return null;
  }

  if (loading && accounts.length === 0) {
    return (
      <PageLayout>
        <PageLoading message="Chargement des comptes…" style={{ minHeight: "50vh" }} />
      </PageLayout>
    );
  }

  if (error && accounts.length === 0) {
    return (
      <PageLayout>
        <PageError message={error} onRetry={fetchAccounts} />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="Tous les comptes"
        subtitle={`${total} compte${total !== 1 ? "s" : ""} au total`}
      />

      {/* Barre de recherche */}
      <form
        onSubmit={handleSearch}
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "24px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", flex: "1", minWidth: "280px" }}>
          <Search
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "18px",
              height: "18px",
              color: "#9ca3af",
            }}
          />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px 10px 40px",
              border: "1px solid #e5e7eb",
              borderRadius: "2px",
              fontSize: "14px",
              outline: "none",
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: "10px 20px",
            backgroundColor: "#0a0a0a",
            color: "#ffffff",
            border: "none",
            borderRadius: "2px",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer",
          }}
        >
          Rechercher
        </button>
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearchTerm("");
              setPage(1);
            }}
            style={{
              padding: "10px 16px",
              backgroundColor: "transparent",
              color: "#6b7280",
              border: "1px solid #e5e7eb",
              borderRadius: "2px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Réinitialiser
          </button>
        )}
      </form>

      {/* Migration Pack IA : ajouter la colonne addonia si elle n'existe pas */}
      <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={applyAddonIAMigration}
          disabled={migrationLoading}
          style={{
            padding: "8px 14px",
            fontSize: "13px",
            border: "1px solid #e5e7eb",
            borderRadius: "4px",
            background: "#fff",
            cursor: migrationLoading ? "not-allowed" : "pointer",
            color: "#374151",
          }}
        >
          {migrationLoading ? "Application…" : "Activer le Pack IA (appliquer la migration en base)"}
        </button>
        {migrationMessage && (
          <span style={{ fontSize: "13px", color: migrationMessage.startsWith("Erreur") ? "#dc2626" : "#16a34a" }}>
            {migrationMessage}
          </span>
        )}
      </div>

      {/* Tableau des comptes */}
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "2px",
          overflow: "hidden",
          boxShadow: "none",
        }}
      >
        {accounts.length === 0 ? (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            <Building2
              style={{
                width: "48px",
                height: "48px",
                margin: "0 auto 16px",
                opacity: 0.5,
              }}
            />
            <p>Aucun compte trouvé</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: "#f9fafb",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#6b7280",
                        textTransform: "uppercase",
                      }}
                    >
                      Compte
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#6b7280",
                        textTransform: "uppercase",
                      }}
                    >
                      Plan
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#6b7280",
                        textTransform: "uppercase",
                      }}
                    >
                      Utilisateurs
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#6b7280",
                        textTransform: "uppercase",
                      }}
                    >
                      Sources
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#6b7280",
                        textTransform: "uppercase",
                      }}
                    >
                      Flux
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#6b7280",
                        textTransform: "uppercase",
                      }}
                    >
                      Créé le
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr
                      key={account.id}
                      style={{ borderBottom: "1px solid #f3f4f6" }}
                    >
                      <td style={{ padding: "16px" }}>
                        <div>
                          <div
                            style={{
                              fontWeight: "500",
                              color: "#0a0a0a",
                              marginBottom: "4px",
                            }}
                          >
                            {account.name}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#6b7280",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <Mail size={12} />
                            {account.email || (
                              <span style={{ fontStyle: "italic" }}>
                                —
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#9ca3af",
                              marginTop: "4px",
                              fontFamily: "monospace",
                            }}
                          >
                            {account.id}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "2px",
                              fontSize: "12px",
                              fontWeight: "500",
                              backgroundColor: "#fafafa",
                              color: "#4a4a4a",
                              border: "1px solid #e5e7eb",
                            }}
                          >
                            {planLabels[account.plan] || account.plan}
                          </span>
                          <button
                            type="button"
                            onClick={() => openPlanModal(account)}
                            title="Changer le plan"
                            style={{
                              padding: "4px 8px",
                              border: "1px solid #e5e7eb",
                              borderRadius: "2px",
                              background: "#fff",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "12px",
                              color: "#6b7280",
                            }}
                          >
                            <Pencil size={14} />
                            Changer
                          </button>
                        </div>
                        {account.trialEndsAt && (
                          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                            Essai jusqu&apos;au {new Date(account.trialEndsAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 10px",
                            backgroundColor: "#f0fdf4",
                            borderRadius: "2px",
                          }}
                        >
                          <Users size={14} style={{ color: "#16a34a" }} />
                          <span style={{ fontWeight: "500" }}>
                            {account.usersCount}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 10px",
                            backgroundColor: "#eff6ff",
                            borderRadius: "2px",
                          }}
                        >
                          <Database size={14} style={{ color: "#2563eb" }} />
                          <span style={{ fontWeight: "500" }}>
                            {account.sourcesCount}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 10px",
                            backgroundColor: "#faf5ff",
                            borderRadius: "2px",
                          }}
                        >
                          <FileText size={14} style={{ color: "#7c3aed" }} />
                          <span style={{ fontWeight: "500" }}>
                            {account.feedsCount}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "16px", color: "#6b7280", fontSize: "14px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Calendar size={14} />
                          {new Date(account.createdAt).toLocaleDateString(
                            "fr-FR",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            }
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px",
                  borderTop: "1px solid #e5e7eb",
                  backgroundColor: "#fafafa",
                }}
              >
                <span style={{ fontSize: "14px", color: "#6b7280" }}>
                  Page {page} sur {totalPages} • {total} compte
                  {total !== 1 ? "s" : ""}
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "2px",
                      backgroundColor: "#ffffff",
                      cursor: page <= 1 ? "not-allowed" : "pointer",
                      opacity: page <= 1 ? 0.5 : 1,
                    }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "2px",
                      backgroundColor: "#ffffff",
                      cursor: page >= totalPages ? "not-allowed" : "pointer",
                      opacity: page >= totalPages ? 0.5 : 1,
                    }}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Changer le plan */}
      {editingAccount && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={closePlanModal}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "420px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
                Changer le plan — {editingAccount.name}
              </h3>
              <button
                type="button"
                onClick={closePlanModal}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  padding: "4px",
                  color: "#6b7280",
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "6px" }}>
                Plan
              </label>
              <select
                value={modalPlan}
                onChange={(e) => setModalPlan(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
              >
                {PLAN_IDS.map((id) => (
                  <option key={id} value={id}>
                    {planLabels[id]}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                id="modal-addon-ia"
                checked={modalAddonIA}
                onChange={(e) => setModalAddonIA(e.target.checked)}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <label htmlFor="modal-addon-ia" style={{ fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>
                Pack IA (génération titres + images)
              </label>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "6px" }}>
                Prolonger l&apos;essai
              </label>
              <select
                value={extendTrialMonths}
                onChange={(e) => setExtendTrialMonths(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
              >
                <option value={0}>Ne pas modifier la date d&apos;essai</option>
                <option value={1}>+ 1 mois à partir de maintenant (ou fin d&apos;essai actuelle)</option>
                <option value={2}>+ 2 mois</option>
                <option value={3}>+ 3 mois</option>
              </select>
            </div>
            {saveError && (
              <p style={{ color: "#dc2626", fontSize: "14px", marginBottom: "12px" }}>{saveError}</p>
            )}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={closePlanModal}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "4px",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSavePlan}
                disabled={saving}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  background: saving ? "#9ca3af" : "#0a0a0a",
                  color: "#fff",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontSize: "14px",
                }}
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
