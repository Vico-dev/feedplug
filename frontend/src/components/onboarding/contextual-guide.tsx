"use client";

import { useState } from 'react';
import { X, ChevronRight, CheckCircle, ArrowRight } from 'lucide-react';
import { useOnboarding } from '@/contexts/onboarding-context';

interface ContextualGuideProps {
  step: number;
  title: string;
  description: string;
  content: React.ReactNode;
  onNext: () => void;
  onSkip: () => void;
}

export function ContextualGuide({ step, title, description, content, onNext, onSkip }: ContextualGuideProps) {
  const [isVisible, setIsVisible] = useState(true);
  const { onboardingState } = useOnboarding();

  // Ne pas afficher si l'onboarding est terminé
  if (onboardingState.isCompleted) return null;

  const handleNext = () => {
    setIsVisible(false);
    setTimeout(onNext, 300);
  };

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(onSkip, 300);
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      right: '24px',
      zIndex: 100,
      maxWidth: '400px',
      width: '100%',
      backgroundColor: 'white',
      border: '1px solid var(--line)',
      borderRadius: '12px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      animation: 'slideInRight 0.3s ease-out'
    }}>
      <div style={{
        padding: '20px',
        borderBottom: '1px solid var(--line)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              backgroundColor: 'var(--accent)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              {step}
            </div>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--ink-2)',
              margin: 0
            }}>
              {title}
            </h3>
          </div>
          <button
            onClick={handleSkip}
            style={{
              width: '24px',
              height: '24px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--ink-4)',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--paper-2)';
              e.currentTarget.style.color = 'var(--ink-3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--ink-4)';
            }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
        <p style={{
          fontSize: '14px',
          color: 'var(--ink-3)',
          margin: '0 0 16px 0',
          lineHeight: '1.5'
        }}>
          {description}
        </p>
      </div>

      <div style={{
        padding: '20px'
      }}>
        {content}
      </div>

      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--line)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button
          onClick={handleSkip}
          style={{
            padding: '8px 16px',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--ink-3)',
            cursor: 'pointer',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--paper-2)';
            e.currentTarget.style.color = 'var(--ink-2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--ink-3)';
          }}
        >
          Passer
        </button>
        
        <button
          onClick={handleNext}
          style={{
            padding: '10px 20px',
            border: 'none',
            backgroundColor: 'var(--accent)',
            color: 'white',
            cursor: 'pointer',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent)';
          }}
        >
          Suivant
          <ChevronRight style={{ width: '16px', height: '16px' }} />
        </button>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

// Composant spécifique pour la page Sources
export function SourcesGuide() {
  const { nextStep, skipStep } = useOnboarding();

  return (
    <ContextualGuide
      step={2}
      title="Configurez votre source"
      description="Connectez votre e-commerce pour importer vos produits"
      content={
        <div>
          <div style={{
            backgroundColor: 'var(--accent-bg)',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <p style={{
              fontSize: '14px',
              color: 'var(--accent-2)',
              margin: '0 0 8px 0',
              fontWeight: '500'
            }}>
              💡 Conseil
            </p>
            <p style={{
              fontSize: '14px',
              color: 'var(--accent-2)',
              margin: 0,
              lineHeight: '1.5'
            }}>
              Cliquez sur &quot;Ajouter une source&quot; pour connecter votre plateforme e-commerce.
            </p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: 'var(--ink-3)'
          }}>
            <CheckCircle style={{ width: '16px', height: '16px', color: 'var(--success)' }} />
            <span>Une fois connectée, vos produits seront automatiquement synchronisés</span>
          </div>
        </div>
      }
      onNext={nextStep}
      onSkip={skipStep}
    />
  );
}

// Composant spécifique pour la page Flux
export function FluxGuide() {
  const { nextStep, skipStep } = useOnboarding();

  return (
    <ContextualGuide
      step={3}
      title="Créez votre flux d'export"
      description="Configurez l'envoi de vos produits vers les plateformes marketing"
      content={
        <div>
          <div style={{
            backgroundColor: 'var(--warning-bg)',
            border: '1px solid var(--warning)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <p style={{
              fontSize: '14px',
              color: 'var(--warning)',
              margin: '0 0 8px 0',
              fontWeight: '500'
            }}>
              🎯 Recommandation
            </p>
            <p style={{
              fontSize: '14px',
              color: 'var(--warning)',
              margin: 0,
              lineHeight: '1.5'
            }}>
              Commencez par Google Shopping pour maximiser votre visibilité.
            </p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: 'var(--ink-3)'
          }}>
            <ArrowRight style={{ width: '16px', height: '16px', color: 'var(--accent)' }} />
            <span>Cliquez sur &quot;Nouveau flux&quot; pour commencer</span>
          </div>
        </div>
      }
      onNext={nextStep}
      onSkip={skipStep}
    />
  );
}

// Composant spécifique pour la page IA
export function IAGuide() {
  const { nextStep, skipStep } = useOnboarding();

  return (
    <ContextualGuide
      step={4}
      title="Optimisez avec l'IA"
      description="Configurez les mappings et optimisations automatiques"
      content={
        <div>
          <div style={{
            backgroundColor: 'var(--success-bg)',
            border: '1px solid #BBF7D0',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <p style={{
              fontSize: '14px',
              color: 'var(--success)',
              margin: '0 0 8px 0',
              fontWeight: '500'
            }}>
              ✨ IA d&apos;optimisation
            </p>
            <p style={{
              fontSize: '14px',
              color: 'var(--success)',
              margin: 0,
              lineHeight: '1.5'
            }}>
              Notre IA analyse vos produits et suggère automatiquement les meilleurs mappings.
            </p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: 'var(--ink-3)'
          }}>
            <CheckCircle style={{ width: '16px', height: '16px', color: 'var(--success)' }} />
            <span>Les optimisations sont appliquées automatiquement</span>
          </div>
        </div>
      }
      onNext={nextStep}
      onSkip={skipStep}
    />
  );
}

// Composant spécifique pour le Dashboard
export function DashboardGuide() {
  const { nextStep, skipStep } = useOnboarding();

  return (
    <ContextualGuide
      step={5}
      title="Surveillez vos performances"
      description="Découvrez votre dashboard et les métriques en temps réel"
      content={
        <div>
          <div style={{
            backgroundColor: 'var(--accent-bg)',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <p style={{
              fontSize: '14px',
              color: 'var(--accent-2)',
              margin: '0 0 8px 0',
              fontWeight: '500'
            }}>
              📊 Métriques clés
            </p>
            <p style={{
              fontSize: '14px',
              color: 'var(--accent-2)',
              margin: 0,
              lineHeight: '1.5'
            }}>
              Surveillez vos flux, détectez les erreurs et optimisez vos performances.
            </p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: 'var(--ink-3)'
          }}>
            <CheckCircle style={{ width: '16px', height: '16px', color: 'var(--success)' }} />
            <span>Vos données sont mises à jour en temps réel</span>
          </div>
        </div>
      }
      onNext={nextStep}
      onSkip={skipStep}
    />
  );
}

