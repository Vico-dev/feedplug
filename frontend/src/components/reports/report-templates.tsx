"use client";

import { 
  TrendingUp, 
  Target, 
  Users, 
  DollarSign, 
  BarChart3, 
  PieChart,
  LineChart,
  Table,
  Copy,
  Eye,
  Star,
  Clock,
  Zap,
  X,
  type LucideIcon,
} from "lucide-react";

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'performance' | 'conversion' | 'revenue' | 'custom';
  icon: LucideIcon;
  color: string;
  metrics: string[];
  dimensions: string[];
  charts: Array<{
    type: 'bar' | 'line' | 'pie' | 'table';
    title: string;
    metrics: string[];
    dimensions: string[];
  }>;
  popularity: 'high' | 'medium' | 'low';
  estimatedTime: string;
}

const reportTemplates: ReportTemplate[] = [
  {
    id: 'performance-overview',
    name: 'Vue d\'ensemble des performances',
    description: 'Analyse complète des performances de vos campagnes avec métriques clés',
    category: 'performance',
    icon: BarChart3,
    color: '#3b82f6',
    metrics: ['impressions', 'clicks', 'ctr', 'conversions', 'conversion_rate', 'revenue'],
    dimensions: ['date', 'platform', 'campaign'],
    charts: [
      {
        type: 'line',
        title: 'Évolution des performances',
        metrics: ['impressions', 'clicks', 'conversions'],
        dimensions: ['date']
      },
      {
        type: 'bar',
        title: 'Performance par plateforme',
        metrics: ['revenue', 'conversions'],
        dimensions: ['platform']
      },
      {
        type: 'table',
        title: 'Détail des campagnes',
        metrics: ['impressions', 'clicks', 'ctr', 'conversions', 'revenue'],
        dimensions: ['campaign']
      }
    ],
    popularity: 'high',
    estimatedTime: '2 min'
  },
  {
    id: 'conversion-funnel',
    name: 'Entonnoir de conversion',
    description: 'Analyse détaillée du parcours client de l\'impression à la conversion',
    category: 'conversion',
    icon: Target,
    color: '#22c55e',
    metrics: ['impressions', 'clicks', 'conversions', 'conversion_rate', 'ctr'],
    dimensions: ['date', 'platform', 'device', 'country'],
    charts: [
      {
        type: 'bar',
        title: 'Entonnoir de conversion',
        metrics: ['impressions', 'clicks', 'conversions'],
        dimensions: ['platform']
      },
      {
        type: 'pie',
        title: 'Répartition des conversions',
        metrics: ['conversions'],
        dimensions: ['platform']
      },
      {
        type: 'table',
        title: 'Taux de conversion par segment',
        metrics: ['impressions', 'clicks', 'conversions', 'ctr', 'conversion_rate'],
        dimensions: ['device', 'country']
      }
    ],
    popularity: 'high',
    estimatedTime: '3 min'
  },
  {
    id: 'revenue-analysis',
    name: 'Analyse des revenus',
    description: 'Focus sur la génération de revenus et le ROI de vos campagnes',
    category: 'revenue',
    icon: DollarSign,
    color: '#f59e0b',
    metrics: ['revenue', 'cost', 'roi', 'conversions'],
    dimensions: ['date', 'platform', 'campaign', 'keyword'],
    charts: [
      {
        type: 'line',
        title: 'Évolution des revenus',
        metrics: ['revenue', 'cost'],
        dimensions: ['date']
      },
      {
        type: 'bar',
        title: 'ROI par plateforme',
        metrics: ['roi', 'revenue'],
        dimensions: ['platform']
      },
      {
        type: 'table',
        title: 'Performance des mots-clés',
        metrics: ['revenue', 'cost', 'roi', 'conversions'],
        dimensions: ['keyword']
      }
    ],
    popularity: 'medium',
    estimatedTime: '2 min'
  },
  {
    id: 'audience-insights',
    name: 'Insights audience',
    description: 'Compréhension de votre audience et de ses comportements',
    category: 'custom',
    icon: Users,
    color: '#8b5cf6',
    metrics: ['impressions', 'clicks', 'conversions'],
    dimensions: ['device', 'country', 'hour', 'platform'],
    charts: [
      {
        type: 'pie',
        title: 'Répartition par appareil',
        metrics: ['impressions'],
        dimensions: ['device']
      },
      {
        type: 'bar',
        title: 'Performance par pays',
        metrics: ['conversions', 'revenue'],
        dimensions: ['country']
      },
      {
        type: 'line',
        title: 'Activité par heure',
        metrics: ['clicks', 'conversions'],
        dimensions: ['hour']
      }
    ],
    popularity: 'medium',
    estimatedTime: '4 min'
  },
  {
    id: 'ab-test-results',
    name: 'Résultats des tests A/B',
    description: 'Analyse comparative des performances des variants de vos tests',
    category: 'performance',
    icon: Zap,
    color: '#ef4444',
    metrics: ['impressions', 'clicks', 'conversions', 'revenue', 'ctr', 'conversion_rate'],
    dimensions: ['date', 'campaign'],
    charts: [
      {
        type: 'bar',
        title: 'Comparaison des variants',
        metrics: ['conversions', 'revenue'],
        dimensions: ['campaign']
      },
      {
        type: 'line',
        title: 'Évolution des tests',
        metrics: ['ctr', 'conversion_rate'],
        dimensions: ['date']
      },
      {
        type: 'table',
        title: 'Résultats détaillés',
        metrics: ['impressions', 'clicks', 'ctr', 'conversions', 'conversion_rate', 'revenue'],
        dimensions: ['campaign']
      }
    ],
    popularity: 'low',
    estimatedTime: '5 min'
  },
  {
    id: 'custom-dashboard',
    name: 'Dashboard personnalisé',
    description: 'Créez votre propre dashboard avec les métriques qui vous intéressent',
    category: 'custom',
    icon: TrendingUp,
    color: '#06b6d4',
    metrics: [],
    dimensions: [],
    charts: [],
    popularity: 'high',
    estimatedTime: '10 min'
  }
];

interface ReportTemplatesProps {
  onSelectTemplate: (template: ReportTemplate) => void;
  onClose: () => void;
}

export function ReportTemplates({ onSelectTemplate, onClose }: ReportTemplatesProps) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'performance': return '#3b82f6';
      case 'conversion': return '#22c55e';
      case 'revenue': return '#f59e0b';
      case 'custom': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getPopularityBadge = (popularity: string) => {
    switch (popularity) {
      case 'high': 
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Star style={{ width: '12px', height: '12px', color: '#f59e0b', fill: '#f59e0b' }} />
            <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '500' }}>Populaire</span>
          </div>
        );
      case 'medium': 
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp style={{ width: '12px', height: '12px', color: '#6b7280' }} />
            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Standard</span>
          </div>
        );
      case 'low': 
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Zap style={{ width: '12px', height: '12px', color: '#8b5cf6' }} />
            <span style={{ fontSize: '12px', color: '#8b7280', fontWeight: '500' }}>Avancé</span>
          </div>
        );
      default: return null;
    }
  };

  return (
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
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '1000px',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', margin: '0 0 8px 0' }}>
              Templates de rapports
            </h2>
            <p style={{ fontSize: '16px', color: '#6b7280', margin: 0 }}>
              Choisissez un template prédéfini ou créez votre propre rapport
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              borderRadius: '6px'
            }}
          >
            <X style={{ width: '24px', height: '24px' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '20px' 
          }}>
            {reportTemplates.map((template) => {
              const IconComponent = template.icon;
              
              return (
                <div
                  key={template.id}
                  onClick={() => onSelectTemplate(template)}
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = template.color;
                    e.currentTarget.style.boxShadow = `0 4px 12px ${template.color}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '48px',
                        height: '48px',
                        backgroundColor: template.color + '20',
                        borderRadius: '12px'
                      }}>
                        <IconComponent style={{ width: '24px', height: '24px', color: template.color }} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0 0 4px 0' }}>
                          {template.name}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            fontSize: '12px',
                            backgroundColor: getCategoryColor(template.category) + '20',
                            color: getCategoryColor(template.category),
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontWeight: '500'
                          }}>
                            {template.category}
                          </span>
                          {getPopularityBadge(template.popularity)}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock style={{ width: '14px', height: '14px', color: '#6b7280' }} />
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{template.estimatedTime}</span>
                    </div>
                  </div>

                  <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                    {template.description}
                  </p>

                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 8px 0' }}>
                      Métriques incluses ({template.metrics.length})
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {template.metrics.slice(0, 4).map((metric) => (
                        <span
                          key={metric}
                          style={{
                            fontSize: '12px',
                            backgroundColor: '#f3f4f6',
                            color: '#374151',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}
                        >
                          {metric}
                        </span>
                      ))}
                      {template.metrics.length > 4 && (
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          +{template.metrics.length - 4} autres
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 8px 0' }}>
                      Graphiques ({template.charts.length})
                    </h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {template.charts.map((chart, index) => {
                        const ChartIcon = chart.type === 'bar' ? BarChart3 : 
                                         chart.type === 'line' ? LineChart :
                                         chart.type === 'pie' ? PieChart : Table;
                        return (
                          <div
                            key={index}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              backgroundColor: '#f9fafb',
                              borderRadius: '6px',
                              fontSize: '12px',
                              color: '#6b7280'
                            }}
                          >
                            <ChartIcon style={{ width: '12px', height: '12px' }} />
                            {chart.type}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '16px',
                    borderTop: '1px solid #f3f4f6'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Eye style={{ width: '16px', height: '16px', color: '#6b7280' }} />
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>Aperçu</span>
                    </div>
                    <button
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        backgroundColor: template.color,
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      <Copy style={{ width: '16px', height: '16px' }} />
                      Utiliser ce template
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}




