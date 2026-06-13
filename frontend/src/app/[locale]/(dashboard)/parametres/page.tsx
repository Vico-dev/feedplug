"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  User,
  Bell,
  Shield,
  Key,
  Database,
  MapPin,
  Save,
  Edit,
  X,
  Users,
  Mail,
  UserPlus,
} from "lucide-react";
import { StoreLocationsPanel } from "@/components/lia/store-locations-panel";
import { LocalInventoryPanel } from "@/components/lia/local-inventory-panel";
import { FeedUrlPanel } from "@/components/lia/feed-url-panel";
import {
  DashboardStatGrid,
  DashboardStatCard,
  PageButtonPrimary,
  PageButtonSecondary,
  PageError,
  PageHeader,
  PageLayout,
  PageLoading,
} from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api";

type TabId = "profile" | "notifications" | "security" | "integrations" | "billing" | "team" | "stores";

interface Account {
  id: string;
  name: string;
  plan?: string;
  users?: AccountUser[];
}

interface AccountUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status?: string;
  lastLoginAt?: string | null;
  createdAt: string;
}

interface ApiErrorMessage {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const apiError = error as ApiErrorMessage;
    return apiError.response?.data?.message || apiError.message || fallback;
  }
  return fallback;
}


const baseInputStyle = {
  width: "100%" as const,
  padding: "12px",
  border: "1px solid var(--app-border)",
  borderRadius: "12px",
  fontSize: "14px",
  backgroundColor: "#fff",
  color: "var(--app-text)",
  outline: "none",
  transition: "border-color 0.2s ease",
};

const panelStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "18px",
  border: "1px solid var(--app-border)",
  boxShadow: "var(--card-shadow)",
};

export default function ParametresPage() {
  const t = useTranslations("dashboard");
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [account, setAccount] = useState<Account | null>(null);
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", accountName: "" });
  const [inviteForm, setInviteForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "VIEWER" as "OWNER" | "MANAGER" | "VIEWER" | "AGENCY",
  });
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [roleEdit, setRoleEdit] = useState<{ userId: string; currentRole: string; userName: string } | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<{ userId: string; userName: string } | null>(null);
  const [removeSending, setRemoveSending] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [changePasswordSending, setChangePasswordSending] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get<Account>("/accounts");
      setAccount(res.data);
      if (res.data.users) setUsers(res.data.users);
      return res.data;
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Erreur lors du chargement du compte");
      setError(msg);
      // Fallback : utiliser les infos du user (auth/me) pour afficher le formulaire
      if (user) {
        setAccount({
          id: user.accountId || "",
          name: user.account?.name || "",
        });
      }
      return null;
    }
  }, [user]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await apiClient.get<AccountUser[]>("/accounts/users");
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const acc = await loadAccount();
      if (!cancelled && acc?.users) setUsers(acc.users);
      if (!cancelled && !acc && user) {
        setAccount({ id: user.accountId || "", name: user.account?.name || "" });
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadAccount, user]);

  useEffect(() => {
    if (activeTab === "team" && account && users.length === 0 && !loading) {
      void loadUsers();
    }
  }, [activeTab, account, loadUsers, loading, users.length]);

  useEffect(() => {
    setProfileForm((current) => {
      const next = {
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        accountName: account?.name || user?.account?.name || "",
      };
      if (
        current.firstName === next.firstName &&
        current.lastName === next.lastName &&
        current.accountName === next.accountName
      ) {
        return current;
      }
      return next;
    });
  }, [account?.name, user?.account?.name, user?.firstName, user?.lastName]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    setError(null);
    try {
      await apiClient.put("/accounts/users/me", {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
      });
      if (profileForm.accountName && (account?.id || user?.accountId)) {
        await apiClient.put("/accounts", { name: profileForm.accountName });
      }
      await refreshUser();
      await loadAccount();
      setProfileEditing(false);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Erreur lors de la sauvegarde"));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMessage(null);
    if (!inviteForm.email.trim()) {
      setInviteMessage({ type: "error", text: "L'email est requis." });
      return;
    }
    setInviteSending(true);
    try {
      await apiClient.post("/accounts/users/invite", inviteForm);
      setInviteMessage({ type: "success", text: "Invitation envoyée. L'utilisateur pourra rejoindre l'équipe." });
      setInviteForm({ email: "", firstName: "", lastName: "", role: "VIEWER" });
      await loadUsers();
    } catch (err: unknown) {
      setInviteMessage({
        type: "error",
        text: getErrorMessage(err, "Impossible d'envoyer l'invitation."),
      });
    } finally {
      setInviteSending(false);
    }
  };

  const canInvite = user && ["OWNER", "MANAGER"].includes(user.role);
  const canManageRoles = user?.role === "OWNER";

  const handleUpdateRole = async (userId: string, role: string) => {
    setRoleSaving(true);
    setError(null);
    try {
      await apiClient.put(`/accounts/users/${userId}/role`, { role });
      setRoleEdit(null);
      await loadUsers();
      if (account?.users) await loadAccount();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Erreur lors du changement de rôle"));
    } finally {
      setRoleSaving(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    setRemoveSending(true);
    setError(null);
    try {
      await apiClient.delete(`/accounts/users/${userId}`);
      setRemoveConfirm(null);
      await loadUsers();
      if (account?.users) await loadAccount();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Erreur lors de la suppression"));
    } finally {
      setRemoveSending(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError(null);
    if (changePasswordForm.new !== changePasswordForm.confirm) {
      setChangePasswordError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (changePasswordForm.new.length < 8 || !/[A-Z]/.test(changePasswordForm.new) || !/[0-9]/.test(changePasswordForm.new)) {
      setChangePasswordError("Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.");
      return;
    }
    setChangePasswordSending(true);
    try {
      await apiClient.put("/auth/me/password", {
        currentPassword: changePasswordForm.current,
        newPassword: changePasswordForm.new,
      });
      setChangePasswordOpen(false);
      setChangePasswordForm({ current: "", new: "", confirm: "" });
    } catch (e: unknown) {
      setChangePasswordError(getErrorMessage(e, "Erreur lors du changement de mot de passe"));
    } finally {
      setChangePasswordSending(false);
    }
  };

  const tabs: { id: TabId; labelKey: string; icon: typeof User }[] = [
    { id: "profile", labelKey: "parametres.tabProfile", icon: User },
    { id: "notifications", labelKey: "parametres.tabNotifications", icon: Bell },
    { id: "security", labelKey: "parametres.tabSecurity", icon: Shield },
    { id: "integrations", labelKey: "parametres.tabIntegrations", icon: Database },
    { id: "billing", labelKey: "parametres.tabBilling", icon: Settings },
    { id: "team", labelKey: "parametres.tabTeam", icon: Users },
    { id: "stores", labelKey: "parametres.tabStores", icon: MapPin },
  ];
  const ROLE_LABELS: Record<string, string> = {
    OWNER: t("parametres.owner"),
    MANAGER: t("parametres.manager"),
    VIEWER: t("parametres.viewer"),
    AGENCY: t("parametres.agency"),
  };

  return (
    <PageLayout>
      <PageHeader
        title={t("nav.settings")}
        subtitle={t("parametres.subtitle")}
      />

      <DashboardStatGrid>
        <DashboardStatCard icon={<User size={20} />} label="Compte" value={account?.name || user?.account?.name || "Mon compte"} hint={user?.email || "Profil utilisateur"} accent="var(--ink)" />
        <DashboardStatCard icon={<Users size={20} />} label="Membres" value={users.length || 1} hint={canInvite ? "Invitations disponibles" : "Gestion limitee selon votre role"} accent="var(--ink)" />
        <DashboardStatCard icon={<Shield size={20} />} label="Securite" value="Active" hint="Acces, mot de passe et roles centralises ici" accent="var(--ink)" />
      </DashboardStatGrid>

      <div
        style={{
          display: "flex",
          gap: "8px",
          margin: "24px 0 32px",
          padding: "4px",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          border: "1px solid var(--app-border)",
          boxShadow: "var(--card-shadow)",
          width: "fit-content",
          flexWrap: "wrap",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 16px",
              backgroundColor: activeTab === tab.id ? "var(--app-text)" : "transparent",
              color: activeTab === tab.id ? "white" : "var(--ink-3)",
              border: "none",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = "var(--paper-2)";
                e.currentTarget.style.color = "var(--ink-2)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--ink-3)";
              }
            }}
          >
            <tab.icon style={{ width: "16px", height: "16px" }} />
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {error && (
        <PageError message={error} style={{ marginBottom: "16px" }} />
      )}

      {loading && !account ? (
        <PageLoading message={t("parametres.loading")} style={{ minHeight: "40vh" }} />
      ) : (
        <>
          {activeTab === "profile" && (
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
              <div style={panelStyle}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "24px",
                  }}
                >
                  <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#0a0a0a", margin: 0 }}>
                    Informations du profil
                  </h2>
                  {!profileEditing ? (
                    <button type="button" onClick={() => setProfileEditing(true)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", backgroundColor: "transparent", color: "var(--ink-3)", border: "1px solid var(--app-border)", borderRadius: "12px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                      <Edit style={{ width: "14px", height: "14px" }} />
                      Modifier
                    </button>
                  ) : null}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div
                      style={{
                        width: "80px",
                        height: "80px",
                        backgroundColor: "var(--paper-2)",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid var(--line)",
                      }}
                    >
                      <User style={{ width: "32px", height: "32px", color: "var(--ink-4)" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: "14px", color: "var(--ink-2)", margin: 0 }}>
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--ink-3)", margin: "4px 0 0 0" }}>
                        {user?.email}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "var(--ink-2)", marginBottom: "6px" }}>
                        Prénom
                      </label>
                      <input
                        type="text"
                        value={profileForm.firstName}
                        onChange={(e) => setProfileForm((p) => ({ ...p, firstName: e.target.value }))}
                        disabled={!profileEditing}
                        style={baseInputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "var(--ink-2)", marginBottom: "6px" }}>
                        Nom
                      </label>
                      <input
                        type="text"
                        value={profileForm.lastName}
                        onChange={(e) => setProfileForm((p) => ({ ...p, lastName: e.target.value }))}
                        disabled={!profileEditing}
                        style={baseInputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "var(--ink-2)", marginBottom: "6px" }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={user?.email ?? ""}
                      disabled
                      style={{ ...baseInputStyle, backgroundColor: "var(--paper-2)", color: "var(--ink-3)" }}
                    />
                    <p style={{ fontSize: "12px", color: "var(--ink-3)", margin: "4px 0 0 0" }}>
                      L&apos;email ne peut pas être modifié ici.
                    </p>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "var(--ink-2)", marginBottom: "6px" }}>
                      Entreprise
                    </label>
                    <input
                      type="text"
                      value={profileForm.accountName}
                      onChange={(e) => setProfileForm((p) => ({ ...p, accountName: e.target.value }))}
                      disabled={!profileEditing}
                      style={baseInputStyle}
                    />
                  </div>

                  {profileEditing && (
                    <div style={{ display: "flex", gap: "12px", paddingTop: "16px", borderTop: "1px solid var(--paper-2)" }}>
                      <PageButtonPrimary onClick={handleSaveProfile} disabled={profileSaving}>
                        <Save style={{ width: "16px", height: "16px" }} />
                        {profileSaving ? t("common.saving") : t("common.save")}
                      </PageButtonPrimary>
                      <PageButtonSecondary
                        onClick={() => {
                          setProfileEditing(false);
                          setProfileForm({
                            firstName: user?.firstName ?? "",
                            lastName: user?.lastName ?? "",
                            accountName: account?.name ?? "",
                          });
                        }}
                        disabled={profileSaving}
                      >
                        <X style={{ width: "16px", height: "16px" }} />
                        {t("common.cancel")}
                      </PageButtonSecondary>
                    </div>
                  )}
                </div>
              </div>

              <div style={panelStyle}>
                <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#0a0a0a", margin: "0 0 24px 0" }}>
                  Sécurité
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div>
                    <h3 style={{ fontSize: "14px", fontWeight: "500", color: "var(--ink-2)", margin: "0 0 12px 0" }}>
                      Mot de passe
                    </h3>
                    <button type="button" style={{ width: "100%", minHeight: 44, backgroundColor: "transparent", color: "var(--accent)", border: "1px solid var(--accent-bg)", borderRadius: "12px", fontSize: "14px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }} onClick={() => setChangePasswordOpen(true)}>
                      <Key style={{ width: "16px", height: "16px" }} />
                      Changer le mot de passe
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "team" && (
            <div style={panelStyle}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#0a0a0a", margin: "0 0 8px 0" }}>
                Équipe
              </h2>
              <p style={{ fontSize: "14px", color: "var(--ink-3)", margin: "0 0 24px 0" }}>
                Invitez des collaborateurs et gérez les accès à votre compte.
              </p>

              {canInvite && (
                <div
                  style={{
                    marginBottom: "24px",
                    padding: "20px",
                    border: "1px solid var(--app-border)",
                    borderRadius: "16px",
                    backgroundColor: "#fafafa",
                  }}
                >
                  <h3 style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink-2)", margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                    <UserPlus style={{ width: "18px", height: "18px" }} />
                    Inviter un membre
                  </h3>
                  <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "var(--ink-2)", marginBottom: "4px" }}>Prénom</label>
                        <input
                          type="text"
                          value={inviteForm.firstName}
                          onChange={(e) => setInviteForm((f) => ({ ...f, firstName: e.target.value }))}
                          style={baseInputStyle}
                          placeholder="Jean"
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "var(--ink-2)", marginBottom: "4px" }}>Nom</label>
                        <input
                          type="text"
                          value={inviteForm.lastName}
                          onChange={(e) => setInviteForm((f) => ({ ...f, lastName: e.target.value }))}
                          style={baseInputStyle}
                          placeholder="Dupont"
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "var(--ink-2)", marginBottom: "4px" }}>Email *</label>
                      <input
                        type="email"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                        style={baseInputStyle}
                        placeholder="jean.dupont@exemple.fr"
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "var(--ink-2)", marginBottom: "4px" }}>Rôle</label>
                      <select
                        value={inviteForm.role}
                        onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value as typeof inviteForm.role }))}
                        style={baseInputStyle}
                      >
                        <option value="VIEWER">Lecteur</option>
                        <option value="MANAGER">Manager</option>
                        <option value="AGENCY">Agence</option>
                        <option value="OWNER">Propriétaire</option>
                      </select>
                    </div>
                    {inviteMessage && (
                      <p
                        style={{
                          fontSize: "13px",
                          margin: 0,
                          color: inviteMessage.type === "error" ? "var(--danger)" : "var(--success)",
                        }}
                      >
                        {inviteMessage.text}
                      </p>
                    )}
                    <PageButtonPrimary type="submit" disabled={inviteSending}>
                      <Mail style={{ width: "16px", height: "16px" }} />
                      {inviteSending ? t("common.sending") : t("parametres.sendInvitation")}
                    </PageButtonPrimary>
                  </form>
                </div>
              )}

              {!canInvite && (
                <p style={{ fontSize: "14px", color: "var(--ink-3)", marginBottom: "24px" }}>
                  Seuls les propriétaires et managers peuvent inviter de nouveaux membres.
                </p>
              )}

              <h3 style={{ fontSize: "14px", fontWeight: "600", color: "var(--ink-2)", margin: "0 0 12px 0" }}>
                Membres du compte
              </h3>
              <div style={{ border: "1px solid var(--line)", borderRadius: "2px", overflow: "hidden" }}>
                {users.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--ink-3)" }}>
                    Aucun autre membre pour le moment.
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {users.map((u) => (
                      <li
                        key={u.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px 16px",
                          borderBottom: "1px solid var(--paper-2)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "50%",
                              backgroundColor: "var(--line)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "14px",
                              fontWeight: "600",
                              color: "var(--ink-2)",
                            }}
                          >
                            {(u.firstName?.[0] || u.email[0]).toUpperCase()}
                            {(u.lastName?.[0] || "").toUpperCase()}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0a0a0a" }}>
                              {u.firstName} {u.lastName}
                            </p>
                            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--ink-3)" }}>
                              {u.email} • {ROLE_LABELS[u.role] || u.role}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {u.id === user?.id ? (
                            <span style={{ fontSize: "12px", color: "var(--ink-3)", fontWeight: "500" }}>Vous</span>
                          ) : canManageRoles ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setRoleEdit({ userId: u.id, currentRole: u.role, userName: `${u.firstName} ${u.lastName}`.trim() || u.email })}
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "12px",
                                  fontWeight: "500",
                                  color: "var(--ink-2)",
                                  backgroundColor: "var(--paper-2)",
                                  border: "1px solid var(--line)",
                                  borderRadius: "2px",
                                  cursor: "pointer",
                                }}
                              >
                                Changer le rôle
                              </button>
                              <button
                                type="button"
                                onClick={() => setRemoveConfirm({ userId: u.id, userName: `${u.firstName} ${u.lastName}`.trim() || u.email })}
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "12px",
                                  fontWeight: "500",
                                  color: "var(--danger)",
                                  backgroundColor: "transparent",
                                  border: "1px solid var(--danger)",
                                  borderRadius: "2px",
                                  cursor: "pointer",
                                }}
                              >
                                Retirer
                              </button>
                            </>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === "stores" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <StoreLocationsPanel />
              <LocalInventoryPanel />
              <FeedUrlPanel />
            </div>
          )}

          {(activeTab === "notifications" || activeTab === "integrations" || activeTab === "billing") && (
            <div style={{ ...panelStyle, padding: "48px", textAlign: "center", color: "var(--ink-3)" }}>
              <p style={{ margin: 0 }}>Cette section sera bientôt disponible.</p>
            </div>
          )}

          {activeTab === "security" && (
            <div style={panelStyle}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#0a0a0a", margin: "0 0 24px 0" }}>
                Sécurité
              </h2>
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: "500", color: "var(--ink-2)", margin: "0 0 12px 0" }}>
                  Mot de passe
                </h3>
                <button
                  type="button"
                  style={{
                    padding: "12px",
                    backgroundColor: "transparent",
                    color: "var(--accent)",
                    border: "1px solid var(--accent)",
                    borderRadius: "2px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  onClick={() => setChangePasswordOpen(true)}
                >
                  <Key style={{ width: "16px", height: "16px" }} />
                  Changer le mot de passe
                </button>
              </div>
            </div>
          )}

          {/* Modal Changer le rôle */}
          {roleEdit && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
              }}
              onClick={() => !roleSaving && setRoleEdit(null)}
            >
              <div
                style={{
                  backgroundColor: "white",
                  padding: "24px",
                  borderRadius: "8px",
                  maxWidth: "400px",
                  width: "100%",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "600" }}>Changer le rôle</h3>
                <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--ink-3)" }}>{roleEdit.userName}</p>
                <select
                  defaultValue={roleEdit.currentRole}
                  id="role-select"
                  style={baseInputStyle}
                >
                  {(["VIEWER", "MANAGER", "AGENCY", "OWNER"] as const).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: "8px", marginTop: "16px", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setRoleEdit(null)} disabled={roleSaving} style={{ padding: "8px 16px", border: "1px solid var(--line)", borderRadius: "2px", cursor: "pointer" }}>{t("common.cancel")}</button>
                  <button
                    type="button"
                    disabled={roleSaving}
                    onClick={() => {
                      const sel = document.getElementById("role-select") as HTMLSelectElement;
                      if (sel) handleUpdateRole(roleEdit.userId, sel.value);
                    }}
                    style={{ padding: "8px 16px", backgroundColor: "#0a0a0a", color: "white", border: "none", borderRadius: "2px", cursor: roleSaving ? "not-allowed" : "pointer" }}
                  >
                    {roleSaving ? t("common.saving") : t("parametres.register")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Confirmer retrait */}
          {removeConfirm && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
              }}
              onClick={() => !removeSending && setRemoveConfirm(null)}
            >
              <div
                style={{
                  backgroundColor: "white",
                  padding: "24px",
                  borderRadius: "8px",
                  maxWidth: "400px",
                  width: "100%",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "600" }}>Retirer du compte</h3>
                <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--ink-3)" }}>
                  Êtes-vous sûr de vouloir retirer <strong>{removeConfirm.userName}</strong> du compte ? Il ne pourra plus accéder au tableau de bord.
                </p>
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setRemoveConfirm(null)} disabled={removeSending} style={{ padding: "8px 16px", border: "1px solid var(--line)", borderRadius: "2px", cursor: "pointer" }}>{t("common.cancel")}</button>
                  <button
                    type="button"
                    disabled={removeSending}
                    onClick={() => handleRemoveUser(removeConfirm.userId)}
                    style={{ padding: "8px 16px", backgroundColor: "var(--danger)", color: "white", border: "none", borderRadius: "2px", cursor: removeSending ? "not-allowed" : "pointer" }}
                  >
                    {removeSending ? "Suppression…" : "Retirer"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Changer mot de passe */}
          {changePasswordOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
              }}
              onClick={() => !changePasswordSending && setChangePasswordOpen(false)}
            >
              <div
                style={{
                  backgroundColor: "white",
                  padding: "24px",
                  borderRadius: "8px",
                  maxWidth: "400px",
                  width: "100%",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "600" }}>Changer le mot de passe</h3>
                <form onSubmit={handleChangePasswordSubmit}>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>Mot de passe actuel</label>
                    <input
                      type="password"
                      value={changePasswordForm.current}
                      onChange={(e) => setChangePasswordForm((f) => ({ ...f, current: e.target.value }))}
                      required
                      style={baseInputStyle}
                    />
                  </div>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>Nouveau mot de passe</label>
                    <input
                      type="password"
                      value={changePasswordForm.new}
                      onChange={(e) => setChangePasswordForm((f) => ({ ...f, new: e.target.value }))}
                      required
                      minLength={8}
                      style={baseInputStyle}
                    />
                    <p style={{ fontSize: "12px", color: "var(--ink-3)", margin: "4px 0 0 0" }}>8+ caractères, 1 majuscule, 1 chiffre</p>
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>Confirmer le nouveau mot de passe</label>
                    <input
                      type="password"
                      value={changePasswordForm.confirm}
                      onChange={(e) => setChangePasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                      required
                      style={baseInputStyle}
                    />
                  </div>
                  {changePasswordError && <p style={{ color: "var(--danger)", fontSize: "13px", margin: "0 0 12px 0" }}>{changePasswordError}</p>}
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => setChangePasswordOpen(false)} disabled={changePasswordSending} style={{ padding: "8px 16px", border: "1px solid var(--line)", borderRadius: "2px", cursor: "pointer" }}>{t("common.cancel")}</button>
                    <button type="submit" disabled={changePasswordSending} style={{ padding: "8px 16px", backgroundColor: "#0a0a0a", color: "white", border: "none", borderRadius: "2px", cursor: changePasswordSending ? "not-allowed" : "pointer" }}>
                      {changePasswordSending ? t("common.saving") : t("parametres.changePassword")}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
