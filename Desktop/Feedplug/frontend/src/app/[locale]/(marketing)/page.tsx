"use client";

import React, { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { 
  CheckCircle,
  ArrowRight,
  Database,
  Zap,
  TrendingUp,
  Globe,
  Target,
  BarChart3,
  Sparkles,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import MarketingHeader from '@/components/marketing/MarketingHeader';

export default function MarketingLandingPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  
  // Intersection Observer pour les animations au scroll
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    const elements = document.querySelectorAll('.fade-in-element');
    elements.forEach(el => observer.observe(el));
    return () => elements.forEach(el => observer.unobserve(el));
  }, []);

  const handleEarlyAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.post('/marketing/early-access', {
        email: email.trim(),
        locale: locale
      });
      setIsSubmitted(true);
      setEmail('');
    } catch (err: any) {
      let errorMessage = t('error.generic');
      if (err?.message) errorMessage = err.message;
      else if (err?.response?.message) errorMessage = err.response.message;
      else if (err?.data?.message) errorMessage = err.data.message;
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const channels = ['Google Shopping', 'Amazon', 'Meta', 'Cdiscount', 'Rakuten', 'Fnac', 'Mirakl', 'ChatGPT'];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .fade-in-element { opacity: 0; }
        .fade-in-element.animate-in {
          animation: fadeInUp 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        .fade-in-element.delay-100 { animation-delay: 0.1s; }
        .fade-in-element.delay-200 { animation-delay: 0.2s; }
        .fade-in-element.delay-300 { animation-delay: 0.3s; }
        .hero-text { animation: fadeInUp 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
        .hero-subtitle { animation: fadeInUp 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s forwards; opacity: 0; }
        .hero-form { animation: fadeInUp 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.4s forwards; opacity: 0; }
        .button-hover {
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          position: relative; overflow: hidden;
        }
        .button-hover::before {
          content: ''; position: absolute; top: 50%; left: 50%;
          width: 0; height: 0; background: rgba(255,255,255,0.1);
          border-radius: 50%; transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        .button-hover:hover::before { width: 300px; height: 300px; }
        .button-hover:hover { box-shadow: 0 8px 24px rgba(10,10,10,0.15); }
        .button-hover:hover .arrow-icon { transform: translateX(4px); }
        .feature-card { transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
        .feature-card:hover { transform: translateY(-4px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .input-focus { transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
        .input-focus:focus { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(10,10,10,0.08); }
        .faq-answer { max-height: 0; overflow: hidden; transition: max-height 0.4s ease-out, padding 0.4s ease-out; padding: 0 0; }
        .faq-answer.open { max-height: 300px; padding: 16px 0 0 0; }
        .faq-chevron { transition: transform 0.3s ease; }
        .faq-chevron.open { transform: rotate(180deg); }
        @media (max-width: 768px) {
          .responsive-grid-2 { grid-template-columns: 1fr !important; }
          .responsive-grid-3 { grid-template-columns: 1fr !important; }
          .responsive-grid-4 { grid-template-columns: 1fr 1fr !important; }
          .responsive-padding { padding-left: 24px !important; padding-right: 24px !important; padding-top: 60px !important; padding-bottom: 60px !important; }
          .responsive-hero { padding: 80px 24px 60px !important; }
          .responsive-text-hero { font-size: clamp(32px, 8vw, 56px) !important; }
          .responsive-text-large { font-size: clamp(28px, 6vw, 40px) !important; }
          .responsive-text-small { font-size: 16px !important; }
          .responsive-form { flex-direction: column !important; }
          .channels-strip { gap: 16px !important; }
        }
        @media (max-width: 480px) {
          .responsive-hero { padding: 60px 20px 48px !important; }
          .responsive-padding { padding-left: 20px !important; padding-right: 20px !important; padding-top: 48px !important; padding-bottom: 48px !important; }
          .responsive-grid-4 { grid-template-columns: 1fr !important; }
        }
      `}} />

      <MarketingHeader />

      {/* ====== SECTION 1: HERO ====== */}
      <section id="hero" className="responsive-hero" style={{
        padding: '120px 48px 80px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ maxWidth: '800px' }}>
          {/* Eyebrow */}
          <div className="hero-text" style={{
            fontSize: '13px',
            fontWeight: '500',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#6b7280',
            marginBottom: '24px'
          }}>
            {t('hero.eyebrow')}
          </div>

          {/* Headline */}
          <h1 className="hero-text responsive-text-hero" style={{
            fontSize: 'clamp(40px, 5vw, 64px)',
            fontWeight: '400',
            letterSpacing: '-0.03em',
            lineHeight: '1.1',
            color: '#0a0a0a',
            marginBottom: '24px'
          }}>
            {t('hero.title')}{' '}
            <span style={{ fontWeight: '300', color: '#4a4a4a' }}>{t('hero.titleHighlight')}</span>{' '}
            {t('hero.titleEnd')}
          </h1>

          {/* Sub-headline */}
          <p className="hero-subtitle responsive-text-small" style={{
            fontSize: '20px',
            lineHeight: '1.6',
            color: '#4a4a4a',
            fontWeight: '300',
            marginBottom: '40px',
            maxWidth: '680px'
          }}>
            {t('hero.description')}
          </p>

          {/* Form */}
          {!isSubmitted ? (
            <form onSubmit={handleEarlyAccess} className="hero-form" style={{ maxWidth: '520px' }}>
              <div className="responsive-form" style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <input
                  type="email"
                  placeholder={t('form.email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-focus"
                  style={{
                    flex: 1,
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
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="button-hover"
                  style={{
                    padding: '16px 28px',
                    backgroundColor: '#0a0a0a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '15px',
                    fontWeight: '400',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontFamily: 'inherit',
                    borderRadius: '2px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isSubmitting ? t('form.submitting') : (
                      <>{t('hero.ctaButton')} <ArrowRight className="arrow-icon" style={{ width: '16px', height: '16px', transition: 'transform 0.3s' }} /></>
                    )}
                  </span>
                </button>
              </div>

              {error && (
                <div style={{ color: '#dc2626', fontSize: '14px', marginBottom: '12px' }}>{error}</div>
              )}

              <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
                {t('hero.ctaSub')}
              </p>
            </form>
          ) : (
            <div style={{
              maxWidth: '520px', padding: '32px',
              border: '1px solid #d1d5db', backgroundColor: '#f9fafb', borderRadius: '2px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <CheckCircle style={{ width: '20px', height: '20px', color: '#16a34a' }} />
                <div style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a' }}>{t('form.success')}</div>
              </div>
              <p style={{ fontSize: '15px', color: '#4a4a4a', margin: 0, lineHeight: '1.5' }}>
                {t('form.successMessage')}
              </p>
            </div>
          )}

          {/* Channels strip */}
          <div className="channels-strip" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            marginTop: '48px',
            paddingTop: '32px',
            borderTop: '1px solid #e5e7eb',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '500' }}>
              {t('hero.logosLabel')}
            </span>
            {channels.map((ch) => (
              <span key={ch} style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>{ch}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ====== SECTION 2: PAIN → SOLUTION ====== */}
      <section className="responsive-padding" style={{
        padding: '100px 48px',
        backgroundColor: '#fafafa',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 className="fade-in-element responsive-text-large" style={{
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: '400',
            letterSpacing: '-0.02em',
            color: '#0a0a0a',
            marginBottom: '64px',
            textAlign: 'center'
          }}>
            {t('painSolution.title')}
          </h2>

          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px' }}>
            {/* Pains column */}
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={`pain-${i}`} className="fade-in-element" style={{
                    display: 'flex', gap: '16px', alignItems: 'flex-start'
                  }}>
                    <AlertTriangle style={{ width: '20px', height: '20px', color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
                    <p style={{ fontSize: '15px', lineHeight: '1.6', color: '#4a4a4a', margin: 0, fontWeight: '300' }}>
                      {t(`painSolution.pains.${i}`)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Solutions column */}
            <div>
              <div style={{
                fontSize: '14px', fontWeight: '600', letterSpacing: '0.05em',
                textTransform: 'uppercase', color: '#0a0a0a', marginBottom: '24px'
              }}>
                {t('painSolution.solutionTitle')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={`sol-${i}`} className="fade-in-element" style={{
                    display: 'flex', gap: '16px', alignItems: 'flex-start'
                  }}>
                    <CheckCircle style={{ width: '20px', height: '20px', color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                    <p style={{ fontSize: '15px', lineHeight: '1.6', color: '#0a0a0a', margin: 0, fontWeight: '400' }}>
                      {t(`painSolution.solutions.${i}`)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== SECTION 3: SOCIAL PROOF / RESULTATS ====== */}
      <section className="responsive-padding" style={{
        padding: '80px 48px',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="fade-in-element" style={{
            fontSize: '12px', fontWeight: '500', letterSpacing: '0.15em',
            textTransform: 'uppercase', color: '#6b7280', marginBottom: '48px', textAlign: 'center'
          }}>
            {t('socialProof.title')}
          </div>

          <div className="responsive-grid-4" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '32px'
          }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={`metric-${i}`} className="fade-in-element feature-card" style={{
                textAlign: 'center', padding: '32px 24px',
                border: '1px solid #e5e7eb', borderRadius: '2px', backgroundColor: '#ffffff'
              }}>
                <div style={{ fontSize: '40px', fontWeight: '600', color: '#0a0a0a', letterSpacing: '-0.02em', marginBottom: '8px' }}>
                  {t(`socialProof.metrics.${i}.value`)}
                </div>
                <div style={{ fontSize: '15px', fontWeight: '500', color: '#0a0a0a', marginBottom: '8px' }}>
                  {t(`socialProof.metrics.${i}.label`)}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                  {t(`socialProof.metrics.${i}.context`)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== SECTION 4: COMMENT CA MARCHE ====== */}
      <section className="responsive-padding" style={{
        padding: '100px 48px',
        backgroundColor: '#fafafa',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="fade-in-element" style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 className="responsive-text-large" style={{
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: '400', letterSpacing: '-0.02em', color: '#0a0a0a', marginBottom: '16px'
            }}>
              {t('howItWorks.title')}
            </h2>
            <p style={{ fontSize: '17px', color: '#6b7280', fontWeight: '300' }}>
              {t('howItWorks.subtitle')}
            </p>
          </div>

          <div className="responsive-grid-3" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '48px'
          }}>
            {[
              { icon: Database, step: 'step1', num: '01' },
              { icon: Zap, step: 'step2', num: '02' },
              { icon: Globe, step: 'step3', num: '03' }
            ].map(({ icon: Icon, step, num }) => (
              <div key={step} className="fade-in-element" style={{ position: 'relative' }}>
                <div style={{
                  fontSize: '48px', fontWeight: '200', color: '#e5e7eb', position: 'absolute',
                  top: '-8px', right: '0', letterSpacing: '-0.03em'
                }}>
                  {num}
                </div>
                <Icon style={{ width: '28px', height: '28px', color: '#0a0a0a', marginBottom: '20px' }} />
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#0a0a0a', marginBottom: '12px', letterSpacing: '-0.01em' }}>
                  {t(`howItWorks.${step}.title`)}
                </h3>
                <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#4a4a4a', fontWeight: '300' }}>
                  {t(`howItWorks.${step}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== SECTION 5: DIFFERENCIATEURS ====== */}
      <section className="responsive-padding" style={{
        padding: '100px 48px',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="fade-in-element" style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 className="responsive-text-large" style={{
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: '400', letterSpacing: '-0.02em', color: '#0a0a0a', marginBottom: '16px'
            }}>
              {t('differentiators.title')}
            </h2>
            <p style={{ fontSize: '17px', color: '#6b7280', fontWeight: '300' }}>
              {t('differentiators.subtitle')}
            </p>
          </div>

          <div className="responsive-grid-2" style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px'
          }}>
            {[
              { icon: Sparkles, key: 'ai' },
              { icon: BarChart3, key: 'score' },
              { icon: Globe, key: 'multichannel' },
              { icon: Zap, key: 'nodev' }
            ].map(({ icon: Icon, key }) => (
              <div key={key} className="fade-in-element feature-card" style={{
                padding: '40px 32px',
                border: '1px solid #e5e7eb',
                borderRadius: '2px',
                backgroundColor: '#ffffff'
              }}>
                <Icon style={{ width: '28px', height: '28px', color: '#0a0a0a', marginBottom: '20px' }} />
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#0a0a0a', marginBottom: '12px', letterSpacing: '-0.01em' }}>
                  {t(`differentiators.${key}.title`)}
                </h3>
                <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#4a4a4a', fontWeight: '300' }}>
                  {t(`differentiators.${key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== SECTION 6: MID-PAGE CTA ====== */}
      <section className="responsive-padding" style={{
        padding: '80px 48px',
        backgroundColor: '#fafafa',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <h2 className="fade-in-element responsive-text-large" style={{
            fontSize: 'clamp(24px, 3.5vw, 36px)',
            fontWeight: '400', letterSpacing: '-0.02em', color: '#0a0a0a', marginBottom: '32px'
          }}>
            {t('midCta.title')}
          </h2>

          {!isSubmitted ? (
            <form onSubmit={handleEarlyAccess} className="fade-in-element delay-100">
              <div className="responsive-form" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
                <input
                  type="email"
                  placeholder={t('form.email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-focus"
                  style={{
                    flex: 1, maxWidth: '320px',
                    padding: '14px 20px', border: '1px solid #d1d5db',
                    fontSize: '15px', outline: 'none', backgroundColor: '#ffffff',
                    color: '#0a0a0a', fontFamily: 'inherit', borderRadius: '2px'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0a0a0a'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="button-hover"
                  style={{
                    padding: '14px 24px', backgroundColor: '#0a0a0a', color: '#ffffff',
                    border: 'none', fontSize: '15px', fontWeight: '400',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.6 : 1,
                    display: 'inline-flex', alignItems: 'center', gap: '10px',
                    fontFamily: 'inherit', borderRadius: '2px', whiteSpace: 'nowrap'
                  }}
                >
                  {isSubmitting ? t('form.submitting') : t('form.submit')}
                </button>
              </div>
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>{t('midCta.trust')}</p>
            </form>
          ) : (
            <div className="fade-in-element" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <CheckCircle style={{ width: '18px', height: '18px', color: '#16a34a' }} />
              <span style={{ fontSize: '15px', color: '#16a34a', fontWeight: '500' }}>{t('form.success')}</span>
            </div>
          )}
        </div>
      </section>

      {/* ====== SECTION 7: FAQ ACCORDION ====== */}
      <section className="responsive-padding" style={{
        padding: '100px 48px',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 className="fade-in-element responsive-text-large" style={{
            fontSize: 'clamp(28px, 4vw, 36px)',
            fontWeight: '400', letterSpacing: '-0.02em', color: '#0a0a0a',
            marginBottom: '48px', textAlign: 'center'
          }}>
            {t('faq.title')}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={`faq-${i}`} className="fade-in-element" style={{
                borderBottom: '1px solid #e5e7eb',
                ...(i === 0 ? { borderTop: '1px solid #e5e7eb' } : {})
              }}>
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                  style={{
                    width: '100%', padding: '24px 0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    border: 'none', background: 'none', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit'
                  }}
                >
                  <span style={{ fontSize: '17px', fontWeight: '500', color: '#0a0a0a', paddingRight: '16px' }}>
                    {t(`faq.items.${i}.q`)}
                  </span>
                  <ChevronDown
                    className={`faq-chevron ${openFaqIndex === i ? 'open' : ''}`}
                    style={{ width: '20px', height: '20px', color: '#6b7280', flexShrink: 0 }}
                  />
                </button>
                <div className={`faq-answer ${openFaqIndex === i ? 'open' : ''}`}>
                  <p style={{ fontSize: '15px', lineHeight: '1.7', color: '#4a4a4a', fontWeight: '300', margin: 0, paddingBottom: '24px' }}>
                    {t(`faq.items.${i}.a`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== SECTION 8: CTA FINAL ====== */}
      <section className="responsive-padding" style={{
        padding: '100px 48px',
        backgroundColor: '#0a0a0a'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h2 className="fade-in-element responsive-text-large" style={{
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: '400', letterSpacing: '-0.02em', color: '#ffffff', marginBottom: '8px'
          }}>
            {t('finalCta.title')}{' '}
            <span style={{ fontWeight: '300', color: 'rgba(255,255,255,0.7)' }}>{t('finalCta.titleHighlight')}</span>
          </h2>

          <p className="fade-in-element delay-100" style={{
            fontSize: '18px', lineHeight: '1.6', color: 'rgba(255,255,255,0.6)',
            fontWeight: '300', marginBottom: '40px'
          }}>
            {t('finalCta.subtitle')}
          </p>

          <button
            className="fade-in-element delay-200 button-hover"
            onClick={() => document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              padding: '16px 32px',
              backgroundColor: '#ffffff', color: '#0a0a0a',
              border: 'none', fontSize: '15px', fontWeight: '400',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '12px',
              fontFamily: 'inherit', borderRadius: '2px'
            }}
          >
            <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
              {t('finalCta.button')}
              <ArrowRight className="arrow-icon" style={{ width: '16px', height: '16px', transition: 'transform 0.3s' }} />
            </span>
          </button>

          <p className="fade-in-element delay-300" style={{
            fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '20px'
          }}>
            {t('finalCta.trust')}
          </p>
        </div>
      </section>

      {/* ====== SECTION 9: FOOTER ====== */}
      <footer className="responsive-padding" style={{
        padding: '64px 48px',
        backgroundColor: '#fafafa',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '48px'
        }}>
          <div style={{ maxWidth: '280px' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#0a0a0a', marginBottom: '12px' }}>FeedPlug</div>
            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.6', fontWeight: '300' }}>
              {t('hero.description')}
            </p>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: '16px' }}>
              Documentation
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href="/docs" style={{ fontSize: '14px', color: '#4a4a4a', textDecoration: 'none', fontWeight: '300' }}>Documentation</a>
              <a href={`/${locale}/integrations`} style={{ fontSize: '14px', color: '#4a4a4a', textDecoration: 'none', fontWeight: '300' }}>Intégrations</a>
              <a href={`/${locale}/tarifs`} style={{ fontSize: '14px', color: '#4a4a4a', textDecoration: 'none', fontWeight: '300' }}>Tarifs</a>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: '16px' }}>
              Légal
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href={`/${locale}/legal/privacy`} style={{ fontSize: '14px', color: '#4a4a4a', textDecoration: 'none', fontWeight: '300' }}>Politique de confidentialité</a>
              <a href={`/${locale}/legal/terms`} style={{ fontSize: '14px', color: '#4a4a4a', textDecoration: 'none', fontWeight: '300' }}>Conditions générales</a>
            </div>
          </div>
        </div>

        <div style={{
          maxWidth: '1200px', margin: '32px auto 0',
          paddingTop: '24px', borderTop: '1px solid #e5e7eb',
          fontSize: '13px', color: '#9ca3af', fontWeight: '300'
        }}>
          © {new Date().getFullYear()} FeedPlug. Tous droits réservés.
        </div>
      </footer>
    </>
  );
}
