"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Edit, Trash2, Key, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { PageLayout, PageHeader } from "@/components/layout/page-layout";

interface AIProvider {
  id: string;
  name: string;
  displayName: string;
  apiUrl: string;
  defaultModel: string;
  costPerToken: number;
  costPerOutputToken: number;
  isActive: boolean;
  providerKeys: AIProviderKey[];
}

interface AIProviderKey {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  monthlyLimit: number | null;
  dailyLimit: number | null;
  createdAt: string;
}

interface UsageStats {
  period: { start: string; end: string };
  stats: Array<Record<string, unknown>>;
  totals: {
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
  };
}

interface ApiErrorMessage {
  message?: string;
  status?: number;
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

export default function AdminAIKeysPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingKey, setEditingKey] = useState<AIProviderKey | null>(null);
  const [usageStats, setUsageStats] = useState<Record<string, UsageStats>>({});
  const [loadingStats, setLoadingStats] = useState<Record<string, boolean>>({});

  // Formulaire
  const [formData, setFormData] = useState({
    name: "",
    apiKey: "",
    isDefault: false,
    monthlyLimit: "",
    dailyLimit: "",
  });

  useEffect(() => {
    if (!authLoading && !user?.isStaff) {
      router.replace("/dashboard");
    }
  }, [authLoading, user?.isStaff, router]);

  const loadProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<AIProvider[]>("/ai/providers");
      setProviders(response.data);
      if (response.data.length > 0 && !selectedProvider) {
        setSelectedProvider(response.data[0].id);
      }
    } catch (err: unknown) {
      console.error("Erreur chargement providers:", err);
      // Si erreur 401, le layout gère déjà la redirection
      // Sinon, afficher l'erreur (peut être une erreur de migration SQL non appliquée)
      const apiError = typeof err === "object" && err !== null ? (err as ApiErrorMessage) : null;
      const message = apiError?.message || "";
      if (apiError?.status === 401 || message.includes("Token") || message.includes("accès")) {
        // Le layout gère la redirection, on ne fait rien
        setError(null);
      } else {
        setError(getErrorMessage(err, "Erreur lors du chargement des providers. Vérifiez que la migration SQL a été appliquée."));
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProvider]);

  useEffect(() => {
    if (user?.isStaff) {
      void loadProviders();
    }
  }, [loadProviders, user?.isStaff]);

  const loadUsageStats = async (providerId: string) => {
    try {
      setLoadingStats(prev => ({ ...prev, [providerId]: true }));
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();
      const response = await apiClient.get<UsageStats>(`/ai/usage/stats?providerId=${providerId}&startDate=${startDate}&endDate=${endDate}`);
      setUsageStats(prev => ({ ...prev, [providerId]: response.data }));
    } catch (err: unknown) {
      console.error("Erreur chargement stats:", err);
    } finally {
      setLoadingStats(prev => ({ ...prev, [providerId]: false }));
    }
  };

  useEffect(() => {
    if (selectedProvider) {
      loadUsageStats(selectedProvider);
    }
  }, [selectedProvider]);

  const handleAddKey = async () => {
    if (!selectedProvider || !formData.name || !formData.apiKey) {
      setError("Le nom et la clé API sont requis");
      return;
    }

    try {
      await apiClient.post(`/ai/providers/${selectedProvider}/keys`, {
        name: formData.name,
        apiKey: formData.apiKey,
        isDefault: formData.isDefault,
        monthlyLimit: formData.monthlyLimit ? parseInt(formData.monthlyLimit) : null,
        dailyLimit: formData.dailyLimit ? parseInt(formData.dailyLimit) : null,
      });
      setShowAddModal(false);
      setFormData({ name: "", apiKey: "", isDefault: false, monthlyLimit: "", dailyLimit: "" });
      await loadProviders();
      if (selectedProvider) {
        await loadUsageStats(selectedProvider);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erreur lors de l'ajout de la clé"));
    }
  };

  const handleEditKey = async () => {
    if (!editingKey || !formData.name) {
      setError("Le nom est requis");
      return;
    }

    try {
      await apiClient.put(`/ai/keys/${editingKey.id}`, {
        name: formData.name,
        apiKey: formData.apiKey || undefined,
        isDefault: formData.isDefault,
        monthlyLimit: formData.monthlyLimit ? parseInt(formData.monthlyLimit) : null,
        dailyLimit: formData.dailyLimit ? parseInt(formData.dailyLimit) : null,
      });
      setShowEditModal(false);
      setEditingKey(null);
      setFormData({ name: "", apiKey: "", isDefault: false, monthlyLimit: "", dailyLimit: "" });
      await loadProviders();
      if (selectedProvider) {
        await loadUsageStats(selectedProvider);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erreur lors de la modification de la clé"));
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette clé API ?")) {
      return;
    }

    try {
      await apiClient.delete(`/ai/keys/${keyId}`);
      await loadProviders();
      if (selectedProvider) {
        await loadUsageStats(selectedProvider);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erreur lors de la suppression de la clé"));
    }
  };

  const handleToggleActive = async (key: AIProviderKey) => {
    try {
      await apiClient.put(`/ai/keys/${key.id}`, {
        isActive: !key.isActive,
      });
      await loadProviders();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erreur lors de la modification"));
    }
  };

  const handleCleanCache = async () => {
    try {
      await apiClient.post("/ai/cache/clean");
      alert("Cache nettoyé avec succès");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erreur lors du nettoyage du cache"));
    }
  };

  const openEditModal = (key: AIProviderKey) => {
    setEditingKey(key);
    setFormData({
      name: key.name,
      apiKey: "", // Ne pas afficher la clé existante
      isDefault: key.isDefault,
      monthlyLimit: key.monthlyLimit?.toString() || "",
      dailyLimit: key.dailyLimit?.toString() || "",
    });
    setShowEditModal(true);
  };

  const currentProvider = providers.find(p => p.id === selectedProvider);
  const stats = selectedProvider ? usageStats[selectedProvider] : null;

  return (
    <PageLayout>
      <PageHeader
        title="Gestion des Clés API IA"
        subtitle="Configurez et gérez vos clés API pour l'optimisation IA"
        actions={
        <button
          onClick={handleCleanCache}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: '2px',
            fontSize: '14px',
            cursor: 'pointer',
            color: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <RefreshCw style={{ width: '16px', height: '16px' }} />
          Nettoyer le cache
        </button>
        }
      />

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '2px',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle style={{ width: '20px', height: '20px', color: '#dc2626' }} />
          <p style={{ color: '#dc2626', margin: 0, fontSize: '14px' }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Chargement...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '24px' }}>
          {/* Liste des providers */}
          <div style={{ width: '300px', flexShrink: 0 }}>
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '2px',
              padding: '16px'
            }}>
              <h2 style={{
                fontSize: '16px',
                fontWeight: '500',
                color: '#0a0a0a',
                marginBottom: '16px',
                margin: 0
              }}>Providers</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {providers.map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => setSelectedProvider(provider.id)}
                    style={{
                      padding: '12px',
                      borderRadius: '2px',
                      border: selectedProvider === provider.id ? '1px solid #0a0a0a' : '1px solid #e5e7eb',
                      backgroundColor: selectedProvider === provider.id ? '#fafafa' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>
                      {provider.displayName}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {provider.providerKeys.length} clé{provider.providerKeys.length > 1 ? 's' : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Détails du provider sélectionné */}
          {currentProvider && (
            <div style={{ flex: 1 }}>
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '2px',
                padding: '24px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div>
                    <h2 style={{
                      fontSize: '20px',
                      fontWeight: '500',
                      color: '#0a0a0a',
                      marginBottom: '8px',
                      margin: 0
                    }}>{currentProvider.displayName}</h2>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                      Modèle: {currentProvider.defaultModel} • 
                      Coût: ${currentProvider.costPerToken.toFixed(8)}/token input, 
                      ${currentProvider.costPerOutputToken.toFixed(8)}/token output
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setFormData({ name: "", apiKey: "", isDefault: false, monthlyLimit: "", dailyLimit: "" });
                      setShowAddModal(true);
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#0a0a0a',
                      border: 'none',
                      borderRadius: '2px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Plus style={{ width: '16px', height: '16px' }} />
                    Ajouter une clé
                  </button>
                </div>

                {/* Statistiques */}
                {stats && (
                  <div style={{
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '2px',
                    padding: '16px',
                    marginBottom: '24px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', margin: 0 }}>
                        Statistiques (30 derniers jours)
                      </h3>
                      {loadingStats[selectedProvider!] && (
                        <RefreshCw style={{ width: '16px', height: '16px', color: '#6b7280', animation: 'spin 1s linear infinite' }} />
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Requêtes</div>
                        <div style={{ fontSize: '20px', fontWeight: '500', color: '#0a0a0a' }}>
                          {stats.totals.totalRequests.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Tokens input</div>
                        <div style={{ fontSize: '20px', fontWeight: '500', color: '#0a0a0a' }}>
                          {stats.totals.totalInputTokens.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Tokens output</div>
                        <div style={{ fontSize: '20px', fontWeight: '500', color: '#0a0a0a' }}>
                          {stats.totals.totalOutputTokens.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Coût total</div>
                        <div style={{ fontSize: '20px', fontWeight: '500', color: '#0a0a0a' }}>
                          ${stats.totals.totalCost.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Liste des clés */}
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a', marginBottom: '16px', margin: 0 }}>
                    Clés API
                  </h3>
                  {currentProvider.providerKeys.length === 0 ? (
                    <div style={{
                      padding: '48px',
                      textAlign: 'center',
                      border: '1px dashed #e5e7eb',
                      borderRadius: '2px',
                      color: '#6b7280'
                    }}>
                      <Key style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                      <p style={{ margin: 0, fontSize: '14px' }}>Aucune clé API configurée</p>
                      <p style={{ margin: '8px 0 0 0', fontSize: '12px' }}>Ajoutez une clé pour activer l&apos;optimisation IA</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {currentProvider.providerKeys.map(key => (
                        <div
                          key={key.id}
                          style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '2px',
                            padding: '16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>
                                {key.name}
                              </div>
                              {key.isDefault && (
                                <span style={{
                                  padding: '2px 8px',
                                  backgroundColor: '#f3f4f6',
                                  borderRadius: '2px',
                                  fontSize: '11px',
                                  color: '#6b7280'
                                }}>Par défaut</span>
                              )}
                              {key.isActive ? (
                                <CheckCircle2 style={{ width: '16px', height: '16px', color: '#10b981' }} />
                              ) : (
                                <AlertCircle style={{ width: '16px', height: '16px', color: '#ef4444' }} />
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              Limites: {key.dailyLimit ? `${key.dailyLimit}/jour` : 'Illimité/jour'} • 
                              {key.monthlyLimit ? ` ${key.monthlyLimit}/mois` : ' Illimité/mois'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                              Créée le {new Date(key.createdAt).toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleToggleActive(key)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: key.isActive ? '#f3f4f6' : '#0a0a0a',
                                border: 'none',
                                borderRadius: '2px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                color: key.isActive ? '#6b7280' : '#ffffff'
                              }}
                            >
                              {key.isActive ? 'Désactiver' : 'Activer'}
                            </button>
                            <button
                              onClick={() => openEditModal(key)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '2px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                color: '#0a0a0a',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Edit style={{ width: '14px', height: '14px' }} />
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDeleteKey(key.id)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '2px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                color: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Trash2 style={{ width: '14px', height: '14px' }} />
                              Supprimer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Ajouter */}
      {showAddModal && currentProvider && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '2px',
            padding: '24px',
            width: '500px',
            maxWidth: '90vw'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '500', color: '#0a0a0a', marginBottom: '24px', margin: 0 }}>
              Ajouter une clé API - {currentProvider.displayName}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#0a0a0a', marginBottom: '8px' }}>
                  Nom de la clé *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Clé principale"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '2px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#0a0a0a', marginBottom: '8px' }}>
                  Clé API *
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="Votre clé API"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '2px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#0a0a0a', marginBottom: '8px' }}>
                  Limite quotidienne (optionnel)
                </label>
                <input
                  type="number"
                  value={formData.dailyLimit}
                  onChange={(e) => setFormData({ ...formData, dailyLimit: e.target.value })}
                  placeholder="Ex: 500"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '2px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#0a0a0a', marginBottom: '8px' }}>
                  Limite mensuelle (optionnel)
                </label>
                <input
                  type="number"
                  value={formData.monthlyLimit}
                  onChange={(e) => setFormData({ ...formData, monthlyLimit: e.target.value })}
                  placeholder="Ex: 10000"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '2px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  id="isDefault"
                />
                <label htmlFor="isDefault" style={{ fontSize: '14px', color: '#0a0a0a', cursor: 'pointer' }}>
                  Définir comme clé par défaut
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setFormData({ name: "", apiKey: "", isDefault: false, monthlyLimit: "", dailyLimit: "" });
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '2px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: '#0a0a0a'
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleAddKey}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#0a0a0a',
                  border: 'none',
                  borderRadius: '2px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: '#ffffff'
                }}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifier */}
      {showEditModal && editingKey && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '2px',
            padding: '24px',
            width: '500px',
            maxWidth: '90vw'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '500', color: '#0a0a0a', marginBottom: '24px', margin: 0 }}>
              Modifier la clé API
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#0a0a0a', marginBottom: '8px' }}>
                  Nom de la clé *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Clé principale"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '2px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#0a0a0a', marginBottom: '8px' }}>
                  Nouvelle clé API (laisser vide pour ne pas modifier)
                </label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="Laisser vide pour conserver la clé actuelle"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '2px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#0a0a0a', marginBottom: '8px' }}>
                  Limite quotidienne (optionnel)
                </label>
                <input
                  type="number"
                  value={formData.dailyLimit}
                  onChange={(e) => setFormData({ ...formData, dailyLimit: e.target.value })}
                  placeholder="Ex: 500"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '2px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#0a0a0a', marginBottom: '8px' }}>
                  Limite mensuelle (optionnel)
                </label>
                <input
                  type="number"
                  value={formData.monthlyLimit}
                  onChange={(e) => setFormData({ ...formData, monthlyLimit: e.target.value })}
                  placeholder="Ex: 10000"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '2px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  id="isDefaultEdit"
                />
                <label htmlFor="isDefaultEdit" style={{ fontSize: '14px', color: '#0a0a0a', cursor: 'pointer' }}>
                  Définir comme clé par défaut
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingKey(null);
                  setFormData({ name: "", apiKey: "", isDefault: false, monthlyLimit: "", dailyLimit: "" });
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '2px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: '#0a0a0a'
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleEditKey}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#0a0a0a',
                  border: 'none',
                  borderRadius: '2px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: '#ffffff'
                }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </PageLayout>
  );
}
