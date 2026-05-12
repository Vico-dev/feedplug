"use client";

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { 
  CheckCircle,
  ArrowRight,
  Database,
  Zap,
  Globe,
  BarChart3,
  Sparkles,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import { trackEvent } from '@/components/analytics/GoogleAnalytics';

export default function MarketingLandingPage() {
  const t = useTranslations();
  const locale = useLocale();
  const localePrefix = locale === "fr" ? "" : `/${locale}`;
  const appUrl =
    (
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'https://app.feedplug.com')
    ).replace(/\/$/, '');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [formStartedAt] = useState(() => Date.now());

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('animate-in');
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    const elements = document.querySelectorAll('.fade-in');
    elements.forEach(el => observer.observe(el));
    return () => {
      elements.forEach(el => observer.unobserve(el));
    };
  }, []);

  const handleEarlyAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.post('/marketing/early-access', {
        email: trimmedEmail,
        locale,
        companyWebsite,
        formStartedAt,
      });
      trackEvent('generate_lead', { currency: 'EUR', value: 0, source: 'landing_page' });
    } catch (err: unknown) {
      console.error('Lead capture failed on marketing homepage:', err);
    }

    if (typeof window !== 'undefined') {
      const registerUrl = `${appUrl}/register?email=${encodeURIComponent(trimmedEmail)}&source=landing_page`;
      window.location.assign(registerUrl);
      return;
    }

    setError(t('error.generic'));
    setIsSubmitting(false);
  };

  const channels = ['Google Shopping', 'Amazon', 'Meta Ads', 'Cdiscount', 'Rakuten', 'Fnac', 'Mirakl', 'ChatGPT'];
  const heroAlternativeActions =
    locale === "es"
      ? {
          demo: "Prefieres una demo guiada?",
          audit: "O solicitar una auditoria gratuita",
        }
      : locale === "en"
        ? {
            demo: "Prefer a guided demo?",
            audit: "Or request a free audit",
          }
        : {
            demo: "Vous préférez une démo guidée ?",
            audit: "Ou demander un audit gratuit",
          };
  const footerResourcesLabel =
    locale === "es" ? "Paginas utiles" : locale === "en" ? "Useful pages" : "Pages utiles";
  const footerResources = [
    { href: "/docs", label: locale === "es" ? "Documentacion" : locale === "en" ? "Documentation" : "Documentation" },
    { href: `${localePrefix}/integrations`, label: locale === "es" ? "Integraciones" : locale === "en" ? "Integrations" : "Intégrations" },
    {
      href: `${localePrefix}/optimiser-flux-google-shopping-shopify`,
      label: locale === "es" ? "Shopify a Google Shopping" : locale === "en" ? "Shopify to Google Shopping" : "Shopify vers Google Shopping",
    },
    {
      href: `${localePrefix}/corriger-erreurs-google-merchant-center`,
      label: locale === "es" ? "Errores Merchant Center" : locale === "en" ? "Merchant Center errors" : "Erreurs Merchant Center",
    },
    {
      href: `${localePrefix}/feed-produit-amazon-shopify`,
      label: locale === "es" ? "Feed Amazon Shopify" : locale === "en" ? "Amazon Shopify feed" : "Feed Amazon Shopify",
    },
    {
      href: `${localePrefix}/feed-produit-chatgpt`,
      label: locale === "es" ? "Feed ChatGPT" : locale === "en" ? "ChatGPT feed" : "Feed ChatGPT",
    },
    { href: `${localePrefix}/tarifs`, label: locale === "es" ? "Precios" : locale === "en" ? "Pricing" : "Tarifs" },
  ];
  const heroContext = locale === "es"
    ? {
        label: "Empieza por un caso concreto",
        links: [
          { href: `${localePrefix}/optimiser-flux-google-shopping-shopify`, text: "Shopify a Google Shopping" },
          { href: `${localePrefix}/corriger-erreurs-google-merchant-center`, text: "Corregir errores Merchant Center" },
        ],
      }
    : locale === "en"
      ? {
          label: "Start with a concrete use case",
          links: [
            { href: `${localePrefix}/optimiser-flux-google-shopping-shopify`, text: "Shopify to Google Shopping" },
            { href: `${localePrefix}/corriger-erreurs-google-merchant-center`, text: "Fix Merchant Center errors" },
          ],
        }
      : {
          label: "Commencez par un cas concret",
          links: [
            { href: `${localePrefix}/optimiser-flux-google-shopping-shopify`, text: "Shopify vers Google Shopping" },
            { href: `${localePrefix}/corriger-erreurs-google-merchant-center`, text: "Corriger erreurs Merchant Center" },
          ],
        };
  const metrics = [
    { value: '-80%', label: t('socialProof.metrics.0.label'), context: t('socialProof.metrics.0.context') },
    { value: '15 min', label: t('socialProof.metrics.1.label'), context: t('socialProof.metrics.1.context') },
    { value: '5x', label: t('socialProof.metrics.2.label'), context: t('socialProof.metrics.2.context') },
    { value: '-70%', label: t('socialProof.metrics.3.label'), context: t('socialProof.metrics.3.context') },
  ];
  const auditSection = locale === 'es'
    ? {
        eyebrow: 'Nueva adquisicion',
        title: 'Auditoria de feed de producto: conecta tu CMS o Merchant Center y recibe un score sobre 100.',
        description: 'Analizamos calidad de datos, readiness para canales y los principales bloqueos. El prospecto ve de inmediato lo que pierde y lo que se puede recuperar con FeedPlug.',
        bullets: [
          'Score global sobre 100 con detalle de cobertura, calidad producto y readiness canal.',
          'Top 5 de problemas prioritarios para activar mas productos rapidamente.',
          'Estimacion del potencial recuperable si se corrigen los campos criticos.',
        ],
        ctaPrimary: 'Solicitar una auditoria',
        ctaSecondary: 'Ver integraciones',
        scoreLabel: 'Ejemplo de score',
        potentialLabel: 'Potencial identificable',
        issuesLabel: 'Problemas detectados',
      }
    : locale === 'en'
      ? {
          eyebrow: 'New acquisition angle',
          title: 'Product feed audit: connect your CMS or Merchant Center and get a score out of 100.',
          description: 'We analyze data quality, channel readiness and the main blockers. Prospects immediately see what they are losing and what FeedPlug can recover.',
          bullets: [
            'Global score out of 100 with data coverage, product quality and channel readiness.',
            'Top 5 priority issues to unlock more products quickly.',
            'Estimated recoverable upside if critical fields are fixed.',
          ],
          ctaPrimary: 'Request an audit',
          ctaSecondary: 'See integrations',
          scoreLabel: 'Example score',
          potentialLabel: 'Recoverable upside',
          issuesLabel: 'Issues detected',
        }
      : {
          eyebrow: 'Nouvelle acquisition',
          title: 'Audit de flux produit : connectez votre CMS ou Merchant Center et obtenez un score sur 100.',
          description: 'On analyse la qualite de donnees, la readiness canal et les blocages majeurs. Le prospect voit tout de suite ce qu il perd aujourd hui et ce que FeedPlug peut recuperer.',
          bullets: [
            'Score global sur 100 avec detail couverture, qualite produit et readiness canal.',
            'Top 5 des problemes prioritaires pour activer plus de produits rapidement.',
            'Estimation du potentiel recuperable si les champs critiques sont corriges.',
          ],
          ctaPrimary: 'Demander un audit',
          ctaSecondary: 'Voir les integrations',
          scoreLabel: 'Exemple de score',
          potentialLabel: 'Potentiel recuperable',
          issuesLabel: 'Problemes detectes',
        };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { opacity: 0; }
        .fade-in.animate-in { animation: fadeUp 0.6s ease-out forwards; }
        .d1 { animation-delay: 0.05s; }
        .d2 { animation-delay: 0.1s; }
        .d3 { animation-delay: 0.15s; }
        .d4 { animation-delay: 0.2s; }

        .hero-h { animation: fadeUp 0.7s ease-out forwards; }
        .hero-p { animation: fadeUp 0.7s ease-out 0.15s forwards; opacity: 0; }
        .hero-f { animation: fadeUp 0.7s ease-out 0.3s forwards; opacity: 0; }
        .hero-c { animation: fadeUp 0.7s ease-out 0.45s forwards; opacity: 0; }

        .cta-btn {
          background: #111827;
          color: #fff;
          border: none;
          transition: background 0.2s ease, transform 0.15s ease;
        }
        .cta-btn:hover { background: #1f2937; transform: translateY(-1px); }
        .cta-btn:active { transform: translateY(0); }

        .card-hover {
          transition: box-shadow 0.25s ease, transform 0.2s ease;
          border: 1px solid #e5e7eb;
        }
        .card-hover:hover {
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
          transform: translateY(-3px);
        }

        .faq-answer { max-height: 0; overflow: hidden; transition: max-height 0.35s ease; }
        .faq-answer.open { max-height: 300px; }
        .faq-chevron { transition: transform 0.25s ease; }
        .faq-chevron.open { transform: rotate(180deg); }

        .input-field {
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .input-field:focus {
          border-color: #111827;
          box-shadow: 0 0 0 3px rgba(17,24,39,0.06);
        }

        @media (max-width: 768px) {
          .rg2 { grid-template-columns: 1fr !important; }
          .rg3 { grid-template-columns: 1fr !important; }
          .rg4 { grid-template-columns: 1fr 1fr !important; }
          .rpad { padding: 60px 24px !important; }
          .rh { padding: 100px 24px 72px !important; }
          .rtxt { font-size: clamp(32px, 8vw, 56px) !important; }
          .rtxt2 { font-size: clamp(26px, 6vw, 40px) !important; }
          .rform { flex-direction: column !important; }
          .channels-row { gap: 16px !important; }
        }
        @media (max-width: 480px) {
          .rh { padding: 80px 20px 56px !important; }
          .rpad { padding: 48px 20px !important; }
          .rg4 { grid-template-columns: 1fr !important; }
        }
      `}} />

      <MarketingHeader />

      <section
        id="hero"
        className="rh"
        style={{
          padding: '132px 48px 84px',
          background:
            'linear-gradient(180deg, #f7f8f5 0%, #f8fafc 38%, #ffffff 100%)',
          borderBottom: '1px solid #eceff3',
        }}
      >
        <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
          <div
            className="rg2"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.05fr) minmax(360px, 0.95fr)',
              gap: '44px',
              alignItems: 'start',
            }}
          >
            <div>
              <div
                className="hero-h"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '999px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  fontSize: '12px',
                  fontWeight: '600',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#6b7280',
                  marginBottom: '24px',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '999px',
                    backgroundColor: '#111827',
                    display: 'inline-block',
                  }}
                />
                {t('hero.eyebrow')}
              </div>

              <h1
                className="hero-h rtxt"
                style={{
                  fontSize: 'clamp(42px, 5vw, 68px)',
                  fontWeight: '550',
                  letterSpacing: '-0.045em',
                  lineHeight: '1.02',
                  color: '#111827',
                  marginBottom: '22px',
                  maxWidth: '720px',
                }}
              >
                {t('hero.title')}{' '}
                <span style={{ color: '#111827' }}>{t('hero.titleHighlight')}</span>{' '}
                <span style={{ color: '#6b7280', fontWeight: '420' }}>{t('hero.titleEnd')}</span>
              </h1>

              <p
                className="hero-p"
                style={{
                  fontSize: '18px',
                  lineHeight: '1.7',
                  color: '#4b5563',
                  fontWeight: '400',
                  marginBottom: '30px',
                  maxWidth: '640px',
                }}
              >
                {t('hero.description')}
              </p>

              <form onSubmit={handleEarlyAccess} className="hero-f" style={{ maxWidth: '560px' }}>
                <input
                  type="text"
                  name="website"
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '-10000px',
                    top: 'auto',
                    width: '1px',
                    height: '1px',
                    opacity: 0,
                    pointerEvents: 'none',
                  }}
                />
                <div
                  className="rform"
                  style={{
                    display: 'flex',
                    gap: '10px',
                    marginBottom: '12px',
                    padding: '8px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    boxShadow: '0 14px 44px rgba(15, 23, 42, 0.05)',
                  }}
                >
                  <input
                    id="homepage-hero-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t('form.email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input-field"
                    style={{
                      flex: 1,
                      padding: '14px 16px',
                      border: 'none',
                      fontSize: '15px',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      color: '#111827',
                      fontFamily: 'inherit',
                      borderRadius: '10px',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="cta-btn"
                    style={{
                      padding: '14px 18px',
                      fontSize: '15px',
                      fontWeight: '600',
                      borderRadius: '10px',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      opacity: isSubmitting ? 0.6 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isSubmitting ? t('form.redirecting') : (
                      <>
                        {t('hero.ctaButton')}
                        <ArrowRight style={{ width: '15px', height: '15px' }} />
                      </>
                    )}
                  </button>
                </div>
                {error && (
                  <div style={{ color: '#dc2626', fontSize: '14px', marginBottom: '8px' }}>
                    {error}
                  </div>
                )}
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{t('hero.ctaSub')}</p>
                <p style={{ fontSize: '13px', color: '#9ca3af', margin: '6px 0 0' }}>{t('form.redirectHint')}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '10px' }}>
                  <Link href={`${localePrefix}/demo?source=landing_page`} style={{ fontSize: '13px', fontWeight: '600', color: '#111827', textDecoration: 'none' }}>
                    {heroAlternativeActions.demo}
                  </Link>
                  <Link href={`${localePrefix}/audit-flux?source=landing_page`} style={{ fontSize: '13px', fontWeight: '600', color: '#0f766e', textDecoration: 'none' }}>
                    {heroAlternativeActions.audit}
                  </Link>
                </div>
              </form>

              <div
                className="hero-c"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '12px',
                  marginTop: '28px',
                  maxWidth: '680px',
                }}
              >
                {metrics.slice(0, 3).map((metric) => (
                  <div
                    key={metric.label}
                    style={{
                      padding: '18px 18px 16px',
                      borderRadius: '16px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '28px',
                        fontWeight: '650',
                        letterSpacing: '-0.04em',
                        color: '#111827',
                        marginBottom: '6px',
                      }}
                    >
                      {metric.value}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                      {metric.label}
                    </div>
                    <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#6b7280' }}>{metric.context}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-c">
              <div
                style={{
                  borderRadius: '24px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 24px 64px rgba(15, 23, 42, 0.08)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '18px 22px',
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: '#fafaf9',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontWeight: '700',
                        color: '#9ca3af',
                        marginBottom: '4px',
                      }}
                    >
                      FeedPlug
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                      Poste de pilotage flux produit
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '999px',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}
                  >
                    Multi-canal
                  </div>
                </div>

                <div style={{ padding: '22px' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: '12px',
                      marginBottom: '16px',
                    }}
                  >
                    {[
                      { label: 'Catalogue', value: '1 source active', tone: '#111827', bg: '#f8fafc' },
                      { label: 'Optimisation', value: 'IA prête', tone: '#d97706', bg: '#fffbeb' },
                      { label: 'Diffusion', value: '8 canaux', tone: '#059669', bg: '#ecfdf5' },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          padding: '14px',
                          borderRadius: '14px',
                          backgroundColor: item.bg,
                          border: '1px solid #eef2f7',
                        }}
                      >
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>{item.label}</div>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: item.tone }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      border: '1px solid #eef2f7',
                      borderRadius: '18px',
                      overflow: 'hidden',
                      marginBottom: '16px',
                    }}
                  >
                    {[
                      {
                        title: '1. Importer le catalogue',
                        text: 'Connectez Shopify ou un CSV. FeedPlug structure le flux dès l’entrée.',
                        badge: 'Source',
                      },
                      {
                        title: '2. Corriger ce qui bloque',
                        text: 'Le score met en avant les produits incomplets, non conformes ou sous-optimisés.',
                        badge: 'Qualité',
                      },
                      {
                        title: '3. Diffuser sans friction',
                        text: 'Publiez vers Google Shopping, Amazon, marketplaces et assistants IA.',
                        badge: 'Distribution',
                      },
                    ].map((step, index) => (
                      <div
                        key={step.title}
                        style={{
                          padding: '16px 18px',
                          borderBottom: index < 2 ? '1px solid #eef2f7' : 'none',
                          backgroundColor: index === 1 ? '#fafaf9' : '#ffffff',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '16px',
                            alignItems: 'center',
                            marginBottom: '6px',
                          }}
                        >
                          <div style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}>{step.title}</div>
                          <div
                            style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              color: '#6b7280',
                            }}
                          >
                            {step.badge}
                          </div>
                        </div>
                        <div style={{ fontSize: '14px', lineHeight: '1.65', color: '#6b7280' }}>{step.text}</div>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    {channels.map((channel) => (
                      <span
                        key={channel}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '999px',
                          backgroundColor: '#fafaf9',
                          border: '1px solid #e5e7eb',
                          fontSize: '12px',
                          fontWeight: '500',
                          color: '#4b5563',
                        }}
                      >
                        {channel}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  marginTop: '16px',
                }}
              >
                {heroContext.links.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      textDecoration: 'none',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      color: '#111827',
                      fontSize: '14px',
                      fontWeight: '500',
                    }}
                  >
                    {item.text}
                    <ArrowRight style={{ width: '14px', height: '14px' }} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rpad" style={{ padding: '72px 48px', background: 'linear-gradient(180deg, #fffef8 0%, #ffffff 100%)', borderBottom: '1px solid #eceff3' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="rg2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'stretch' }}>
            <div className="fade-in" style={{ padding: '32px', backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid #eceff3', boxShadow: '0 24px 48px rgba(15,23,42,0.05)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a16207', marginBottom: '14px' }}>
                {auditSection.eyebrow}
              </div>
              <h2 className="rtxt2" style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 540, letterSpacing: '-0.03em', color: '#111827', margin: '0 0 14px' }}>
                {auditSection.title}
              </h2>
              <p style={{ fontSize: '16px', lineHeight: '1.75', color: '#6b7280', margin: '0 0 22px', maxWidth: '720px' }}>
                {auditSection.description}
              </p>
              <div style={{ display: 'grid', gap: '14px', marginBottom: '24px' }}>
                {auditSection.bullets.map((bullet) => (
                  <div key={bullet} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <CheckCircle style={{ width: '18px', height: '18px', color: '#a16207', flexShrink: 0, marginTop: '3px' }} />
                    <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.7', color: '#374151' }}>{bullet}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <Link
                  href={`${localePrefix}/audit-flux`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '14px 18px',
                    borderRadius: '14px',
                    textDecoration: 'none',
                    backgroundColor: '#111827',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  {auditSection.ctaPrimary}
                  <ArrowRight style={{ width: '14px', height: '14px' }} />
                </Link>
                <Link
                  href={`${localePrefix}/integrations`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '14px 18px',
                    borderRadius: '14px',
                    textDecoration: 'none',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    color: '#111827',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  {auditSection.ctaSecondary}
                </Link>
              </div>
            </div>

            <div className="fade-in d2" style={{ padding: '28px', backgroundColor: '#111827', borderRadius: '24px', color: '#fff', boxShadow: '0 24px 48px rgba(15,23,42,0.12)' }}>
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fde68a', marginBottom: '8px' }}>
                  {auditSection.scoreLabel}
                </div>
                <div style={{ fontSize: '58px', lineHeight: 1, fontWeight: 700, letterSpacing: '-0.06em' }}>61/100</div>
              </div>
              <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
                <div style={{ padding: '14px 16px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>{auditSection.potentialLabel}</div>
                  <div style={{ fontSize: '28px', fontWeight: 650, letterSpacing: '-0.04em' }}>84/100</div>
                  <div style={{ fontSize: '13px', color: '#fde68a', marginTop: '4px' }}>+23 points et +18% de visibilite estimee</div>
                </div>
                <div style={{ padding: '14px 16px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '10px' }}>{auditSection.issuesLabel}</div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {[
                      '34% de produits sans categorie exploitable',
                      '22% sans marque ou identifiant fiable',
                      '18% avec titre trop court ou incomplet',
                    ].map((item) => (
                      <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#f8fafc', lineHeight: 1.6 }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '999px', backgroundColor: '#f59e0b', marginTop: '8px', flexShrink: 0 }} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.7', color: '#cbd5e1' }}>
                Connexion source, audit automatique et restitution du potentiel directement dans l&apos;interface FeedPlug.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rpad" style={{ padding: '72px 48px', backgroundColor: '#ffffff' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="fade-in" style={{ marginBottom: '34px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#9ca3af',
                marginBottom: '12px',
              }}
            >
              {t('socialProof.title')}
            </div>
            <h2
              className="rtxt2"
              style={{
                fontSize: 'clamp(28px, 4vw, 40px)',
                fontWeight: '540',
                letterSpacing: '-0.03em',
                color: '#111827',
                margin: 0,
                maxWidth: '780px',
              }}
            >
              Une structure simple pour reprendre le contrôle de vos flux sans recruter une équipe ops dédiée.
            </h2>
          </div>

          <div className="rg4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px' }}>
            {metrics.map((m, i) => (
              <div
                key={`m-${i}`}
                className={`fade-in d${i + 1}`}
                style={{
                  padding: '24px',
                  backgroundColor: '#fafaf9',
                  border: '1px solid #eceff3',
                  borderRadius: '18px',
                }}
              >
                <div style={{ fontSize: '34px', fontWeight: '650', letterSpacing: '-0.05em', color: '#111827', marginBottom: '8px' }}>
                  {m.value}
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '6px' }}>{m.label}</div>
                <div style={{ fontSize: '13px', lineHeight: '1.55', color: '#6b7280' }}>{m.context}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rpad" style={{ padding: '88px 48px', backgroundColor: '#f8fafc', borderTop: '1px solid #eef2f7', borderBottom: '1px solid #eef2f7' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="fade-in" style={{ marginBottom: '42px', maxWidth: '760px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '12px' }}>
              Pourquoi FeedPlug
            </div>
            <h2 className="rtxt2" style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: '540', letterSpacing: '-0.03em', color: '#111827', marginBottom: '12px' }}>
              Le problème n’est pas juste le flux. C’est tout ce qui se casse entre la source, l’optimisation et la diffusion.
            </h2>
            <p style={{ fontSize: '16px', lineHeight: '1.7', color: '#6b7280', margin: 0 }}>
              FeedPlug centralise les irritants opérationnels les plus coûteux, puis donne un chemin de correction clair pour chaque catalogue.
            </p>
          </div>

          <div className="rg2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px' }}>
            <div style={{ padding: '28px', backgroundColor: '#ffffff', borderRadius: '20px', border: '1px solid #eceff3' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b91c1c', marginBottom: '18px' }}>
                Ce qui ralentit les équipes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={`p-${i}`} className="fade-in" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <AlertTriangle style={{ width: '18px', height: '18px', color: '#dc2626', flexShrink: 0, marginTop: '3px' }} />
                    <p style={{ fontSize: '15px', lineHeight: '1.65', color: '#4b5563', margin: 0 }}>{t(`painSolution.pains.${i}`)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '28px', backgroundColor: '#ffffff', borderRadius: '20px', border: '1px solid #eceff3' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#111827', marginBottom: '18px' }}>
                Ce que FeedPlug remet sous contrôle
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={`s-${i}`} className="fade-in" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <CheckCircle style={{ width: '18px', height: '18px', color: '#059669', flexShrink: 0, marginTop: '3px' }} />
                    <p style={{ fontSize: '15px', lineHeight: '1.65', color: '#111827', margin: 0 }}>{t(`painSolution.solutions.${i}`)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rpad" style={{ padding: '88px 48px', backgroundColor: '#ffffff' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="fade-in" style={{ marginBottom: '42px', maxWidth: '760px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '12px' }}>
              {t('howItWorks.title')}
            </div>
            <h2 className="rtxt2" style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: '540', letterSpacing: '-0.03em', color: '#111827', marginBottom: '12px' }}>
              Un flux de travail lisible, de l’import initial jusqu’à la diffusion multi-canal.
            </h2>
            <p style={{ fontSize: '16px', lineHeight: '1.7', color: '#6b7280', margin: 0 }}>{t('howItWorks.subtitle')}</p>
          </div>

          <div className="rg3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {[
              { icon: Database, step: 'step1', num: '01' },
              { icon: Zap, step: 'step2', num: '02' },
              { icon: Globe, step: 'step3', num: '03' },
            ].map(({ icon: Icon, step, num }, idx) => (
              <div
                key={step}
                className={`fade-in d${idx + 1}`}
                style={{
                  padding: '28px',
                  borderRadius: '20px',
                  backgroundColor: '#fafaf9',
                  border: '1px solid #eceff3',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '14px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon style={{ width: '20px', height: '20px', color: '#111827' }} />
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#9ca3af', letterSpacing: '0.04em' }}>{num}</div>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '10px' }}>
                  {t(`howItWorks.${step}.title`)}
                </h3>
                <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#6b7280', margin: 0 }}>
                  {t(`howItWorks.${step}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rpad" style={{ padding: '88px 48px', backgroundColor: '#111827' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="rg2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: '28px', alignItems: 'start' }}>
            <div className="fade-in">
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '12px' }}>
                {t('differentiators.title')}
              </div>
              <h2 className="rtxt2" style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: '540', letterSpacing: '-0.03em', color: '#ffffff', marginBottom: '14px' }}>
                Un produit d’opérations catalogue, pas un simple exporteur de flux.
              </h2>
              <p style={{ fontSize: '16px', lineHeight: '1.75', color: 'rgba(255,255,255,0.58)', margin: 0 }}>
                FeedPlug réunit correction, optimisation, contrôle qualité et diffusion dans une interface unique.
              </p>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              {[
                { icon: Sparkles, key: 'ai' },
                { icon: BarChart3, key: 'score' },
                { icon: Globe, key: 'multichannel' },
                { icon: Zap, key: 'nodev' },
              ].map(({ icon: Icon, key }, idx) => (
                <div
                  key={key}
                  className={`fade-in d${idx + 1}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '44px 1fr',
                    gap: '14px',
                    padding: '18px 20px',
                    borderRadius: '18px',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '14px',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon style={{ width: '20px', height: '20px', color: '#ffffff' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff', marginBottom: '6px' }}>
                      {t(`differentiators.${key}.title`)}
                    </h3>
                    <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgba(255,255,255,0.58)', margin: 0 }}>
                      {t(`differentiators.${key}.description`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ====== FAQ ====== */}
      <section className="rpad" style={{ padding: '96px 48px', backgroundColor: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <h2 className="fade-in rtxt2" style={{
            fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: '500',
            letterSpacing: '-0.02em', color: '#111827', marginBottom: '40px', textAlign: 'center'
          }}>
            {t('faq.title')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={`faq-${i}`} className="fade-in" style={{
                borderBottom: '1px solid #e5e7eb',
                ...(i === 0 ? { borderTop: '1px solid #e5e7eb' } : {})
              }}>
                <button onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)} style={{
                  width: '100%', padding: '20px 4px', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', border: 'none', background: 'none', cursor: 'pointer',
                  textAlign: 'left', fontFamily: 'inherit'
                }}>
                  <span style={{ fontSize: '16px', fontWeight: '500', color: '#111827', paddingRight: '16px' }}>
                    {t(`faq.items.${i}.q`)}
                  </span>
                  <ChevronDown className={`faq-chevron ${openFaqIndex === i ? 'open' : ''}`}
                    style={{ width: '18px', height: '18px', color: '#9ca3af', flexShrink: 0 }} />
                </button>
                <div className={`faq-answer ${openFaqIndex === i ? 'open' : ''}`} style={{ paddingLeft: '4px', paddingRight: '4px' }}>
                  <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#6b7280', margin: 0, paddingBottom: '20px' }}>
                    {t(`faq.items.${i}.a`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== CTA FINAL ====== */}
      <section className="rpad" style={{ padding: '100px 48px', backgroundColor: '#111827' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h2 className="fade-in rtxt2" style={{
            fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: '500',
            letterSpacing: '-0.02em', color: '#ffffff', marginBottom: '12px'
          }}>
            {t('finalCta.title')}{' '}
            <span style={{ fontWeight: '600' }}>{t('finalCta.titleHighlight')}</span>
          </h2>
          <p className="fade-in d1" style={{
            fontSize: '17px', lineHeight: '1.6', color: 'rgba(255,255,255,0.5)', marginBottom: '36px'
          }}>
            {t('finalCta.subtitle')}
          </p>
          <button className="fade-in d2" onClick={() => document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              padding: '14px 28px', backgroundColor: '#ffffff', color: '#111827',
              border: 'none', fontSize: '15px', fontWeight: '600', borderRadius: '6px',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '10px',
              fontFamily: 'inherit', transition: 'opacity 0.2s ease'
            }}
          >
            {t('finalCta.button')}
            <ArrowRight style={{ width: '15px', height: '15px' }} />
          </button>
          <p className="fade-in d3" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', marginTop: '16px' }}>
            {t('finalCta.trust')}
          </p>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="rpad" style={{ padding: '56px 48px', backgroundColor: '#ffffff', borderTop: '1px solid #f3f4f6' }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto',
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '40px'
        }}>
          <div style={{ maxWidth: '260px' }}>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#111827', marginBottom: '10px' }}>FeedPlug</div>
            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' }}>
              {t('hero.description')}
            </p>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: '14px' }}>{footerResourcesLabel}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {footerResources.map((item) => (
                <Link key={item.href} href={item.href} style={{ fontSize: '14px', color: '#6b7280', textDecoration: 'none' }}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: '14px' }}>Légal</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href={`${localePrefix}/legal/privacy`} style={{ fontSize: '14px', color: '#6b7280', textDecoration: 'none' }}>Politique de confidentialité</Link>
              <Link href={`${localePrefix}/legal/terms`} style={{ fontSize: '14px', color: '#6b7280', textDecoration: 'none' }}>Conditions générales</Link>
            </div>
          </div>
        </div>
        <div style={{
          maxWidth: '1100px', margin: '28px auto 0', paddingTop: '20px',
          borderTop: '1px solid #f3f4f6', fontSize: '13px', color: '#9ca3af'
        }}>
          © {new Date().getFullYear()} FeedPlug. Tous droits réservés.
        </div>
      </footer>
    </>
  );
}
