"use client";

import React, { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { 
  CheckCircle,
  ArrowRight,
  Shield,
  Database,
  Zap,
  TrendingUp,
  Globe,
  MapPin,
  Rocket,
  Target,
  Clock,
  BarChart3,
  TestTube,
  Sparkles,
  Eye,
  FileText
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Link } from '@/i18n/routing';
import MarketingHeader from '@/components/marketing/MarketingHeader';

export default function MarketingLandingPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Intersection Observer pour les animations au scroll
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, observerOptions);

    const elements = document.querySelectorAll('.fade-in-element');
    elements.forEach(el => observer.observe(el));

    return () => {
      elements.forEach(el => observer.unobserve(el));
    };
  }, []);

  const handleEarlyAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      console.log('📤 Envoi du formulaire...', {
        firstName: firstName.trim(),
        email: email.trim(),
        locale: locale
      });

      const response = await apiClient.post('/marketing/early-access', {
        firstName: firstName.trim(),
        email: email.trim(),
        locale: locale
      });

      console.log('✅ Réponse reçue:', response);

      setIsSubmitted(true);
      setFirstName('');
      setEmail('');
    } catch (err: any) {
      console.error('❌ Erreur inscription early access:', err);
      console.error('❌ Détails de l\'erreur:', JSON.stringify(err, null, 2));
      
      // Extraire le message d'erreur (API renvoie message ou response.message)
      let errorMessage = t('error.generic');
      if (err?.message) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err?.response?.message) {
        errorMessage = err.response.message;
      } else if (err?.data?.message) {
        errorMessage = err.data.message;
      }
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .fade-in-element {
          opacity: 0;
        }
        
        .fade-in-element.animate-in {
          animation: fadeInUp 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        
        .fade-in-element.delay-100 {
          animation-delay: 0.1s;
        }
        
        .fade-in-element.delay-200 {
          animation-delay: 0.2s;
        }
        
        .fade-in-element.delay-300 {
          animation-delay: 0.3s;
        }
        
        .fade-in-element.delay-400 {
          animation-delay: 0.4s;
        }
        
        .hero-text {
          animation: fadeInUp 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        
        .hero-subtitle {
          animation: fadeInUp 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s forwards;
          opacity: 0;
        }
        
        .hero-description {
          animation: fadeInUp 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.4s forwards;
          opacity: 0;
        }
        
        .hero-form {
          animation: fadeInUp 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.6s forwards;
          opacity: 0;
        }
        
        .icon-hover {
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        
        .icon-hover:hover {
          transform: translateY(-4px) scale(1.05);
        }
        
        .feature-card {
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        
        .feature-card:hover {
          transform: translateY(-4px);
        }
        
        .nav-link {
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          position: relative;
        }
        
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 1px;
          background-color: #0a0a0a;
          transition: width 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        
        .nav-link:hover::after {
          width: 100%;
        }
        
        .button-hover {
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          position: relative;
          overflow: hidden;
        }
        
        .button-hover::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        
        .button-hover:hover::before {
          width: 300px;
          height: 300px;
        }
        
        .button-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(10, 10, 10, 0.15);
        }
        
        .button-hover:hover .arrow-icon {
          transform: translateX(4px);
        }
        
        .input-focus {
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        
        .input-focus:focus {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(10, 10, 10, 0.08);
        }
        
        .success-message {
          animation: scaleIn 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        
        /* Responsive Styles */
        @media (max-width: 1024px) {
          .responsive-grid-3 {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .responsive-grid-2 {
            grid-template-columns: 1fr !important;
          }
        }
        
        @media (max-width: 768px) {
          .responsive-grid-3 {
            grid-template-columns: 1fr !important;
          }
          .responsive-padding {
            padding: 60px 24px !important;
          }
          .responsive-hero-padding {
            padding: 80px 24px 60px !important;
          }
          .responsive-text {
            font-size: clamp(32px, 8vw, 56px) !important;
          }
          .responsive-text-small {
            font-size: 18px !important;
          }
          .responsive-nav {
            flex-direction: column;
            gap: 24px !important;
            padding: 16px 24px !important;
          }
          .responsive-nav-links {
            gap: 24px !important;
            flex-wrap: wrap;
          }
        }
        
        @media (max-width: 480px) {
          .responsive-grid-3 {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
          .responsive-padding {
            padding: 48px 20px !important;
          }
          .responsive-hero-padding {
            padding: 60px 20px 48px !important;
          }
          .responsive-text {
            font-size: clamp(28px, 7vw, 40px) !important;
          }
          .responsive-text-small {
            font-size: 16px !important;
          }
          .responsive-form-grid {
            grid-template-columns: 1fr !important;
          }
          
          .responsive-form-grid > div {
            grid-template-columns: 1fr !important;
          }
        }
      `}} />
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        color: '#0a0a0a'
      }}>
      <MarketingHeader />

      {/* Hero Section Enterprise */}
      <section id="hero" className="responsive-hero-padding" style={{
        padding: '100px 48px 80px',
        backgroundColor: '#ffffff'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div className="hero-subtitle" style={{
            fontSize: '14px',
            fontWeight: '600',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#0a0a0a',
            marginBottom: '40px'
          }}>
            {t('hero.tagline')}
          </div>
          
          <h1 className="hero-text responsive-text" style={{
            fontSize: 'clamp(48px, 6vw, 80px)',
            fontWeight: '400',
            lineHeight: '1.1',
            marginBottom: '32px',
            letterSpacing: '-0.03em',
            color: '#0a0a0a',
            maxWidth: '900px'
          }}>
            {t('hero.title')}
            <br />
            <span style={{ fontWeight: '300', color: '#4a4a4a' }}>{t('hero.titleHighlight')}</span>
            <br />
            <span style={{ fontWeight: '400', color: '#0a0a0a' }}>{t('hero.titleEnd')}</span>
          </h1>
          
          <p className="hero-description responsive-text-small" style={{
            fontSize: '20px',
            lineHeight: '1.6',
            marginBottom: '16px',
            color: '#4a4a4a',
            maxWidth: '720px',
            fontWeight: '300',
            letterSpacing: '-0.01em'
          }}>
            {t('hero.description')}
          </p>
          <p className="hero-description responsive-text-small" style={{
            fontSize: '14px',
            lineHeight: '1.5',
            marginBottom: '48px',
            color: '#6b7280',
            maxWidth: '720px',
            fontWeight: '400',
            letterSpacing: '0.02em'
          }}>
            {t('hero.channels')}
          </p>

          {/* Formulaire Enterprise */}
          {!isSubmitted ? (
            <form onSubmit={handleEarlyAccess} className="hero-form responsive-form-grid" style={{ maxWidth: '640px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder={`${t('form.firstName')} *`}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="input-focus"
                  style={{
                    padding: '16px 20px',
                    border: '1px solid #d1d5db',
                    fontSize: '15px',
                    outline: 'none',
                    backgroundColor: '#ffffff',
                    color: '#0a0a0a',
                    fontFamily: 'inherit',
                    borderRadius: '2px'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0a0a0a'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
                <input
                  type="email"
                  placeholder={`${t('form.email')} *`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-focus"
                  style={{
                    padding: '16px 20px',
                    border: '1px solid #d1d5db',
                    fontSize: '15px',
                    outline: 'none',
                    backgroundColor: '#ffffff',
                    color: '#0a0a0a',
                    fontFamily: 'inherit',
                    borderRadius: '2px'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0a0a0a'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
              
              {error && (
                <div style={{
                  color: '#dc2626',
                  fontSize: '14px',
                  marginBottom: '16px',
                  animation: 'fadeIn 0.3s ease-out'
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="button-hover"
                style={{
                  padding: '16px 32px',
                  backgroundColor: '#0a0a0a',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '15px',
                  fontWeight: '400',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                  letterSpacing: '0.02em',
                  fontFamily: 'inherit',
                  borderRadius: '2px',
                  position: 'relative'
                }}
              >
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isSubmitting ? (
                    t('form.submitting')
                  ) : (
                    <>
                      {t('form.submit')}
                      <ArrowRight className="arrow-icon" style={{ width: '16px', height: '16px', transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
                    </>
                  )}
                </span>
              </button>
            
              {/* Social Proof Metrics */}
              <div style={{
                display: 'flex',
                gap: '32px',
                marginTop: '48px',
                paddingTop: '32px',
                borderTop: '1px solid #e5e7eb',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#0a0a0a' }}>14</div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>{t('hero.metrics.channels')}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#0a0a0a' }}>&lt; 5 min</div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>{t('hero.metrics.setup')}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#0a0a0a' }}>0-100</div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>{t('hero.metrics.score')}</div>
                </div>
              </div>
            
          </form>
          ) : (
            <div className="success-message" style={{
              maxWidth: '640px',
              padding: '32px',
              border: '1px solid #d1d5db',
              backgroundColor: '#f9fafb',
              borderRadius: '2px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <CheckCircle style={{ width: '20px', height: '20px', color: '#16a34a' }} />
                <div style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a' }}>
                  {t('form.success')}
                </div>
              </div>
              <p style={{ fontSize: '15px', color: '#4a4a4a', margin: 0, lineHeight: '1.5' }}>
                {t('form.successMessage')}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Problem Statement */}
      <section className="responsive-padding" style={{
        padding: '120px 48px',
        backgroundColor: '#fafafa',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="fade-in-element" style={{
            fontSize: '12px',
            fontWeight: '500',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#6b7280',
            marginBottom: '24px'
          }}>
            {t('problem.title')}
          </div>
          
          <p className="fade-in-element delay-100 responsive-text-small" style={{
            fontSize: '20px',
            lineHeight: '1.7',
            color: '#4a4a4a',
            marginBottom: '32px',
            fontWeight: '300',
            maxWidth: '900px'
          }}>
            {t('problem.description')}
          </p>
          
          <p className="fade-in-element delay-200 responsive-text-small" style={{
            fontSize: '18px',
            lineHeight: '1.7',
            color: '#0a0a0a',
            fontWeight: '400',
            maxWidth: '900px'
          }}>
            {t('problem.solution')}
          </p>
        </div>
      </section>

      {/* Comment ça marche — 3 étapes (SEO sémantique) */}
      <section className="responsive-padding" style={{
        padding: '120px 48px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 className="fade-in-element responsive-text" style={{
            fontSize: 'clamp(32px, 4vw, 44px)',
            fontWeight: '400',
            color: '#0a0a0a',
            marginBottom: '16px',
            letterSpacing: '-0.02em'
          }}>
            {t('howItWorks.title')}
          </h2>
          <p className="fade-in-element delay-100 responsive-text-small" style={{
            fontSize: '18px',
            color: '#4a4a4a',
            marginBottom: '48px',
            fontWeight: '300',
            maxWidth: '720px',
            lineHeight: '1.6'
          }}>
            {t('howItWorks.subtitle')}
          </p>
          <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
            {[
              { step: 'step1', icon: <Database style={{ width: '28px', height: '28px', color: '#0a0a0a', flexShrink: 0 }} /> },
              { step: 'step2', icon: <Zap style={{ width: '28px', height: '28px', color: '#0a0a0a', flexShrink: 0 }} /> },
              { step: 'step3', icon: <Globe style={{ width: '28px', height: '28px', color: '#0a0a0a', flexShrink: 0 }} /> }
            ].map(({ step, icon }, idx) => (
              <div key={step} className={`fade-in-element ${idx === 0 ? 'delay-100' : idx === 1 ? 'delay-200' : 'delay-300'}`}>
                <div style={{ marginBottom: '16px' }}>{icon}</div>
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#0a0a0a', marginBottom: '12px', letterSpacing: '-0.01em' }}>
                  {t(`howItWorks.${step}.title`)}
                </h3>
                <p style={{ fontSize: '15px', color: '#4a4a4a', lineHeight: '1.7', margin: 0, fontWeight: '300' }}>
                  {t(`howItWorks.${step}.description`)}
                </p>
              </div>
            ))}
          </div>
          <p className="fade-in-element delay-300" style={{ marginTop: '32px', fontSize: '15px', color: '#6b7280', lineHeight: 1.6 }}>
            {t('resources.title')}{' '}
            <a href="/docs/export" style={{ color: '#0a0a0a', textDecoration: 'underline' }}>{t('resources.exportGuide')}</a>
            {' · '}
            <a href="/docs/score" style={{ color: '#0a0a0a', textDecoration: 'underline' }}>{t('resources.scoreGuide')}</a>
            {' · '}
            <a href="/docs/demarrage" style={{ color: '#0a0a0a', textDecoration: 'underline' }}>{t('resources.demarrage')}</a>
            {' · '}
            <a href="/docs" style={{ color: '#0a0a0a', textDecoration: 'underline' }}>{t('resources.documentation')}</a>
          </p>
        </div>
      </section>

      {/* Key Features */}
      <section id="solutions" className="responsive-padding" style={{
        padding: '120px 48px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div className="fade-in-element" style={{
            fontSize: '12px',
            fontWeight: '500',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#6b7280',
            marginBottom: '16px'
          }}>
            {t('features.title')}
          </div>
          
          <h2 className="fade-in-element delay-100 responsive-text" style={{
            fontSize: 'clamp(40px, 5vw, 56px)',
            fontWeight: '300',
            color: '#0a0a0a',
            marginBottom: '80px',
            letterSpacing: '-0.03em',
            maxWidth: '800px'
          }}>
            {t('features.subtitle')}
          </h2>

          <div className="responsive-grid-2" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '64px 48px'
          }}>
            {[
              {
                icon: <Database style={{ width: '32px', height: '32px', color: '#0a0a0a' }} />,
                title: t('features.centralized.title'),
                description: t('features.centralized.description')
              },
              {
                icon: <Zap style={{ width: '32px', height: '32px', color: '#0a0a0a' }} />,
                title: t('features.optimization.title'),
                description: t('features.optimization.description')
              },
              {
                icon: <Globe style={{ width: '32px', height: '32px', color: '#0a0a0a' }} />,
                title: t('features.distribution.title'),
                description: t('features.distribution.description')
              },
              {
                icon: <BarChart3 style={{ width: '32px', height: '32px', color: '#0a0a0a' }} />,
                title: t('features.insights.title'),
                description: t('features.insights.description')
              }
            ].map((feature, index) => {
              const delayClass = index === 0 ? '' : index === 1 ? 'delay-100' : index === 2 ? 'delay-200' : index === 3 ? 'delay-300' : 'delay-400';
              return (
                <div key={index} className={`feature-card fade-in-element ${delayClass}`}>
                  <div className="icon-hover" style={{ marginBottom: '24px', display: 'inline-block' }}>
                    {feature.icon}
                  </div>
                  <h3 style={{
                    fontSize: '24px',
                    fontWeight: '400',
                    color: '#0a0a0a',
                    marginBottom: '16px',
                    letterSpacing: '-0.01em'
                  }}>
                    {feature.title}
                  </h3>
                  <p style={{
                    fontSize: '16px',
                    color: '#6b7280',
                    lineHeight: '1.7',
                    margin: 0,
                    fontWeight: '300'
                  }}>
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="responsive-padding" style={{
        padding: '120px 48px',
        backgroundColor: '#fafafa',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h2 className="fade-in-element responsive-text" style={{
            fontSize: 'clamp(36px, 5vw, 48px)',
            fontWeight: '400',
            color: '#0a0a0a',
            marginBottom: '32px',
            letterSpacing: '-0.02em'
          }}>
            {t('value.title')}
          </h2>
          
          <p className="fade-in-element delay-100 responsive-text-small" style={{
            fontSize: '20px',
            lineHeight: '1.7',
            color: '#4a4a4a',
            fontWeight: '300',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            {t('value.description')}
          </p>
        </div>
      </section>

      {/* Pourquoi FeedPlug — différenciation simplicité + data (SEO sémantique) */}
      <section className="responsive-padding" style={{
        padding: '120px 48px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 className="fade-in-element responsive-text" style={{
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: '400',
            color: '#0a0a0a',
            marginBottom: '32px',
            letterSpacing: '-0.02em'
          }}>
            {t('whyFeedplug.title')}
          </h2>
          <p className="fade-in-element delay-100 responsive-text-small" style={{
            fontSize: '17px',
            color: '#4a4a4a',
            marginBottom: '24px',
            fontWeight: '300',
            lineHeight: '1.7'
          }}>
            {t('whyFeedplug.paragraph1')}
          </p>
          <p className="fade-in-element delay-200 responsive-text-small" style={{
            fontSize: '17px',
            color: '#4a4a4a',
            margin: 0,
            fontWeight: '300',
            lineHeight: '1.7'
          }}>
            {t('whyFeedplug.paragraph2')}
          </p>
          <p className="fade-in-element delay-300" style={{
            marginTop: '24px',
            padding: '16px 20px',
            backgroundColor: '#fafafa',
            borderLeft: '3px solid #0a0a0a',
            fontSize: '15px',
            color: '#0a0a0a',
            fontWeight: '500',
            lineHeight: 1.5
          }}>
            {t('whyFeedplug.stat')}
          </p>
        </div>
      </section>

      {/* Section Optimisation titres et descriptions par IA */}
      <section id="enrichissement-ia" className="responsive-padding" style={{
        padding: '120px 48px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div className="fade-in-element" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <Sparkles style={{ width: '20px', height: '20px', color: '#0a0a0a' }} />
            <span style={{
              fontSize: '12px',
              fontWeight: '500',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#6b7280'
            }}>
              {t('features.optimization.title')}
            </span>
          </div>
          
          <h2 className="fade-in-element delay-100 responsive-text" style={{
            fontSize: 'clamp(36px, 5vw, 48px)',
            fontWeight: '300',
            color: '#0a0a0a',
            marginBottom: '24px',
            letterSpacing: '-0.03em',
            maxWidth: '800px'
          }}>
            {t('aiOptimization.subtitle')}
          </h2>
          
          <p className="fade-in-element delay-200 responsive-text-small" style={{
            fontSize: '18px',
            color: '#4a4a4a',
            marginBottom: '64px',
            fontWeight: '300',
            maxWidth: '720px',
            lineHeight: '1.6'
          }}>
            {t('aiOptimization.description')}
          </p>

          <div className="responsive-grid-2" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '32px 48px'
          }}>
            {[
              {
                icon: <FileText style={{ width: '24px', height: '24px', color: '#0a0a0a', flexShrink: 0 }} />,
                titleKey: 'duplicateContent',
                delay: 'delay-200'
              },
              {
                icon: <Target style={{ width: '24px', height: '24px', color: '#0a0a0a', flexShrink: 0 }} />,
                titleKey: 'brandVoice',
                delay: 'delay-300'
              },
              {
                icon: <CheckCircle style={{ width: '24px', height: '24px', color: '#0a0a0a', flexShrink: 0 }} />,
                titleKey: 'compliance',
                delay: 'delay-300'
              },
              {
                icon: <TrendingUp style={{ width: '24px', height: '24px', color: '#0a0a0a', flexShrink: 0 }} />,
                titleKey: 'scale',
                delay: 'delay-400'
              }
            ].map((item) => (
              <div
                key={item.titleKey}
                className={`fade-in-element ${item.delay}`}
                style={{
                  display: 'flex',
                  gap: '20px',
                  padding: '32px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '2px',
                  backgroundColor: '#fafafa',
                  transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ marginTop: '2px' }}>{item.icon}</div>
                <div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '400',
                    color: '#0a0a0a',
                    marginBottom: '8px',
                    letterSpacing: '-0.01em'
                  }}>
                    {t(`aiOptimization.benefits.${item.titleKey}.title`)}
                  </h3>
                  <p style={{
                    fontSize: '15px',
                    color: '#6b7280',
                    lineHeight: '1.6',
                    margin: 0,
                    fontWeight: '300'
                  }}>
                    {t(`aiOptimization.benefits.${item.titleKey}.description`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section Expansion - Nouveaux canaux et marchés */}
      <section className="responsive-padding" style={{
        padding: '120px 48px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div className="responsive-grid-2" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '48px',
            marginBottom: '80px'
          }}>
            {/* Nouveaux canaux */}
            <div id="diffusion-canaux" className="fade-in-element delay-300" style={{
              padding: '48px',
              border: '1px solid #e5e7eb',
              borderRadius: '2px',
              backgroundColor: '#fafafa',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}>
              <div style={{ marginBottom: '24px' }}>
                <Rocket style={{ width: '32px', height: '32px', color: '#0a0a0a' }} />
              </div>
              <h3 style={{
                fontSize: '24px',
                fontWeight: '400',
                color: '#0a0a0a',
                marginBottom: '16px',
                letterSpacing: '-0.01em'
              }}>
                {t('expansion.newChannels.title')}
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#6b7280',
                lineHeight: '1.6',
                marginBottom: '32px',
                fontWeight: '300'
              }}>
                {t('expansion.newChannels.description')}
              </p>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {[
                  { icon: <Clock style={{ width: '16px', height: '16px', color: '#6b7280' }} />, text: t('expansion.newChannels.features.config') },
                  { icon: <Zap style={{ width: '16px', height: '16px', color: '#6b7280' }} />, text: t('expansion.newChannels.features.auto') },
                  { icon: <Target style={{ width: '16px', height: '16px', color: '#6b7280' }} />, text: t('expansion.newChannels.features.adaptation') }
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {item.icon}
                    <span style={{ fontSize: '15px', color: '#4a4a4a', fontWeight: '300' }}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Nouveaux marchés */}
            <div id="traduction-flux" className="fade-in-element delay-400" style={{
              padding: '48px',
              border: '1px solid #e5e7eb',
              borderRadius: '2px',
              backgroundColor: '#fafafa',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}>
              <div style={{ marginBottom: '24px' }}>
                <MapPin style={{ width: '32px', height: '32px', color: '#0a0a0a' }} />
              </div>
              <h3 style={{
                fontSize: '24px',
                fontWeight: '400',
                color: '#0a0a0a',
                marginBottom: '16px',
                letterSpacing: '-0.01em'
              }}>
                {t('expansion.newMarkets.title')}
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#6b7280',
                lineHeight: '1.6',
                marginBottom: '32px',
                fontWeight: '300'
              }}>
                {t('expansion.newMarkets.description')}
              </p>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {[
                  { icon: <Globe style={{ width: '16px', height: '16px', color: '#6b7280' }} />, text: t('expansion.newMarkets.features.multi') },
                  { icon: <Zap style={{ width: '16px', height: '16px', color: '#6b7280' }} />, text: t('expansion.newMarkets.features.instant') },
                  { icon: <CheckCircle style={{ width: '16px', height: '16px', color: '#6b7280' }} />, text: t('expansion.newMarkets.features.compliance') }
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {item.icon}
                    <span style={{ fontSize: '15px', color: '#4a4a4a', fontWeight: '300' }}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cas d'usage */}
          <div className="fade-in-element delay-300 responsive-grid-3" style={{
            backgroundColor: '#fafafa',
            border: '1px solid #e5e7eb',
            borderRadius: '2px',
            padding: '48px',
            marginTop: '48px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '48px'
          }}>
              {[
                {
                  title: t('expansion.useCases.channels.title'),
                  description: t('expansion.useCases.channels.description'),
                  metric: '5x'
                },
                {
                  title: t('expansion.useCases.geographic.title'),
                  description: t('expansion.useCases.geographic.description'),
                  metric: '48h'
                },
                {
                  title: t('expansion.useCases.costs.title'),
                  description: t('expansion.useCases.costs.description'),
                  metric: '-70%'
                }
              ].map((caseStudy, idx) => (
                <div key={idx}>
                  <div style={{
                    fontSize: '36px',
                    fontWeight: '300',
                    color: '#0a0a0a',
                    marginBottom: '12px',
                    letterSpacing: '-0.02em'
                  }}>
                    {caseStudy.metric}
                  </div>
                  <h4 style={{
                    fontSize: '18px',
                    fontWeight: '400',
                    color: '#0a0a0a',
                    marginBottom: '8px',
                    letterSpacing: '-0.01em'
                  }}>
                    {caseStudy.title}
                  </h4>
                  <p style={{
                    fontSize: '15px',
                    color: '#6b7280',
                    lineHeight: '1.6',
                    margin: 0,
                    fontWeight: '300'
                  }}>
                    {caseStudy.description}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* Section Fonctionnalités Avancées - Différenciantes */}
      <section className="responsive-padding" style={{
        padding: '120px 48px',
        backgroundColor: '#fafafa',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div className="fade-in-element" style={{
            fontSize: '12px',
            fontWeight: '500',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#6b7280',
            marginBottom: '16px'
          }}>
            {t('advanced.title')}
          </div>
          
          <h2 className="fade-in-element delay-100 responsive-text" style={{
            fontSize: 'clamp(40px, 5vw, 56px)',
            fontWeight: '300',
            color: '#0a0a0a',
            marginBottom: '24px',
            letterSpacing: '-0.03em',
            maxWidth: '800px'
          }}>
            {t('advanced.subtitle')}
          </h2>
          
          <p className="fade-in-element delay-200 responsive-text-small" style={{
            fontSize: '18px',
            color: '#4a4a4a',
            marginBottom: '64px',
            fontWeight: '300',
            maxWidth: '720px',
            lineHeight: '1.6'
          }}>
            {t('advanced.description')}
          </p>

          <div className="responsive-grid-3" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '48px',
            marginBottom: '80px'
          }}>
            {/* Analytics & Performance */}
            <div id="analytics" className="feature-card fade-in-element delay-200" style={{
              padding: '40px',
              border: '1px solid #e5e7eb',
              borderRadius: '2px',
              backgroundColor: '#ffffff',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <div className="icon-hover" style={{ marginBottom: '24px', display: 'inline-block' }}>
                <BarChart3 style={{ width: '32px', height: '32px', color: '#0a0a0a' }} />
              </div>
              <h3 style={{
                fontSize: '22px',
                fontWeight: '400',
                color: '#0a0a0a',
                marginBottom: '16px',
                letterSpacing: '-0.01em'
              }}>
                {t('advanced.analytics.title')}
              </h3>
              <p style={{
                fontSize: '15px',
                color: '#6b7280',
                lineHeight: '1.6',
                marginBottom: '24px',
                fontWeight: '300'
              }}>
                {t('advanced.analytics.description')}
              </p>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {[
                  t('advanced.analytics.features.dashboards'),
                  t('advanced.analytics.features.roi'),
                  t('advanced.analytics.features.reports'),
                  t('advanced.analytics.features.alerts')
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle style={{ width: '16px', height: '16px', color: '#16a34a', flexShrink: 0 }} />
                    <span style={{ fontSize: '14px', color: '#4a4a4a', fontWeight: '300' }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* A/B Testing */}
            <div id="ab-testing" className="feature-card fade-in-element delay-300" style={{
              padding: '40px',
              border: '1px solid #e5e7eb',
              borderRadius: '2px',
              backgroundColor: '#ffffff',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <div className="icon-hover" style={{ marginBottom: '24px', display: 'inline-block' }}>
                <TestTube style={{ width: '32px', height: '32px', color: '#0a0a0a' }} />
              </div>
              <h3 style={{
                fontSize: '22px',
                fontWeight: '400',
                color: '#0a0a0a',
                marginBottom: '16px',
                letterSpacing: '-0.01em'
              }}>
                {t('advanced.abTesting.title')}
              </h3>
              <p style={{
                fontSize: '15px',
                color: '#6b7280',
                lineHeight: '1.6',
                marginBottom: '24px',
                fontWeight: '300'
              }}>
                {t('advanced.abTesting.description')}
              </p>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {[
                  t('advanced.abTesting.features.traffic'),
                  t('advanced.abTesting.features.results'),
                  t('advanced.abTesting.features.statistics'),
                  t('advanced.abTesting.features.recommendations')
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle style={{ width: '16px', height: '16px', color: '#16a34a', flexShrink: 0 }} />
                    <span style={{ fontSize: '14px', color: '#4a4a4a', fontWeight: '300' }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scoring & IA */}
            <div id="enrichissement-ia" className="feature-card fade-in-element delay-400" style={{
              padding: '40px',
              border: '1px solid #e5e7eb',
              borderRadius: '2px',
              backgroundColor: '#ffffff',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <div className="icon-hover" style={{ marginBottom: '24px', display: 'inline-block' }}>
                <Sparkles style={{ width: '32px', height: '32px', color: '#0a0a0a' }} />
              </div>
              <h3 style={{
                fontSize: '22px',
                fontWeight: '400',
                color: '#0a0a0a',
                marginBottom: '16px',
                letterSpacing: '-0.01em'
              }}>
                {t('advanced.aiScoring.title')}
              </h3>
              <p style={{
                fontSize: '15px',
                color: '#6b7280',
                lineHeight: '1.6',
                marginBottom: '24px',
                fontWeight: '300'
              }}>
                {t('advanced.aiScoring.description')}
              </p>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {[
                  t('advanced.aiScoring.features.scoring'),
                  t('advanced.aiScoring.features.generation'),
                  t('advanced.aiScoring.features.anomalies')
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle style={{ width: '16px', height: '16px', color: '#16a34a', flexShrink: 0 }} />
                    <span style={{ fontSize: '14px', color: '#4a4a4a', fontWeight: '300' }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bénéfices concrets */}
          <div className="fade-in-element delay-300 responsive-grid-3" style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '2px',
            padding: '48px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '48px'
          }}>
            {[
              {
                icon: <Eye style={{ width: '24px', height: '24px', color: '#0a0a0a' }} />,
                title: t('advanced.benefits.visibility.title'),
                description: t('advanced.benefits.visibility.description')
              },
              {
                icon: <Target style={{ width: '24px', height: '24px', color: '#0a0a0a' }} />,
                title: t('advanced.benefits.optimization.title'),
                description: t('advanced.benefits.optimization.description')
              },
              {
                icon: <TrendingUp style={{ width: '24px', height: '24px', color: '#0a0a0a' }} />,
                title: t('advanced.benefits.decisions.title'),
                description: t('advanced.benefits.decisions.description')
              }
            ].map((benefit, idx) => (
              <div key={idx}>
                <div style={{ marginBottom: '16px' }}>
                  {benefit.icon}
                </div>
                <h4 style={{
                  fontSize: '18px',
                  fontWeight: '400',
                  color: '#0a0a0a',
                  marginBottom: '8px',
                  letterSpacing: '-0.01em'
                }}>
                  {benefit.title}
                </h4>
                <p style={{
                  fontSize: '15px',
                  color: '#6b7280',
                  lineHeight: '1.6',
                  margin: 0,
                  fontWeight: '300'
                }}>
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — SEO + rich results */}
      <section className="responsive-padding" style={{
        padding: '120px 48px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 className="fade-in-element" style={{
            fontSize: 'clamp(28px, 4vw, 36px)',
            fontWeight: '400',
            color: '#0a0a0a',
            marginBottom: '48px',
            letterSpacing: '-0.02em'
          }}>
            {t('faq.title')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="fade-in-element">
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '500',
                  color: '#0a0a0a',
                  marginBottom: '12px',
                  letterSpacing: '-0.01em'
                }}>
                  {t(`faq.items.${i}.q`)}
                </h3>
                <p style={{
                  fontSize: '16px',
                  color: '#4a4a4a',
                  lineHeight: '1.6',
                  margin: 0,
                  fontWeight: '300'
                }}>
                  {t(`faq.items.${i}.a`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="responsive-padding" style={{
        padding: '120px 48px',
        backgroundColor: '#0a0a0a',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h2 className="fade-in-element responsive-text" style={{
            fontSize: 'clamp(36px, 5vw, 48px)',
            fontWeight: '400',
            color: '#ffffff',
            marginBottom: '24px',
            letterSpacing: '-0.02em'
          }}>
            {t('cta.title')}
          </h2>
          
          <p className="fade-in-element delay-100 responsive-text-small" style={{
            fontSize: '18px',
            color: '#d1d5db',
            marginBottom: '48px',
            fontWeight: '300',
            maxWidth: '700px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: '1.7'
          }}>
            {t('cta.subtitle')}
          </p>

          <a href="#hero" className="button-hover fade-in-element delay-200" style={{
            padding: '16px 40px',
            backgroundColor: '#ffffff',
            color: '#0a0a0a',
            border: 'none',
            fontSize: '16px',
            fontWeight: '400',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            letterSpacing: '0.02em',
            fontFamily: 'inherit',
            borderRadius: '2px',
            textDecoration: 'none',
            transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
          }}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
          }}
          >
            {t('cta.button')}
            <ArrowRight className="arrow-icon" style={{ width: '18px', height: '18px', transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
          </a>
        </div>
      </section>

      {/* Footer Corporate */}
      <footer className="responsive-padding" style={{
        backgroundColor: '#fafafa',
        borderTop: '1px solid #e5e7eb',
        padding: '64px 48px',
        marginTop: '120px'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '48px',
            flexWrap: 'wrap',
            gap: '48px'
          }}>
            <div>
              <div style={{
                fontSize: '16px',
                fontWeight: '500',
                color: '#0a0a0a',
                marginBottom: '24px',
                letterSpacing: '-0.01em'
              }}>
                FeedPlug
              </div>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: 0,
                lineHeight: '1.6',
                maxWidth: '280px',
                fontWeight: '300'
              }}>
                {t('footer.description')}
              </p>
            </div>
            
            <div>
              <div style={{
                fontSize: '12px',
                fontWeight: '500',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#6b7280',
                marginBottom: '16px'
              }}>
                {t('nav.documentation')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a href="/docs" style={{ color: '#4a4a4a', fontSize: '14px', textDecoration: 'none', fontWeight: '300' }}>
                  {t('nav.documentation')}
                </a>
                <a href={locale === 'fr' ? '/integrations' : `/${locale}/integrations`} style={{ color: '#4a4a4a', fontSize: '14px', textDecoration: 'none', fontWeight: '300' }}>
                  {t('footer.integrations')}
                </a>
              </div>
            </div>
            <div>
              <div style={{
                fontSize: '12px',
                fontWeight: '500',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#6b7280',
                marginBottom: '16px'
              }}>
                {t('footer.legal')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Link href="/legal/privacy" style={{ color: '#4a4a4a', fontSize: '14px', textDecoration: 'none', fontWeight: '300' }}>
                  {t('footer.privacy')}
                </Link>
                <Link href="/legal/terms" style={{ color: '#4a4a4a', fontSize: '14px', textDecoration: 'none', fontWeight: '300' }}>
                  {t('footer.terms')}
                </Link>
              </div>
            </div>
          </div>
          
          <div style={{
            paddingTop: '32px',
            borderTop: '1px solid #e5e7eb',
            fontSize: '13px',
            color: '#6b7280',
            fontWeight: '300'
          }}>
            {t('footer.copyright')}
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}





