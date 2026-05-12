"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Download, Search, Edit, Mail, Phone, Building, Calendar, SendHorizonal } from 'lucide-react';
import {
  PageLayout,
  PageHeader,
  PageLoading,
  PageError,
  StatusBadge,
} from '@/components/layout';

interface MarketingLead {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone: string;
  company: string;
  locale: string | null;
  source: string | null;
  status: string | null;
  notes: string | null;
  marketingOptIn: boolean;
  resendContactId: string | null;
  nurtureStage: string | null;
  lastMarketingEmailAt: string | null;
  nextMarketingEmailAt: string | null;
  marketingClickCount: number;
  lastMarketingClickAt: string | null;
  lastMarketingClickTarget: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminLeadsResponse {
  leads: MarketingLead[];
  total: number;
}

interface SendNurtureResponse {
  message?: string;
}

export default function AdminLeadsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [leads, setLeads] = useState<MarketingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user?.isStaff) {
      router.replace('/dashboard');
    }
  }, [authLoading, user?.isStaff, router]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [localeFilter, setLocaleFilter] = useState<string>('all');
  const [editingLead, setEditingLead] = useState<MarketingLead | null>(null);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('new');
  const [sendingLeadId, setSendingLeadId] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<AdminLeadsResponse>(`/marketing/leads?page=${page}&limit=${limit}&orderBy=createdAt&order=desc`);
      setLeads(response.data.leads || []);
      setTotal(response.data.total || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des leads';
      console.error('Error fetching leads:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [limit, page]);

  useEffect(() => {
    if (user?.isStaff) {
      void fetchLeads();
    }
  }, [user?.isStaff, fetchLeads]);

  const updateLead = async (leadId: string, updates: { status?: string; notes?: string }) => {
    try {
      await apiClient.put(`/marketing/leads/${leadId}`, updates);
      await fetchLeads(); // Rafraîchir la liste
      setEditingLead(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour';
      console.error('Error updating lead:', err);
      alert(message);
    }
  };

  const sendNurtureNow = async (lead: MarketingLead) => {
    try {
      setSendingLeadId(lead.id);
      const response = await apiClient.post<SendNurtureResponse>(`/marketing/leads/${lead.id}/send-nurture`, {});
      await fetchLeads();
      alert(response.data?.message || 'Email marketing envoyé');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l’envoi de l’email marketing';
      console.error('Error sending nurture email:', err);
      alert(message);
    } finally {
      setSendingLeadId(null);
    }
  };

  const exportToCSV = () => {
    const headers = ['Prénom', 'Nom', 'Email', 'Téléphone', 'Fonction', 'Entreprise', 'Locale', 'Statut', 'Séquence', 'Opt-in', 'Clics', 'Dernier clic', 'Cible clic', 'Prochain email', 'Date'];
    const rows = leads.map(lead => [
      lead.firstName,
      lead.lastName,
      lead.email,
      lead.phone,
      lead.jobTitle,
      lead.company,
      lead.locale || '',
      lead.status || 'new',
      lead.unsubscribedAt ? 'desinscrit' : (lead.nurtureStage || ''),
      lead.marketingOptIn ? 'oui' : 'non',
      String(lead.marketingClickCount || 0),
      lead.lastMarketingClickAt || '',
      lead.lastMarketingClickTarget || '',
      lead.nextMarketingEmailAt || '',
      new Date(lead.createdAt).toLocaleDateString('fr-FR')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchTerm || 
      lead.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesLocale = localeFilter === 'all' || lead.locale === localeFilter;
    
    return matchesSearch && matchesStatus && matchesLocale;
  });

  const statusLabels: Record<string, string> = {
    new: 'Nouveau',
    contacted: 'Contacté',
    qualified: 'Qualifié',
    converted: 'Converti',
    lost: 'Perdu'
  };

  const statusVariant: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
    new: 'neutral',
    contacted: 'warning',
    qualified: 'success',
    converted: 'success',
    lost: 'error'
  };

  const nurtureStageLabels: Record<string, string> = {
    pending_j0: 'Checklist initiale en attente',
    pending_j1: 'Audit express en attente',
    pending_j3: 'Audit express en attente',
    pending_j6: 'Scorecard canal en attente',
    pending_j10: 'Scorecard canal en attente',
    completed: 'Séquence terminée'
  };

  const nurtureStageVariant = (lead: MarketingLead): 'success' | 'error' | 'warning' | 'neutral' => {
    if (lead.unsubscribedAt || lead.marketingOptIn === false) return 'error';
    if ((lead.nurtureStage || '') === 'completed') return 'success';
    if ((lead.nurtureStage || '').startsWith('pending_')) return 'warning';
    return 'neutral';
  };

  const formatDateTime = (value: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <PageLayout>
        <PageLoading message="Chargement des leads…" style={{ minHeight: '50vh' }} />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <PageError message={error} onRetry={fetchLeads} />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="Gestion des Leads Marketing"
        subtitle={`${total} lead${total > 1 ? 's' : ''} au total`}
      />

      {/* Barre de recherche et filtres */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '24px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: 'var(--ink-4)' }} />
          <input
            type="text"
            placeholder="Rechercher par nom, email, entreprise..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              border: '1px solid var(--line)',
              borderRadius: '2px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '10px 12px',
            border: '1px solid var(--line)',
            borderRadius: '2px',
            fontSize: '14px',
            outline: 'none',
            backgroundColor: '#ffffff'
          }}
        >
          <option value="all">Tous les statuts</option>
          <option value="new">Nouveau</option>
          <option value="contacted">Contacté</option>
          <option value="qualified">Qualifié</option>
          <option value="converted">Converti</option>
          <option value="lost">Perdu</option>
        </select>

        <select
          value={localeFilter}
          onChange={(e) => setLocaleFilter(e.target.value)}
          style={{
            padding: '10px 12px',
            border: '1px solid var(--line)',
            borderRadius: '2px',
            fontSize: '14px',
            outline: 'none',
            backgroundColor: '#ffffff'
          }}
        >
          <option value="all">Toutes les langues</option>
          <option value="fr">Français</option>
          <option value="en">Anglais</option>
        </select>

        <button
          onClick={exportToCSV}
          style={{
            padding: '10px 20px',
            backgroundColor: '#0a0a0a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '2px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Download size={16} />
          Exporter CSV
        </button>
      </div>

      {/* Liste des leads */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid var(--line)',
        borderRadius: '2px',
        overflow: 'hidden',
        boxShadow: 'none'
      }}>
        {filteredLeads.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--ink-3)' }}>
            <p>Aucun lead trouvé</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--paper-2)', borderBottom: '1px solid var(--line)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', textTransform: 'uppercase' }}>Contact</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', textTransform: 'uppercase' }}>Entreprise</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', textTransform: 'uppercase' }}>Fonction</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', textTransform: 'uppercase' }}>Locale</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', textTransform: 'uppercase' }}>Statut</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', textTransform: 'uppercase' }}>Marketing</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', textTransform: 'uppercase' }}>Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--ink-3)', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} style={{ borderBottom: '1px solid var(--paper-2)' }}>
                    <td style={{ padding: '16px' }}>
                      <div>
                        <div style={{ fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>
                          {lead.firstName} {lead.lastName}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <Mail size={12} />
                          <a href={`mailto:${lead.email}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                            {lead.email}
                          </a>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <Phone size={12} />
                          <a href={`tel:${lead.phone}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                            {lead.phone}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px', color: '#0a0a0a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building size={14} style={{ color: 'var(--ink-3)' }} />
                        {lead.company}
                      </div>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--ink-3)', fontSize: '14px' }}>
                      {lead.jobTitle}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: '#fafafa',
                        color: 'var(--ink-2)'
                      }}>
                        {lead.locale?.toUpperCase() || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <StatusBadge variant={statusVariant[lead.status || 'new']}>
                        {statusLabels[lead.status || 'new']}
                      </StatusBadge>
                    </td>
                    <td style={{ padding: '16px', minWidth: '220px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <StatusBadge variant={nurtureStageVariant(lead)}>
                          {lead.unsubscribedAt
                            ? 'Désinscrit'
                            : (nurtureStageLabels[lead.nurtureStage || ''] || 'Non initialisé')}
                        </StatusBadge>
                        <div style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
                          Opt-in: {lead.marketingOptIn && !lead.unsubscribedAt ? 'Oui' : 'Non'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
                          Prochain: {formatDateTime(lead.nextMarketingEmailAt)}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
                          Dernier: {formatDateTime(lead.lastMarketingEmailAt)}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
                          Clics: {lead.marketingClickCount || 0}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
                          Dernier clic: {formatDateTime(lead.lastMarketingClickAt)}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--ink-3)' }}>
                          Cible: {lead.lastMarketingClickTarget || '—'}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--ink-3)', fontSize: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} />
                        {new Date(lead.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setEditingLead(lead);
                            setNotes(lead.notes || '');
                            setStatus(lead.status || 'new');
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'var(--paper-2)',
                            border: '1px solid var(--line)',
                            borderRadius: '2px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: '500'
                          }}
                        >
                          <Edit size={14} />
                          Modifier
                        </button>
                        <button
                          onClick={() => sendNurtureNow(lead)}
                          disabled={sendingLeadId === lead.id || !!lead.unsubscribedAt || lead.marketingOptIn === false}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: sendingLeadId === lead.id ? 'var(--ink-4)' : '#0a0a0a',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '2px',
                            fontSize: '12px',
                            cursor: sendingLeadId === lead.id || !!lead.unsubscribedAt || lead.marketingOptIn === false ? 'not-allowed' : 'pointer',
                            opacity: sendingLeadId === lead.id || !!lead.unsubscribedAt || lead.marketingOptIn === false ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: '500'
                          }}
                        >
                          <SendHorizonal size={14} />
                          {sendingLeadId === lead.id ? 'Envoi...' : 'Envoyer maintenant'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '8px 16px',
              backgroundColor: page === 1 ? 'var(--paper-2)' : '#ffffff',
              border: '1px solid var(--line)',
              borderRadius: '2px',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              opacity: page === 1 ? 0.5 : 1,
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Précédent
          </button>
          <span style={{ color: 'var(--ink-3)', fontSize: '14px' }}>
            Page {page} sur {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / limit)}
            style={{
              padding: '8px 16px',
              backgroundColor: page >= Math.ceil(total / limit) ? 'var(--paper-2)' : '#ffffff',
              border: '1px solid var(--line)',
              borderRadius: '2px',
              cursor: page >= Math.ceil(total / limit) ? 'not-allowed' : 'pointer',
              opacity: page >= Math.ceil(total / limit) ? 0.5 : 1,
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Suivant
          </button>
        </div>
      )}

      {/* Modal d'édition */}
      {editingLead && (
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
            backgroundColor: '#ffffff',
            borderRadius: '2px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            border: '1px solid var(--line)',
            boxShadow: 'none'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '400', marginBottom: '20px', color: '#0a0a0a' }}>
              Modifier le lead
            </h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                Statut
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--line)',
                  borderRadius: '2px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              >
                <option value="new">Nouveau</option>
                <option value="contacted">Contacté</option>
                <option value="qualified">Qualifié</option>
                <option value="converted">Converti</option>
                <option value="lost">Perdu</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--line)',
                  borderRadius: '2px',
                  fontSize: '14px',
                  resize: 'vertical',
                  outline: 'none'
                }}
                placeholder="Ajouter des notes sur ce lead..."
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingLead(null)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--paper-2)',
                  border: '1px solid var(--line)',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => updateLead(editingLead.id, { status, notes })}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#0a0a0a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </PageLayout>
  );
}
