"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  TestTube,
  BarChart3,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  Target,
} from 'lucide-react';
import { API_BASE_URL, authFetch } from '@/lib/api';
import { PageLayout, PageHeader, PageCard, PageLoading } from '@/components/layout';

interface TestResult {
  test: {
    id: string;
    name: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    platform: string;
    prerequisitesMet: boolean | null;
  };
  controlCount: number;
  variantCount: number;
  resultSummary: Record<string, unknown> | null;
  recommendation: string;
}

const PLATFORM_LABEL: Record<string, string> = {
  GMC: 'Google Merchant Center',
  META: 'Meta (Facebook/Instagram)',
  AMAZON: 'Amazon',
  CHATGPT: 'ChatGPT / LLM',
};

export default function ABTestDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const res = await authFetch(`${API_BASE_URL}/ab-tests/${id}/results`);
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.error('Erreur chargement résultats:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading || !data) {
    return (
      <PageLayout>
        <PageLoading message={loading ? 'Chargement des résultats…' : 'Test introuvable.'} />
      </PageLayout>
    );
  }

  const { test, controlCount, variantCount, resultSummary, recommendation } = data;

  return (
    <PageLayout style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link
          href="/optimiser/ab-tests"
          prefetch={false}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: '#6b7280',
            textDecoration: 'none',
            marginBottom: '16px',
          }}
        >
          <ArrowLeft style={{ width: '16px', height: '16px' }} />
          Retour aux tests A/B
        </Link>
        <PageHeader
          title={test.name}
          icon={TestTube}
          subtitle={`${PLATFORM_LABEL[test.platform] || test.platform} · ${test.status}`}
        />
      </div>

      <PageCard style={{ marginBottom: '24px', padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
          Effectifs
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px', borderLeft: '4px solid #0ea5e9' }}>
            <p style={{ fontSize: '12px', color: '#0369a1', fontWeight: '600', margin: '0 0 4px' }}>BRAS TÉMOIN (control)</p>
            <p style={{ fontSize: '24px', fontWeight: '700', color: '#0c4a6e', margin: 0 }}>{controlCount}</p>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>Titre original conservé</p>
          </div>
          <div style={{ padding: '16px', backgroundColor: '#f5f3ff', borderRadius: '8px', borderLeft: '4px solid #8b5cf6' }}>
            <p style={{ fontSize: '12px', color: '#5b21b6', fontWeight: '600', margin: '0 0 4px' }}>BRAS VARIANT</p>
            <p style={{ fontSize: '24px', fontWeight: '700', color: '#4c1d95', margin: 0 }}>{variantCount}</p>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>Titre optimisé IA</p>
          </div>
        </div>
        {test.prerequisitesMet === false && (
          <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: '#fef3c7', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <AlertTriangle style={{ width: '20px', height: '20px', color: '#d97706', flexShrink: 0 }} />
            <p style={{ fontSize: '13px', color: '#92400e', margin: 0 }}>
              Prérequis non remplis au lancement (moins de 100 produits par bras). Les résultats peuvent être peu significatifs.
            </p>
          </div>
        )}
      </PageCard>

      {(test.startDate || test.endDate) && (
        <PageCard style={{ marginBottom: '24px', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar style={{ width: '20px', height: '20px', color: '#6b7280' }} />
            Durée du test
          </h3>
          <p style={{ fontSize: '14px', color: '#374151', margin: 0 }}>
            {test.startDate && new Date(test.startDate).toLocaleDateString('fr-FR', { dateStyle: 'long' })}
            {test.startDate && test.endDate && ' → '}
            {test.endDate && new Date(test.endDate).toLocaleDateString('fr-FR', { dateStyle: 'long' })}
          </p>
        </PageCard>
      )}

      <PageCard style={{ marginBottom: '24px', padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
          Recommandation
        </h3>
        <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', borderLeft: '4px solid #8b5cf6' }}>
          <p style={{ fontSize: '14px', color: '#374151', margin: 0, lineHeight: 1.6 }}>
            {recommendation}
          </p>
        </div>
        {resultSummary && typeof resultSummary === 'object' && Object.keys(resultSummary).length > 0 && (
          <details style={{ marginTop: '16px' }}>
            <summary style={{ fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}>Voir le détail des métriques</summary>
            <pre style={{ marginTop: '8px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '6px', fontSize: '12px', overflow: 'auto' }}>
              {JSON.stringify(resultSummary, null, 2)}
            </pre>
          </details>
        )}
      </PageCard>

      <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
        Pour des métriques réelles (impressions, clics, conversions), connectez les données Google Merchant Center ou Amazon dans une prochaine version.
      </p>
    </PageLayout>
  );
}
