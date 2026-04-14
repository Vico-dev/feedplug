"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ShoppingCart,
  Database,
  FileText,
  Zap,
  Star
} from 'lucide-react';

export type ConnectorKey = 'shopify' | 'csv' | 'erp' | 'pim' | 'reviews' | 'images' | 'stock';

interface ConnectorCatalogProps {
  onSelect: (connector: ConnectorKey) => void;
}

export function ConnectorCatalog({ onSelect }: ConnectorCatalogProps) {
  const [tab, setTab] = useState<'primary' | 'secondary'>('primary');

  const primaryConnectors: Array<{ key: ConnectorKey; title: string; description: string; icon: React.ReactNode }>= [
    { key: 'shopify', title: 'Shopify', description: 'Boutique e‑commerce', icon: <ShoppingCart style={{ width: 18, height: 18, color: '#3b82f6' }} /> },
    { key: 'csv', title: 'Fichier CSV', description: 'Import manuel', icon: <FileText style={{ width: 18, height: 18, color: '#6b7280' }} /> },
    { key: 'erp', title: 'ERP', description: 'Catalogue de base', icon: <Database style={{ width: 18, height: 18, color: '#0ea5e9' }} /> },
    { key: 'pim', title: 'PIM', description: 'Gestion d’info produits', icon: <Star style={{ width: 18, height: 18, color: '#f59e0b' }} /> },
  ];

  const secondaryConnectors: Array<{ key: ConnectorKey; title: string; description: string; icon: React.ReactNode }>= [
    { key: 'reviews', title: 'Avis', description: 'Notes et commentaires', icon: <Zap style={{ width: 18, height: 18, color: '#22c55e' }} /> },
    { key: 'images', title: 'Images', description: 'CDN / retouche', icon: <Zap style={{ width: 18, height: 18, color: '#a855f7' }} /> },
    { key: 'stock', title: 'Stocks', description: 'Mise à jour inventaire', icon: <Zap style={{ width: 18, height: 18, color: '#ef4444' }} /> },
  ];

  const list = tab === 'primary' ? primaryConnectors : secondaryConnectors;

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px 0' }}>
        Choisissez un connecteur à ajouter. Vous pourrez le configurer à l’étape suivante.
      </p>

      {/* Onglets "pills" */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, background: '#f3f4f6', borderRadius: 9999, padding: 4 }}>
        <button
          onClick={() => setTab('primary')}
          style={{
            border: 'none',
            background: tab === 'primary' ? 'white' : 'transparent',
            color: '#111827',
            padding: '8px 14px',
            borderRadius: 9999,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: tab === 'primary' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            cursor: 'pointer'
          }}
        >
          Sources principales
        </button>
        <button
          onClick={() => setTab('secondary')}
          style={{
            border: 'none',
            background: tab === 'secondary' ? 'white' : 'transparent',
            color: '#111827',
            padding: '8px 14px',
            borderRadius: 9999,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: tab === 'secondary' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            cursor: 'pointer'
          }}
        >
          Sources secondaires
        </button>
      </div>

      {/* Grille de connecteurs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {list.map(item => (
          <Card
            key={item.key}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 16,
              backgroundColor: 'white',
              padding: 16,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(17, 24, 39, 0.06)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{item.title}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{item.description}</div>
              </div>
            </div>
            <Button
              onClick={() => onSelect(item.key)}
              style={{
                width: '100%',
                background: 'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                padding: '10px 14px',
                fontWeight: 600
              }}
            >
              Sélectionner
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}



