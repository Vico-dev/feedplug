"use client";

import {
  ShoppingCart,
  Package,
  Store,
  Database,
  Code,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import type { SyntheticEvent } from "react";

interface CMSConnector {
  id: string;
  name: string;
  category: 'ecommerce' | 'content' | 'headless' | 'website';
  icon: LucideIcon;
  logo: string;
  description: string;
  features: string[];
  popularity: 'high' | 'medium' | 'low';
}

const cmsConnectors: CMSConnector[] = [
  // E-commerce Principal
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'ecommerce',
    icon: ShoppingCart,
    logo: 'https://cdn.worldvectorlogo.com/logos/shopify-1.svg',
    description: 'Plateforme e-commerce leader avec API REST et GraphQL',
    features: ['API REST', 'GraphQL', 'Webhooks', 'Bulk Operations'],
    popularity: 'high'
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    category: 'ecommerce',
    icon: Store,
    logo: 'https://cdn.worldvectorlogo.com/logos/woocommerce.svg',
    description: 'Plugin e-commerce pour WordPress',
    features: ['API REST', 'Webhooks', 'Extensions', 'WordPress'],
    popularity: 'high'
  },
  {
    id: 'prestashop',
    name: 'PrestaShop',
    category: 'ecommerce',
    icon: Package,
    logo: 'https://cdn.worldvectorlogo.com/logos/prestashop.svg',
    description: 'Solution e-commerce open source',
    features: ['API REST', 'Webhooks', 'Modules', 'Multi-store'],
    popularity: 'high'
  },
  {
    id: 'salesforce',
    name: 'Salesforce Commerce Cloud',
    category: 'ecommerce',
    icon: Database,
    logo: 'https://cdn.worldvectorlogo.com/logos/salesforce.svg',
    description: 'Plateforme e-commerce enterprise Salesforce',
    features: ['API REST', 'B2B/B2C', 'Multi-site', 'AI Commerce'],
    popularity: 'high'
  }
];

interface CMSConnectorsProps {
  onSelect: (connectorId: string) => void;
}

export function CMSConnectors({ onSelect }: CMSConnectorsProps) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ecommerce': return '#10b981'; // green
      case 'content': return '#3b82f6'; // blue
      case 'headless': return '#8b5cf6'; // purple
      case 'website': return '#f59e0b'; // yellow
      default: return '#6b7280'; // gray
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'ecommerce': return 'E-commerce';
      case 'content': return 'Content Management';
      case 'headless': return 'Headless CMS';
      case 'website': return 'Website Builder';
      default: return 'Autre';
    }
  };

  const getPopularityBadge = (popularity: string) => {
    switch (popularity) {
      case 'high': return { label: 'Populaire', color: '#10b981' };
      case 'medium': return { label: 'Standard', color: '#f59e0b' };
      case 'low': return { label: 'Spécialisé', color: '#6b7280' };
      default: return { label: 'Standard', color: '#6b7280' };
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
          Connecteurs E-commerce disponibles
        </h3>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>
          Sélectionnez votre plateforme e-commerce pour une configuration optimisée
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {cmsConnectors.map((connector) => {
          const IconComponent = connector.icon;
          const categoryColor = getCategoryColor(connector.category);
          const popularityBadge = getPopularityBadge(connector.popularity);

          return (
            <div
              key={connector.id}
              onClick={() => onSelect(connector.id)}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '20px',
                backgroundColor: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#2563eb';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.15)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Header avec icône et badges */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden'
                }}>
                  <Image
                    src={connector.logo}
                    alt={`${connector.name} logo`}
                    width={32}
                    height={32}
                    style={{
                      objectFit: 'contain',
                      maxWidth: '100%',
                      maxHeight: '100%'
                    }}
                    onError={(event: SyntheticEvent<HTMLImageElement>) => {
                      // Fallback vers l'icône si le logo ne charge pas
                      event.currentTarget.style.display = 'none';
                      const nextElement = event.currentTarget.nextElementSibling;
                      if (nextElement) {
                        (nextElement as HTMLElement).style.display = 'flex';
                      }
                    }}
                  />
                  <div style={{
                    display: 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    color: categoryColor
                  }}>
                    <IconComponent style={{ width: '20px', height: '20px' }} />
                  </div>
                </div>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: '0 0 4px 0' }}>
                      {connector.name}
                    </h4>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '500',
                        color: categoryColor,
                        backgroundColor: `${categoryColor}15`,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase'
                      }}>
                        {getCategoryLabel(connector.category)}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '500',
                        color: popularityBadge.color,
                        backgroundColor: `${popularityBadge.color}15`,
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {popularityBadge.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px', lineHeight: '1.5' }}>
                {connector.description}
              </p>

              {/* Features */}
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                  Fonctionnalités :
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {connector.features.map((feature, index) => (
                    <span
                      key={index}
                      style={{
                        fontSize: '11px',
                        color: '#6b7280',
                        backgroundColor: '#f3f4f6',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                color: '#2563eb'
              }}>
                Cliquer pour configurer →
              </div>
            </div>
          );
        })}
      </div>

      {/* Option API personnalisée */}
      <div style={{ marginTop: '24px', padding: '20px', border: '2px dashed #d1d5db', borderRadius: '12px', textAlign: 'center' }}>
        <Code style={{ width: '32px', height: '32px', color: '#6b7280', margin: '0 auto 12px auto' }} />
        <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
          Autre plateforme ?
        </h4>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
          Votre plateforme n&apos;est pas listée ? Pas de problème, nous pouvons configurer une connexion API personnalisée.
        </p>
        <button
          onClick={() => onSelect('custom')}
          style={{
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: '1px solid #d1d5db',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e5e7eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f3f4f6';
          }}
        >
          Configurer une API personnalisée
        </button>
      </div>
    </div>
  );
}



