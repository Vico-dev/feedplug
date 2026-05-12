"use client";

import {
  TrendingUp,
  Download,
  Filter,
  Calendar,
  BarChart3,
  Target,
  ArrowUp,
  Eye,
  Plus,
  RefreshCw,
  DollarSign,
  MousePointer,
  Clock,
  CheckCircle,
  XCircle,
  X
} from "lucide-react";
import { useState } from "react";
import { ReportBuilder } from "@/components/reports/report-builder";
import { ReportTemplates } from "@/components/reports/report-templates";
import { useTranslations } from "next-intl";
import {
  DashboardStatCard,
  DashboardStatGrid,
  DashboardToolbar,
  PageButtonPrimary,
  PageButtonSecondary,
  PageHeader,
  PageLayout,
} from "@/components/layout";

type ReportPeriod = '7d' | '30d' | '90d' | '1y';
type ReportType = 'overview' | 'flows' | 'ab-tests' | 'custom';

interface FlowPerformance {
  id: string;
  name: string;
  platform: string;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  revenue: number;
  roi: number;
  cost: number;
  status: 'active' | 'paused' | 'error';
  abTestId?: string;
  abTestVariant?: 'A' | 'B';
}

interface ABTestResult {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'paused';
  startDate: string;
  endDate?: string;
  variantA: {
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    conversionRate: number;
  };
  variantB: {
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    conversionRate: number;
  };
  winner?: 'A' | 'B' | 'inconclusive';
  confidence: number;
}

export default function RapportsPage() {
  const t = useTranslations("dashboard");
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('30d');
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('overview');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const flowPerformances: FlowPerformance[] = [
    {
      id: '1',
      name: 'Google Shopping',
      platform: 'Google Merchant Center',
      impressions: 125430,
      clicks: 3512,
      ctr: 2.8,
      conversions: 112,
      revenue: 12450,
      roi: 340,
      cost: 3650,
      status: 'active'
    },
    {
      id: '2',
      name: 'Meta Catalog',
      platform: 'Facebook/Instagram',
      impressions: 89230,
      clicks: 2675,
      ctr: 3.0,
      conversions: 85,
      revenue: 8230,
      roi: 280,
      cost: 2940,
      status: 'active'
    },
    {
      id: '3',
      name: 'Meta Catalog - Variant A',
      platform: 'Facebook/Instagram',
      impressions: 45120,
      clicks: 1354,
      ctr: 3.0,
      conversions: 42,
      revenue: 4125,
      roi: 290,
      cost: 1420,
      status: 'active',
      abTestId: 'ab-1',
      abTestVariant: 'A'
    },
    {
      id: '4',
      name: 'Meta Catalog - Variant B',
      platform: 'Facebook/Instagram',
      impressions: 44110,
      clicks: 1321,
      ctr: 3.0,
      conversions: 43,
      revenue: 4105,
      roi: 270,
      cost: 1520,
      status: 'active',
      abTestId: 'ab-1',
      abTestVariant: 'B'
    },
    {
      id: '5',
      name: 'Pinterest Ads',
      platform: 'Pinterest',
      impressions: 45120,
      clicks: 1354,
      ctr: 3.0,
      conversions: 41,
      revenue: 3900,
      roi: 220,
      cost: 1770,
      status: 'error'
    }
  ];

  const abTestResults: ABTestResult[] = [
    {
      id: 'ab-1',
      name: 'Test Meta Catalog - Optimisation Prix',
      status: 'running',
      startDate: '2024-01-15',
      variantA: {
        impressions: 45120,
        clicks: 1354,
        conversions: 42,
        revenue: 4125,
        ctr: 3.0,
        conversionRate: 3.1
      },
      variantB: {
        impressions: 44110,
        clicks: 1321,
        conversions: 43,
        revenue: 4105,
        ctr: 3.0,
        conversionRate: 3.3
      },
      confidence: 78
    }
  ];

  const totalMetrics = {
    revenue: flowPerformances.reduce((sum, f) => sum + f.revenue, 0),
    conversions: flowPerformances.reduce((sum, f) => sum + f.conversions, 0),
    impressions: flowPerformances.reduce((sum, f) => sum + f.impressions, 0),
    clicks: flowPerformances.reduce((sum, f) => sum + f.clicks, 0),
    cost: flowPerformances.reduce((sum, f) => sum + f.cost, 0)
  };

  const overallCTR = totalMetrics.impressions > 0 ? (totalMetrics.clicks / totalMetrics.impressions * 100) : 0;
  const overallConversionRate = totalMetrics.clicks > 0 ? (totalMetrics.conversions / totalMetrics.clicks * 100) : 0;
  const overallROI = totalMetrics.cost > 0 ? ((totalMetrics.revenue - totalMetrics.cost) / totalMetrics.cost * 100) : 0;

  return (
    <PageLayout>
      <PageHeader
        title={t("rapports.title")}
        actions={
          <>
            <PageButtonSecondary>
              <RefreshCw style={{ width: '16px', height: '16px' }} />
              Actualiser
            </PageButtonSecondary>
            <PageButtonSecondary>
              <Download style={{ width: '16px', height: '16px' }} />
              Exporter
            </PageButtonSecondary>
            <PageButtonPrimary onClick={() => setShowTemplates(true)}>
              <Plus style={{ width: '16px', height: '16px' }} />
              Nouveau rapport
            </PageButtonPrimary>
          </>
        }
        subtitle={t("rapports.subtitle")}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <DashboardToolbar style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setSelectedReportType('overview')}
              style={{ 
                minHeight: 40,
                padding: '0 14px', 
                borderRadius: '999px', 
                fontSize: '13px',
                fontWeight: '600',
                backgroundColor: selectedReportType === 'overview' ? 'var(--app-accent-soft)' : 'rgba(255,255,255,0.8)',
                color: selectedReportType === 'overview' ? 'var(--app-accent-strong)' : 'var(--ink-2)',
                border: selectedReportType === 'overview' ? '1px solid rgba(15, 118, 110, 0.18)' : '1px solid var(--app-border)',
                cursor: 'pointer'
              }}
            >
              Vue d&apos;ensemble
            </button>
            <button 
              onClick={() => setSelectedReportType('flows')}
              style={{ 
                minHeight: 40,
                padding: '0 14px', 
                borderRadius: '999px', 
                fontSize: '13px',
                fontWeight: '600',
                backgroundColor: selectedReportType === 'flows' ? 'var(--app-accent-soft)' : 'rgba(255,255,255,0.8)',
                color: selectedReportType === 'flows' ? 'var(--app-accent-strong)' : 'var(--ink-2)',
                border: selectedReportType === 'flows' ? '1px solid rgba(15, 118, 110, 0.18)' : '1px solid var(--app-border)',
                cursor: 'pointer'
              }}
            >
              Performances des flux
            </button>
            <button 
              onClick={() => setSelectedReportType('ab-tests')}
              style={{ 
                minHeight: 40,
                padding: '0 14px', 
                borderRadius: '999px', 
                fontSize: '13px',
                fontWeight: '600',
                backgroundColor: selectedReportType === 'ab-tests' ? 'var(--warning-bg)' : 'rgba(255,255,255,0.8)',
                color: selectedReportType === 'ab-tests' ? 'var(--warning)' : 'var(--ink-2)',
                border: selectedReportType === 'ab-tests' ? '1px solid var(--warning)' : '1px solid var(--app-border)',
                cursor: 'pointer'
              }}
            >
              Tests A/B
            </button>
            <button 
              onClick={() => setSelectedReportType('custom')}
              style={{ 
                minHeight: 40,
                padding: '0 14px', 
                borderRadius: '999px', 
                fontSize: '13px',
                fontWeight: '600',
                backgroundColor: selectedReportType === 'custom' ? 'var(--app-accent-soft)' : 'rgba(255,255,255,0.8)',
                color: selectedReportType === 'custom' ? 'var(--app-accent-strong)' : 'var(--ink-2)',
                border: selectedReportType === 'custom' ? '1px solid rgba(15, 118, 110, 0.18)' : '1px solid var(--app-border)',
                cursor: 'pointer'
              }}
            >
              Rapports personnalisés
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar style={{ width: '16px', height: '16px', color: 'var(--ink-3)' }} />
              <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--ink-2)' }}>Période :</span>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { key: '7d', label: '7j' },
                { key: '30d', label: '30j' },
                { key: '90d', label: '90j' },
                { key: '1y', label: '1an' }
              ].map((period) => (
                <button
                  key={period.key}
                  onClick={() => setSelectedPeriod(period.key as ReportPeriod)}
                  style={{
                    minHeight: 36,
                    padding: '0 12px',
                    backgroundColor: selectedPeriod === period.key ? 'var(--app-text)' : 'transparent',
                    color: selectedPeriod === period.key ? 'white' : 'var(--ink-3)',
                    border: '1px solid var(--app-border)',
                    borderRadius: '999px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {period.label}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minHeight: 40,
                padding: '0 12px',
                backgroundColor: showAdvancedFilters ? 'rgba(15, 118, 110, 0.08)' : 'transparent',
                color: 'var(--ink-3)',
                border: '1px solid var(--app-border)',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Filter style={{ width: '16px', height: '16px' }} />
              Filtres avancés
            </button>
          </div>
        </DashboardToolbar>

        {showAdvancedFilters && (
          <div className="feedplug-shell-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '300', color: '#0a0a0a', marginBottom: '16px' }}>
              Filtres avancés
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--ink-2)', marginBottom: '6px' }}>
                  Plateforme
                </label>
                <select style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: '1px solid var(--line-strong)', 
                  borderRadius: '2px', 
                  fontSize: '14px' 
                }}>
                  <option>Toutes les plateformes</option>
                  <option>Google Merchant Center</option>
                  <option>Facebook/Instagram</option>
                  <option>Pinterest</option>
                  <option>Amazon</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--ink-2)', marginBottom: '6px' }}>
                  Statut
                </label>
                <select style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: '1px solid var(--line-strong)', 
                  borderRadius: '2px', 
                  fontSize: '14px' 
                }}>
                  <option>Tous les statuts</option>
                  <option>Actif</option>
                  <option>En pause</option>
                  <option>Erreur</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--ink-2)', marginBottom: '6px' }}>
                  Type de flux
                </label>
                <select style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  border: '1px solid var(--line-strong)', 
                  borderRadius: '2px', 
                  fontSize: '14px' 
                }}>
                  <option>Tous les types</option>
                  <option>Réseaux sociaux</option>
                  <option>Marketplaces</option>
                  <option>Moteurs de recherche</option>
                  <option>Tests A/B</option>
                </select>
              </div>
            </div>
          </div>
        )}
        <DashboardStatGrid>
          <DashboardStatCard icon={<DollarSign size={20} />} label="Revenus generes" value={`€${totalMetrics.revenue.toLocaleString('en-US')}`} hint="+12% vs periode precedente" accent="var(--success)" />
          <DashboardStatCard icon={<Target size={20} />} label="Conversions" value={totalMetrics.conversions.toLocaleString('en-US')} hint={`${overallConversionRate.toFixed(1)}% de taux`} accent="var(--accent)" />
          <DashboardStatCard icon={<MousePointer size={20} />} label="Taux de clic" value={`${overallCTR.toFixed(1)}%`} hint={`${totalMetrics.clicks.toLocaleString('en-US')} clics`} accent="var(--warning)" />
          <DashboardStatCard icon={<TrendingUp size={20} />} label="ROI" value={`${overallROI.toFixed(0)}%`} hint="Retour sur investissement consolide" accent="#2A6FE8" />
        </DashboardStatGrid>
      </div>

      {/* Métriques principales legacy conservees plus bas pour le detail de la page */}
      <div style={{ display: 'none' }}>
        <div style={{ border: '1px solid var(--line)', borderRadius: '2px', backgroundColor: 'white', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', backgroundColor: 'var(--success-bg)', borderRadius: '2px' }}>
                <DollarSign style={{ width: '24px', height: '24px', color: 'var(--success)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '300', color: '#0a0a0a', margin: 0 }}>
                  Revenus générés
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: 0 }}>
                  Total des ventes
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '32px', fontWeight: '400', color: '#0a0a0a', margin: 0, lineHeight: 1 }}>
                €{totalMetrics.revenue.toLocaleString('en-US')}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                <ArrowUp style={{ width: '16px', height: '16px', color: 'var(--success)' }} />
                <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '500' }}>+12%</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ border: '1px solid var(--line)', borderRadius: '2px', backgroundColor: 'white', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', backgroundColor: 'var(--accent-bg)', borderRadius: '12px' }}>
                <Target style={{ width: '24px', height: '24px', color: 'var(--accent)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '300', color: '#0a0a0a', margin: 0 }}>
                  Conversions
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: 0 }}>
                  {overallConversionRate.toFixed(1)}% de taux
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '32px', fontWeight: '400', color: '#0a0a0a', margin: 0, lineHeight: 1 }}>
                {totalMetrics.conversions.toLocaleString('en-US')}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                <ArrowUp style={{ width: '16px', height: '16px', color: 'var(--success)' }} />
                <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '500' }}>+8%</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ border: '1px solid var(--line)', borderRadius: '2px', backgroundColor: 'white', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', backgroundColor: 'var(--warning-bg)', borderRadius: '12px' }}>
                <MousePointer style={{ width: '24px', height: '24px', color: 'var(--warning)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '300', color: '#0a0a0a', margin: 0 }}>
                  Taux de clic (CTR)
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: 0 }}>
                  {totalMetrics.clicks.toLocaleString('en-US')} clics
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '32px', fontWeight: '400', color: '#0a0a0a', margin: 0, lineHeight: 1 }}>
                {overallCTR.toFixed(1)}%
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                <ArrowUp style={{ width: '16px', height: '16px', color: 'var(--success)' }} />
                <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '500' }}>+15%</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ border: '1px solid var(--line)', borderRadius: '2px', backgroundColor: 'white', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', backgroundColor: 'var(--accent-bg)', borderRadius: '12px' }}>
                <TrendingUp style={{ width: '24px', height: '24px', color: 'var(--accent)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '300', color: '#0a0a0a', margin: 0 }}>
                  ROI
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: 0 }}>
                  Retour sur investissement
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '32px', fontWeight: '400', color: '#0a0a0a', margin: 0, lineHeight: 1 }}>
                {overallROI.toFixed(0)}%
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                <ArrowUp style={{ width: '16px', height: '16px', color: 'var(--success)' }} />
                <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '500' }}>+22%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu conditionnel selon le type de rapport */}
      {selectedReportType === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Graphiques principaux */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            {/* Graphique des performances */}
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '2px', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
                  Évolution des revenus
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={{ padding: '8px', border: 'none', backgroundColor: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', borderRadius: '2px' }}>
                    <Eye style={{ width: '16px', height: '16px' }} />
                  </button>
                  <button style={{ padding: '8px', border: 'none', backgroundColor: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', borderRadius: '2px' }}>
                    <Download style={{ width: '16px', height: '16px' }} />
                  </button>
                </div>
              </div>
              
              <div style={{ height: '300px', backgroundColor: 'var(--paper-2)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line)' }}>
                <div style={{ textAlign: 'center' }}>
                  <BarChart3 style={{ width: '48px', height: '48px', color: 'var(--ink-4)', margin: '0 auto 8px' }} />
                  <p style={{ color: 'var(--ink-3)', margin: 0 }}>Graphique des revenus (7 derniers jours)</p>
                </div>
              </div>
            </div>

            {/* Répartition des canaux */}
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '2px', border: '1px solid var(--line)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 24px 0' }}>
                Répartition par canal
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {flowPerformances.map((flow, index) => {
                  const percentage = totalMetrics.revenue > 0 ? (flow.revenue / totalMetrics.revenue * 100) : 0;
                  const colors = ['var(--accent)', 'var(--accent)', 'var(--success)', 'var(--warning)', 'var(--danger)'];
                  
                  return (
                        <div key={flow.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid var(--paper-2)', borderRadius: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '12px', height: '12px', backgroundColor: colors[index % colors.length], borderRadius: '50%' }}></div>
                        <div>
                          <p style={{ fontWeight: '500', color: 'var(--ink-2)', margin: '0 0 2px 0', fontSize: '14px' }}>
                            {flow.name}
                          </p>
                          <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: 0 }}>
                            €{flow.revenue.toLocaleString('en-US')}
                          </p>
                        </div>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink-2)' }}>
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tableau des performances détaillées */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--line)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 24px 0' }}>
              Performances détaillées par flux
            </h2>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--ink-2)' }}>Flux</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: 'var(--ink-2)' }}>Impressions</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: 'var(--ink-2)' }}>Clics</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: 'var(--ink-2)' }}>CTR</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: 'var(--ink-2)' }}>Conversions</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: 'var(--ink-2)' }}>Revenus</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: 'var(--ink-2)' }}>ROI</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: 'var(--ink-2)' }}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {flowPerformances.map((flow) => (
                    <tr key={flow.id} style={{ borderBottom: '1px solid var(--paper-2)' }}>
                      <td style={{ padding: '12px', fontSize: '14px', fontWeight: '500', color: 'var(--ink-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {flow.name}
                          {flow.abTestId && (
                            <span style={{ fontSize: '10px', backgroundColor: 'var(--warning)', color: 'white', padding: '2px 6px', borderRadius: '2px', fontWeight: '500' }}>
                              A/B {flow.abTestVariant}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', color: 'var(--ink-3)' }}>
                        {flow.impressions.toLocaleString('en-US')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', color: 'var(--ink-3)' }}>
                        {flow.clicks.toLocaleString('en-US')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', color: 'var(--success)', fontWeight: '500' }}>
                        {flow.ctr}%
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', color: 'var(--ink-3)' }}>
                        {flow.conversions}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', color: 'var(--ink-2)', fontWeight: '500' }}>
                        €{flow.revenue.toLocaleString('en-US')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', color: 'var(--success)', fontWeight: '500' }}>
                        {flow.roi}%
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {flow.status === 'active' && <CheckCircle style={{ width: '16px', height: '16px', color: 'var(--success)' }} />}
                        {flow.status === 'paused' && <Clock style={{ width: '16px', height: '16px', color: 'var(--warning)' }} />}
                        {flow.status === 'error' && <XCircle style={{ width: '16px', height: '16px', color: 'var(--danger)' }} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedReportType === 'ab-tests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {abTestResults.map((test) => (
            <div key={test.id} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '2px', border: '1px solid var(--warning)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 8px 0' }}>
                    {test.name}
                  </h2>
                  <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: 0 }}>
                    Test en cours • Confiance: {test.confidence}%
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', backgroundColor: 'var(--success-bg)', color: 'var(--success)', padding: '4px 8px', borderRadius: '2px', fontWeight: '500' }}>
                    En cours
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div style={{ backgroundColor: 'var(--paper-2)', padding: '20px', borderRadius: '2px', border: '1px solid var(--line)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 16px 0' }}>
                    Variant A
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: '0 0 4px 0' }}>Impressions</p>
                      <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
                        {test.variantA.impressions.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: '0 0 4px 0' }}>Clics</p>
                      <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
                        {test.variantA.clicks}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: '0 0 4px 0' }}>Conversions</p>
                      <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
                        {test.variantA.conversions}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: '0 0 4px 0' }}>Revenus</p>
                      <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
                        €{test.variantA.revenue}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--paper-2)', padding: '20px', borderRadius: '2px', border: '1px solid var(--line)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 16px 0' }}>
                    Variant B
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: '0 0 4px 0' }}>Impressions</p>
                      <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
                        {test.variantB.impressions.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: '0 0 4px 0' }}>Clics</p>
                      <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
                        {test.variantB.clicks}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: '0 0 4px 0' }}>Conversions</p>
                      <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
                        {test.variantB.conversions}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: '0 0 4px 0' }}>Revenus</p>
                      <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
                        €{test.variantB.revenue}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedReportType === 'flows' && (
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--line)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 24px 0' }}>
            Analyse détaillée des flux
          </h2>
          <p style={{ color: 'var(--ink-3)', margin: 0 }}>
            Vue détaillée des performances de chaque flux avec analyses approfondies.
          </p>
        </div>
      )}

      {selectedReportType === 'custom' && (
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 8px 0' }}>
                Rapports personnalisés
              </h2>
              <p style={{ color: 'var(--ink-3)', margin: 0 }}>
                Créez vos propres rapports avec les métriques qui vous intéressent.
              </p>
            </div>
            <button
              onClick={() => setShowReportBuilder(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                backgroundColor: '#0a0a0a',
                color: 'white',
                border: 'none',
                borderRadius: '2px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <Plus style={{ width: '16px', height: '16px' }} />
              Créer un rapport
            </button>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '20px' 
          }}>
            <div style={{
              border: '2px dashed var(--line-strong)',
              borderRadius: '2px',
              padding: '40px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.backgroundColor = 'var(--paper-2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--line-strong)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            onClick={() => setShowTemplates(true)}
            >
              <Plus style={{ width: '48px', height: '48px', color: 'var(--ink-4)', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 8px 0' }}>
                Nouveau rapport
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: 0 }}>
                Commencez avec un template ou créez votre propre rapport
              </p>
            </div>
            
            <div style={{
              border: '1px solid var(--line)',
              borderRadius: '2px',
              padding: '20px',
              backgroundColor: 'var(--paper-2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <BarChart3 style={{ width: '24px', height: '24px', color: 'var(--ink-3)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
                  Rapport de performance
                </h3>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: '0 0 16px 0' }}>
                Créé le 15 janvier 2024
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  color: 'var(--ink-3)',
                  border: '1px solid var(--line-strong)',
                  borderRadius: '2px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}>
                  Voir
                </button>
                <button style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  color: 'var(--ink-3)',
                  border: '1px solid var(--line-strong)',
                  borderRadius: '2px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}>
                  Dupliquer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Builder Modal */}
      {showReportBuilder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          backgroundColor: 'white'
        }}>
          <ReportBuilder />
          <button
            onClick={() => setShowReportBuilder(false)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              padding: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              zIndex: 1001
            }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <ReportTemplates
          onSelectTemplate={(template) => {
            console.log('Selected template:', template);
            setShowTemplates(false);
            setShowReportBuilder(true);
          }}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </PageLayout>
  );
}
