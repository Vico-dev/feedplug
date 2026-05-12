"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Search, Facebook, ShoppingCart, Zap, Globe, TrendingUp, Check, Sparkles, Camera, type LucideIcon } from "lucide-react";

/** Canaux pour lesquels l'export fichier est déjà disponible (page Flux). */
const EXPORT_READY_IDS = ['gmc', 'meta', 'amazon', 'cdiscount', 'rakuten', 'chatgpt', 'bing', 'pinterest', 'tiktok', 'snapchat', 'yandex', 'baidu', 'perplexity', 'gemini'];

interface Platform {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  available: boolean;
  color: string;
  bgColor: string;
  features: string[];
}

interface Category {
  id: string;
  label: string;
  platforms: Platform[];
}

const EXPORT_CATEGORIES: Category[] = [
  {
    id: 'search',
    label: 'Moteurs de recherche',
    platforms: [
      {
        id: 'gmc',
        name: 'Google Merchant Center',
        description: 'Diffusez vos produits sur Google Shopping et Search',
        icon: Search,
        available: true,
        color: '#4285f4',
        bgColor: '#e8f0fe',
        features: ['Google Shopping', 'Google Search', 'YouTube Shopping']
      },
      {
        id: 'bing',
        name: 'Microsoft Ads (Bing)',
        description: 'Affichez vos produits sur Bing Shopping',
        icon: Globe,
        available: true,
        color: '#008373',
        bgColor: '#e6f7f5',
        features: ['Bing Shopping', 'Microsoft Audience Network']
      },
      {
        id: 'yandex',
        name: 'Yandex Market',
        description: 'Catalogue produits pour le marché russe',
        icon: Search,
        available: true,
        color: '#fc3f1d',
        bgColor: '#ffebe8',
        features: ['Yandex Market', 'Yandex Shopping']
      },
      {
        id: 'baidu',
        name: 'Baidu',
        description: 'Distribution vers le marché chinois',
        icon: Globe,
        available: true,
        color: '#2932e1',
        bgColor: '#e8e9fc',
        features: ['Baidu Shopping', 'Search chinois']
      }
    ]
  },
  {
    id: 'social',
    label: 'Réseaux sociaux',
    platforms: [
      {
        id: 'meta',
        name: 'Meta Business (Facebook & Instagram)',
        description: 'Vendez sur Facebook Shops et Instagram Shopping',
        icon: Facebook,
        available: true,
        color: '#1877f2',
        bgColor: '#e7f3ff',
        features: ['Facebook Shops', 'Instagram Shopping', 'Marketplace']
      },
      {
        id: 'tiktok',
        name: 'TikTok Shop',
        description: 'Vendez directement sur TikTok',
        icon: Zap,
        available: true,
        color: '#000000',
        bgColor: '#f5f5f5',
        features: ['TikTok Shop', 'Live Shopping']
      },
      {
        id: 'snapchat',
        name: 'Snapchat',
        description: 'Publicité produits et dynamic ads',
        icon: Camera,
        available: true,
        color: '#fffc00',
        bgColor: '#fffde7',
        features: ['Snap Ads', 'Collection Ads']
      },
      {
        id: 'pinterest',
        name: 'Pinterest Business',
        description: 'Créez des épingles produits automatiquement',
        icon: TrendingUp,
        available: true,
        color: '#e60023',
        bgColor: '#ffe6ec',
        features: ['Pinterest Shopping', 'Épingles enrichies']
      }
    ]
  },
  {
    id: 'marketplace',
    label: 'Marketplaces',
    platforms: [
      {
        id: 'amazon',
        name: 'Amazon Seller Central',
        description: 'Synchronisez votre catalogue avec Amazon',
        icon: ShoppingCart,
        available: true,
        color: '#ff9900',
        bgColor: '#fff4e6',
        features: ['Amazon.fr', 'Amazon.de', 'Amazon.es']
      },
      {
        id: 'cdiscount',
        name: 'Cdiscount',
        description: 'Exportez vers Cdiscount Pro Seller',
        icon: ShoppingCart,
        available: true,
        color: '#eb6909',
        bgColor: '#fff4eb',
        features: ['Cdiscount Pro', 'Marketplace FR']
      },
      {
        id: 'rakuten',
        name: 'Rakuten',
        description: 'Diffusez sur Rakuten France',
        icon: ShoppingCart,
        available: true,
        color: '#bf0000',
        bgColor: '#ffebeb',
        features: ['Rakuten Marketplace', 'Rakuten Ads']
      }
    ]
  },
  {
    id: 'llm',
    label: 'LLMs (Intelligence artificielle)',
    platforms: [
      {
        id: 'chatgpt',
        name: 'ChatGPT',
        description: 'Découverte produits via ChatGPT Shopping',
        icon: Sparkles,
        available: true,
        color: '#10a37f',
        bgColor: '#e8f5f1',
        features: ['Product Feed Spec', 'Agentic Commerce']
      },
      {
        id: 'perplexity',
        name: 'Perplexity',
        description: 'Merchant Program et recherche produits',
        icon: Sparkles,
        available: true,
        color: '#1a1a2e',
        bgColor: '#eef0f5',
        features: ['Buy with Pro', 'Feeds CSV']
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        description: 'Shopping intégré au chatbot Google',
        icon: Sparkles,
        available: true,
        color: '#4285f4',
        bgColor: '#e8f0fe',
        features: ['Shopping Gemini', 'Merchant API']
      }
    ]
  }
];

interface CreateExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateExportModal({ isOpen, onClose }: CreateExportModalProps) {
  const router = useRouter();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const isExportReady = selectedPlatform ? EXPORT_READY_IDS.includes(selectedPlatform) : false;

  const filteredCategories = EXPORT_CATEGORIES.map(cat => ({
    ...cat,
    platforms: cat.platforms.filter(p =>
      searchQuery === "" ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => cat.platforms.length > 0);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '20px'
    }}
    onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
              Créer un flux de sortie
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--ink-3)', marginTop: '4px' }}>
              Sélectionnez le canal vers lequel exporter vos produits
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: 'var(--paper-2)',
              color: 'var(--ink-3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Barre de recherche */}
        <div style={{ padding: '24px', paddingBottom: '16px' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '20px',
              height: '20px',
              color: 'var(--ink-4)'
            }} />
            <input
              type="text"
              placeholder="Rechercher un canal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 44px',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--line)'}
            />
          </div>
        </div>

        {/* Liste par catégories */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 24px 24px'
        }}>
          {filteredCategories.map(category => (
            <div key={category.id} style={{ marginBottom: '28px' }}>
              <h3 style={{
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--ink-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '12px',
                paddingBottom: '6px',
                borderBottom: '1px solid var(--line)'
              }}>
                {category.label}
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '12px'
              }}>
                {category.platforms.map(platform => {
                  const Icon = platform.icon;
                  const isSelected = selectedPlatform === platform.id;
                  
                  return (
                    <div
                      key={platform.id}
                      onClick={() => platform.available && setSelectedPlatform(platform.id)}
                      style={{
                        border: `2px solid ${isSelected ? platform.color : 'var(--line)'}`,
                        borderRadius: '8px',
                        padding: '16px',
                        cursor: platform.available ? 'pointer' : 'not-allowed',
                        opacity: platform.available ? 1 : 0.6,
                        backgroundColor: platform.available ? (isSelected ? platform.bgColor : 'white') : 'var(--paper-2)',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        if (platform.available) {
                          e.currentTarget.style.borderColor = platform.color;
                          e.currentTarget.style.boxShadow = `0 4px 6px -1px ${platform.color}20`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (platform.available) {
                          e.currentTarget.style.borderColor = isSelected ? platform.color : 'var(--line)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                    >
                      {!platform.available && (
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          backgroundColor: 'var(--warning)',
                          color: 'var(--warning)',
                          fontSize: '10px',
                          fontWeight: '600',
                          padding: '3px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Bientôt
                        </div>
                      )}
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: platform.color,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Check style={{ width: '12px', height: '12px' }} />
                        </div>
                      )}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '8px'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          backgroundColor: platform.bgColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Icon style={{ width: '20px', height: '20px', color: platform.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: platform.available ? 'var(--ink)' : 'var(--ink-4)',
                            margin: 0,
                            marginBottom: '2px'
                          }}>
                            {platform.name}
                          </h4>
                        </div>
                      </div>
                      <p style={{
                        fontSize: '12px',
                        color: platform.available ? 'var(--ink-3)' : 'var(--ink-4)',
                        margin: '0 0 8px 0',
                        lineHeight: 1.4
                      }}>
                        {platform.description}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {platform.features.slice(0, 2).map((feature, idx) => (
                          <div key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <div style={{
                              width: '4px',
                              height: '4px',
                              borderRadius: '50%',
                              backgroundColor: platform.available ? platform.color : 'var(--line-strong)'
                            }} />
                            <span style={{
                              fontSize: '11px',
                              color: platform.available ? 'var(--ink-3)' : 'var(--ink-4)'
                            }}>
                              {feature}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: 'var(--ink-4)'
            }}>
              Aucun canal trouvé
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '24px',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--paper-2)'
        }}>
          <div>
            {selectedPlatform && isExportReady && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--success)'
                }} />
                <span style={{ fontSize: '14px', color: 'var(--ink-3)' }}>
                  Export disponible depuis la page Flux (bouton CSV sur chaque flux)
                </span>
              </div>
            )}
            {selectedPlatform && !isExportReady && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--warning)'
                }} />
                <span style={{ fontSize: '14px', color: 'var(--ink-3)' }}>
                  Ce canal sera disponible dans une prochaine version
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                border: '1px solid var(--line-strong)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--ink-2)',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              Annuler
            </button>
            <button
              disabled={!selectedPlatform || !isExportReady}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                color: 'white',
                backgroundColor: selectedPlatform && isExportReady ? '#0a0a0a' : 'var(--line-strong)',
                cursor: selectedPlatform && isExportReady ? 'pointer' : 'not-allowed',
                opacity: selectedPlatform && isExportReady ? 1 : 0.6
              }}
              onClick={() => {
                if (selectedPlatform && isExportReady) {
                  onClose();
                  router.push('/flux');
                }
              }}
            >
              Voir la page Flux
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
