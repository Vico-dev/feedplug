"use client";

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X, ChevronLeft, Check, ArrowRight, Database, Layers, TrendingUp, Settings, BarChart3, Package, Filter, Zap } from 'lucide-react';
import { useOnboarding } from '@/contexts/onboarding-context';
import { getLocalePrefixFromPathname } from '@/lib/locale-navigation';

const FEEDPLUG_BLACK = '#0a0a0a';
const FEEDPLUG_BORDER = 'var(--line)';
const FEEDPLUG_MUTED = 'var(--ink-3)';
const FEEDPLUG_BG = 'var(--paper-2)';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  redirectTo?: string;
  isModal?: boolean;
}

export function OnboardingTour() {
  const { isTourOpen, completeOnboarding, onboardingState } = useOnboarding();
  const [currentStep, setCurrentStep] = useState(onboardingState.currentStep);
  const router = useRouter();
  const pathname = usePathname();
  const localePrefix = getLocalePrefixFromPathname(pathname);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Bienvenue sur FeedPlug !',
      description: 'Votre plateforme d\'optimisation de flux e-commerce',
      icon: <TrendingUp style={{ width: '32px', height: '32px', color: FEEDPLUG_BLACK }} />,
      isModal: true,
      content: (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{
            width: '80px',
            height: '80px',
            backgroundColor: FEEDPLUG_BG,
            border: `2px solid ${FEEDPLUG_BORDER}`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: '32px'
          }}>
            🚀
          </div>
          <h3 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: FEEDPLUG_BLACK,
            margin: '0 0 16px 0'
          }}>
            Prêt à optimiser vos flux produits ?
          </h3>
          <p style={{
            fontSize: '16px',
            color: FEEDPLUG_MUTED,
            lineHeight: '1.6',
            margin: '0 0 24px 0'
          }}>
            FeedPlug vous aide à centraliser, synchroniser et optimiser vos flux produits
            entre toutes vos plateformes e-commerce.
          </p>
          <div style={{
            backgroundColor: FEEDPLUG_BG,
            border: `1px solid ${FEEDPLUG_BORDER}`,
            borderRadius: '10px',
            padding: '16px',
            margin: '24px 0'
          }}>
            <p style={{
              fontSize: '14px',
              color: FEEDPLUG_MUTED,
              margin: 0,
              fontWeight: '500'
            }}>
              💡 <strong>Conseil :</strong> Cette visite guidée vous prendra 2 minutes et vous montrera
              toutes les fonctionnalités essentielles.
            </p>
          </div>
        </div>
      ),
      action: {
        label: 'Commencer la visite',
        onClick: () => handleNext()
      }
    },
    {
      id: 'dashboard',
      title: 'Tableau de bord',
      description: 'Vue d\'ensemble de vos flux et performances',
      icon: <BarChart3 style={{ width: '24px', height: '24px', color: FEEDPLUG_BLACK }} />,
      redirectTo: '/dashboard',
      content: (
        <div style={{ padding: '16px 0' }}>
          <p style={{ fontSize: '16px', color: FEEDPLUG_BLACK, margin: '0 0 16px 0' }}>
            Votre tableau de bord centralise toutes les informations importantes :
          </p>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: '0 0 24px 0',
            fontSize: '14px',
            color: FEEDPLUG_MUTED
          }}>
            <li style={{ margin: '8px 0', display: 'flex', alignItems: 'center' }}>
              <Check style={{ width: '16px', height: '16px', color: 'var(--success)', marginRight: '8px' }} />
              Statistiques de synchronisation en temps réel
            </li>
            <li style={{ margin: '8px 0', display: 'flex', alignItems: 'center' }}>
              <Check style={{ width: '16px', height: '16px', color: 'var(--success)', marginRight: '8px' }} />
              Activité récente et notifications
            </li>
            <li style={{ margin: '8px 0', display: 'flex', alignItems: 'center' }}>
              <Check style={{ width: '16px', height: '16px', color: 'var(--success)', marginRight: '8px' }} />
              Accès rapide aux fonctionnalités principales
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'sources',
      title: 'Sources de données',
      description: 'Connectez vos plateformes e-commerce',
      icon: <Database style={{ width: '24px', height: '24px', color: FEEDPLUG_BLACK }} />,
      redirectTo: '/sources',
      content: (
        <div style={{ padding: '16px 0' }}>
          <p style={{ fontSize: '16px', color: FEEDPLUG_BLACK, margin: '0 0 16px 0' }}>
            Connectez vos sources de données pour commencer :
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px',
            margin: '16px 0'
          }}>
            {['Shopify', 'WooCommerce', 'Magento', 'PrestaShop'].map((platform) => (
              <div key={platform} style={{
                backgroundColor: FEEDPLUG_BG,
                border: `1px solid ${FEEDPLUG_BORDER}`,
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: '500',
                color: FEEDPLUG_BLACK
              }}>
                {platform}
              </div>
            ))}
          </div>
          <p style={{ fontSize: '14px', color: FEEDPLUG_MUTED, margin: '16px 0 0 0' }}>
            Chaque connexion est sécurisée et chiffrée pour protéger vos données.
          </p>
        </div>
      )
    },
    {
      id: 'catalogue',
      title: 'Catalogue',
      description: 'Vos produits centralisés',
      icon: <Package style={{ width: '24px', height: '24px', color: FEEDPLUG_BLACK }} />,
      redirectTo: '/catalogue',
      content: (
        <div style={{ padding: '16px 0' }}>
          <p style={{ fontSize: '16px', color: FEEDPLUG_BLACK, margin: '0 0 16px 0' }}>
            Le catalogue centralise tous vos produits importés depuis vos sources :
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px 0', fontSize: '14px', color: FEEDPLUG_MUTED }}>
            <li style={{ margin: '8px 0', display: 'flex', alignItems: 'center' }}>
              <Check style={{ width: '16px', height: '16px', color: 'var(--success)', marginRight: '8px' }} />
              Score qualité du catalogue
            </li>
            <li style={{ margin: '8px 0', display: 'flex', alignItems: 'center' }}>
              <Check style={{ width: '16px', height: '16px', color: 'var(--success)', marginRight: '8px' }} />
              Mapping des champs par flux
            </li>
            <li style={{ margin: '8px 0', display: 'flex', alignItems: 'center' }}>
              <Check style={{ width: '16px', height: '16px', color: 'var(--success)', marginRight: '8px' }} />
              Enrichissement et optimisation
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'flux',
      title: 'Flux d\'export',
      description: 'Exportez vers vos canaux',
      icon: <Layers style={{ width: '24px', height: '24px', color: FEEDPLUG_BLACK }} />,
      redirectTo: '/flux',
      content: (
        <div style={{ padding: '16px 0' }}>
          <p style={{ fontSize: '16px', color: FEEDPLUG_BLACK, margin: '0 0 16px 0' }}>
            Créez des flux d&apos;export vers vos canaux (Google Merchant, Meta, Amazon, TikTok, etc.) :
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0 0', fontSize: '14px', color: FEEDPLUG_MUTED }}>
            <li style={{ margin: '6px 0', display: 'flex', alignItems: 'center' }}>
              <Zap style={{ width: '14px', height: '14px', color: FEEDPLUG_BLACK, marginRight: '8px' }} />
              Export CSV par plateforme
            </li>
            <li style={{ margin: '6px 0', display: 'flex', alignItems: 'center' }}>
              <Zap style={{ width: '14px', height: '14px', color: FEEDPLUG_BLACK, marginRight: '8px' }} />
              Push GMC et Amazon
            </li>
            <li style={{ margin: '6px 0', display: 'flex', alignItems: 'center' }}>
              <Zap style={{ width: '14px', height: '14px', color: FEEDPLUG_BLACK, marginRight: '8px' }} />
              Règles et A/B appliqués à l&apos;export
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'optimiser',
      title: 'Règles & optimisation',
      description: 'Titres, descriptions, A/B par canal',
      icon: <Filter style={{ width: '24px', height: '24px', color: FEEDPLUG_BLACK }} />,
      redirectTo: '/optimiser',
      content: (
        <div style={{ padding: '16px 0' }}>
          <p style={{ fontSize: '16px', color: FEEDPLUG_BLACK, margin: '0 0 16px 0' }}>
            Définissez des règles d&apos;optimisation et des tests A/B sur titres, descriptions et images.
          </p>
        </div>
      )
    },
    {
      id: 'ia',
      title: 'Intelligence Artificielle',
      description: 'Optimisez vos flux avec l\'IA',
      icon: <Settings style={{ width: '24px', height: '24px', color: FEEDPLUG_BLACK }} />,
      redirectTo: '/optimiser/ia',
      content: (
        <div style={{ padding: '16px 0' }}>
          <p style={{ fontSize: '16px', color: FEEDPLUG_BLACK, margin: '0 0 16px 0' }}>
            Notre IA vous aide à optimiser vos flux automatiquement :
          </p>
          <div style={{
            backgroundColor: FEEDPLUG_BG,
            border: `1px solid ${FEEDPLUG_BORDER}`,
            borderRadius: '8px',
            padding: '16px',
            margin: '16px 0'
          }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: FEEDPLUG_BLACK, margin: '0 0 8px 0' }}>
              🤖 Suggestions IA
            </h4>
            <p style={{ fontSize: '14px', color: FEEDPLUG_MUTED, margin: 0 }}>
              &quot;Nous avons détecté que vos produits Shopify ont des descriptions plus détaillées.
              Voulez-vous les synchroniser vers Amazon ?&quot;
            </p>
          </div>
          <p style={{ fontSize: '14px', color: FEEDPLUG_MUTED, margin: '16px 0 0 0' }}>
            L&apos;IA apprend de vos habitudes et propose des optimisations personnalisées.
          </p>
        </div>
      )
    },
    {
      id: 'completion',
      title: 'Félicitations !',
      description: 'Vous êtes prêt à utiliser FeedPlug',
      icon: <Check style={{ width: '32px', height: '32px', color: 'var(--success)' }} />,
      isModal: true,
      content: (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{
            width: '80px',
            height: '80px',
            backgroundColor: FEEDPLUG_BG,
            border: `2px solid ${FEEDPLUG_BORDER}`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: '32px'
          }}>
            🎉
          </div>
          <h3 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: FEEDPLUG_BLACK,
            margin: '0 0 16px 0'
          }}>
            Onboarding terminé !
          </h3>
          <p style={{
            fontSize: '16px',
            color: FEEDPLUG_MUTED,
            lineHeight: '1.6',
            margin: '0 0 24px 0'
          }}>
            Vous connaissez maintenant les bases de FeedPlug.
            Commencez par connecter votre première source de données !
          </p>
          <div style={{
            backgroundColor: FEEDPLUG_BG,
            border: `1px solid ${FEEDPLUG_BORDER}`,
            borderRadius: '10px',
            padding: '16px',
            margin: '24px 0'
          }}>
            <p style={{
              fontSize: '14px',
              color: FEEDPLUG_MUTED,
              margin: 0,
              fontWeight: '500'
            }}>
              💡 <strong>Prochaine étape :</strong> Allez dans &quot;Sources&quot; pour connecter votre première plateforme e-commerce.
            </p>
          </div>
        </div>
      ),
      action: {
        label: 'Commencer à utiliser FeedPlug',
        onClick: () => {
          completeOnboarding();
          router.push(`${localePrefix}/sources`);
        }
      }
    }
  ];

  const currentStepData = steps[currentStep];

  const handleNext = () => {
    const nextStep = currentStep + 1;

    if (nextStep < steps.length) {
      setCurrentStep(nextStep);
      // Rediriger vers la page de l'étape qu'on affiche maintenant (pour que la page = le contenu de la modale)
      const target = steps[nextStep];
      if (target?.redirectTo) {
        router.push(`${localePrefix}${target.redirectTo}`);
      }
    } else {
      completeOnboarding();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      const target = steps[prevStep];
      if (target?.redirectTo) {
        router.push(`${localePrefix}${target.redirectTo}`);
      }
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  if (!isTourOpen) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(10, 10, 10, 0.4)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0,0,0,0.04)',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 24px 0 24px',
          borderBottom: `1px solid ${FEEDPLUG_BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {currentStepData.icon}
            <div>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: FEEDPLUG_BLACK,
                margin: 0
              }}>
                {currentStepData.title}
              </h2>
              <p style={{
                fontSize: '14px',
                color: FEEDPLUG_MUTED,
                margin: '4px 0 0 0'
              }}>
                {currentStepData.description}
              </p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              color: FEEDPLUG_MUTED,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = FEEDPLUG_BG;
              e.currentTarget.style.color = FEEDPLUG_BLACK;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = FEEDPLUG_MUTED;
            }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {currentStepData.content}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0 24px 24px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {steps.map((_, index) => (
              <div
                key={index}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: index <= currentStep ? FEEDPLUG_BLACK : FEEDPLUG_BORDER,
                  transition: 'background-color 0.2s ease'
                }}
              />
            ))}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                type="button"
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${FEEDPLUG_BORDER}`,
                  borderRadius: '8px',
                  color: FEEDPLUG_BLACK,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = FEEDPLUG_BG;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <ChevronLeft style={{ width: '16px', height: '16px' }} />
                Précédent
              </button>
            )}

            {currentStepData.action ? (
              <button
                type="button"
                onClick={currentStepData.action.onClick}
                style={{
                  padding: '12px 24px',
                  backgroundColor: FEEDPLUG_BLACK,
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#262626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = FEEDPLUG_BLACK;
                }}
              >
                {currentStepData.action.label}
                <ArrowRight style={{ width: '16px', height: '16px' }} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                style={{
                  padding: '12px 24px',
                  backgroundColor: FEEDPLUG_BLACK,
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#262626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = FEEDPLUG_BLACK;
                }}
              >
                {currentStep === steps.length - 1 ? 'Terminer' : 'Suivant'}
                <ArrowRight style={{ width: '16px', height: '16px' }} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
