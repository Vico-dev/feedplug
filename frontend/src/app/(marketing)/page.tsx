"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Eye
} from 'lucide-react';
import { apiClient } from '@/lib/api';

export default function MarketingLandingPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
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
      await apiClient.post('/marketing/early-access', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        jobTitle: jobTitle.trim(),
        phone: phone.trim(),
        email: email.trim(),
        company: company.trim()
      });

      setIsSubmitted(true);
      setFirstName('');
      setLastName('');
      setJobTitle('');
      setPhone('');
      setEmail('');
      setCompany('');
    } catch (err: unknown) {
      console.error('Erreur inscription early access:', err);
      const errObj = err as { message?: string; response?: { message?: string }; status?: number };
      const errorMessage =
        errObj?.message ||
        errObj?.response?.message ||
        'Une erreur est survenue. Vérifiez les champs et réessayez.';
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
      {/* Navigation Corporate */}
      <nav className="responsive-nav" style={{
        position: 'sticky',
        top: 0,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        zIndex: 1000,
        padding: '24px 0'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '24px'
        }}>
          <Link href="/" style={{
            fontSize: '18px',
            fontWeight: '500',
            letterSpacing: '-0.02em',
            color: '#0a0a0a',
            textDecoration: 'none'
          }}>
            FeedPlug
          </Link>
          
          <div className="responsive-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '48px' }}>
            <a href="#solutions" className="nav-link" style={{
              textDecoration: 'none',
              color: '#4a4a4a',
              fontSize: '14px',
              fontWeight: '400',
              letterSpacing: '0.01em'
            }}>
              Solutions
            </a>
            <Link href="/demo" className="nav-link" style={{
              textDecoration: 'none',
              color: '#4a4a4a',
              fontSize: '14px',
              fontWeight: '400',
              letterSpacing: '0.01em'
            }}>
              Contact
            </Link>
            <Link href="/docs" className="nav-link" style={{
              textDecoration: 'none',
              color: '#4a4a4a',
              fontSize: '14px',
              fontWeight: '400',
              letterSpacing: '0.01em'
            }}>
              Documentation
            </Link>
            <a href="https://app.feedplug.com/login" style={{
              color: '#0a0a0a',
              fontSize: '14px',
              fontWeight: '400',
              textDecoration: 'none',
              borderBottom: '1px solid #0a0a0a',
              paddingBottom: '2px',
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.7';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}>
              Accès client
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section Enterprise */}
      <section className="responsive-hero-padding" style={{
        padding: '100px 48px 80px',
        backgroundColor: '#ffffff'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div className="hero-subtitle" style={{
            fontSize: '12px',
            fontWeight: '500',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#6b7280',
            marginBottom: '32px'
          }}>
            Synchronisation produits multi-canal
          </div>
          
          <h1 className="hero-text responsive-text" style={{
            fontSize: 'clamp(56px, 7vw, 96px)',
            fontWeight: '300',
            lineHeight: '1.05',
            marginBottom: '32px',
            letterSpacing: '-0.04em',
            color: '#0a0a0a',
            maxWidth: '1000px'
          }}>
            Multipliez vos ventes
            <br />
            en synchronisant vos produits
            <br />
            <span style={{ fontWeight: '400', color: '#4a4a4a' }}>sur tous vos canaux</span>
          </h1>
          
          <p className="hero-description responsive-text-small" style={{
            fontSize: '22px',
            lineHeight: '1.6',
            marginBottom: '48px',
            color: '#4a4a4a',
            maxWidth: '720px',
            fontWeight: '300',
            letterSpacing: '-0.01em'
          }}>
            La plateforme de référence pour les grands groupes e-commerce. 
            Connectez une fois, diffusez partout. Déployez sur de nouveaux canaux et de nouveaux marchés en quelques minutes.
          </p>

          {/* Formulaire Enterprise */}
          {!isSubmitted ? (
            <form onSubmit={handleEarlyAccess} className="hero-form responsive-form-grid" style={{ maxWidth: '640px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Prénom *"
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
                  type="text"
                  placeholder="Nom *"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
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
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Fonction *"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
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
                  type="tel"
                  placeholder="Téléphone *"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <input
                  type="email"
                  placeholder="Email professionnel *"
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
                <input
                  type="text"
                  placeholder="Entreprise *"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
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
                    'Envoi en cours...'
                  ) : (
                    <>
                      Découvrir la démo
                      <ArrowRight className="arrow-icon" style={{ width: '16px', height: '16px', transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
                    </>
                  )}
                </span>
              </button>
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
                  Merci pour votre intérêt
                </div>
              </div>
              <p style={{ fontSize: '15px', color: '#4a4a4a', margin: 0, lineHeight: '1.5' }}>
                Notre équipe vous contactera dans les 24h pour planifier une démonstration personnalisée.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Features Enterprise */}
      <section id="solutions" className="responsive-padding" style={{
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
            Solutions
          </div>
          
          <h2 className="fade-in-element delay-100 responsive-text" style={{
            fontSize: 'clamp(40px, 5vw, 56px)',
            fontWeight: '300',
            color: '#0a0a0a',
            marginBottom: '80px',
            letterSpacing: '-0.03em',
            maxWidth: '800px'
          }}>
            Une infrastructure complète
            <br />
            pour transformer votre e-commerce
          </h2>

          <div className="responsive-grid-3" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '64px 48px'
          }}>
            {[
              {
                icon: <Rocket style={{ width: '24px', height: '24px', color: '#0a0a0a' }} />,
                title: 'Nouveaux canaux en minutes',
                description: 'Diffusez vos produits sur un nouveau canal (Amazon, Cdiscount, Fnac...) en moins de 5 minutes. Aucun développement nécessaire.'
              },
              {
                icon: <TrendingUp style={{ width: '24px', height: '24px', color: '#0a0a0a' }} />,
                title: '+250% de couverture produits',
                description: 'Augmentez automatiquement votre visibilité sur Amazon, Google Shopping, Facebook et 50+ canaux.'
              },
              {
                icon: <MapPin style={{ width: '24px', height: '24px', color: '#0a0a0a' }} />,
                title: 'Expansion géographique rapide',
                description: 'Lancez-vous sur de nouveaux marchés (Italie, Espagne, Allemagne...) sans effort technique. Adaptation automatique des formats et langues.'
              },
              {
                icon: <Shield style={{ width: '24px', height: '24px', color: '#0a0a0a' }} />,
                title: 'Sécurité enterprise',
                description: 'Infrastructure certifiée SOC 2, conformité RGPD, chiffrement bout-en-bout. Données hébergées en Europe.'
              },
              {
                icon: <Database style={{ width: '24px', height: '24px', color: '#0a0a0a' }} />,
                title: 'Hub centralisé',
                description: 'Un seul point de contrôle pour gérer tous vos catalogues. Multi-marques, multi-pays, multi-canaux.'
              },
              {
                icon: <Globe style={{ width: '24px', height: '24px', color: '#0a0a0a' }} />,
                title: '50+ intégrations natives',
                description: 'Connecteurs pré-construits pour Amazon, Cdiscount, Fnac, Leroy Merlin, Meta, Google et bien plus.'
              }
            ].map((feature, index) => {
              const delayClass = index === 0 ? '' : index === 1 ? 'delay-100' : index === 2 ? 'delay-200' : index === 3 ? 'delay-300' : 'delay-400';
              return (
                <div key={index} className={`feature-card fade-in-element ${delayClass}`}>
                  <div className="icon-hover" style={{ marginBottom: '24px', display: 'inline-block' }}>
                    {feature.icon}
                  </div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '400',
                    color: '#0a0a0a',
                    marginBottom: '12px',
                    letterSpacing: '-0.01em'
                  }}>
                    {feature.title}
                  </h3>
                  <p style={{
                    fontSize: '15px',
                    color: '#6b7280',
                    lineHeight: '1.6',
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

      {/* Section Expansion - Nouveaux canaux et marchés */}
      <section className="responsive-padding" style={{
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
            Expansion
          </div>
          
          <h2 className="fade-in-element delay-100 responsive-text" style={{
            fontSize: 'clamp(40px, 5vw, 56px)',
            fontWeight: '300',
            color: '#0a0a0a',
            marginBottom: '24px',
            letterSpacing: '-0.03em',
            maxWidth: '800px'
          }}>
            Lancez-vous sur de nouveaux canaux
            <br />
            et de nouveaux marchés en quelques minutes
          </h2>
          
          <p className="fade-in-element delay-200 responsive-text-small" style={{
            fontSize: '18px',
            color: '#4a4a4a',
            marginBottom: '64px',
            fontWeight: '300',
            maxWidth: '720px',
            lineHeight: '1.6'
          }}>
            Plus besoin de monter des projets techniques complexes. Avec FeedPlug, vous diffusez vos produits sur de nouveaux canaux et de nouveaux marchés en quelques clics.
          </p>

          <div className="responsive-grid-2" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '48px',
            marginBottom: '80px'
          }}>
            {/* Nouveaux canaux */}
            <div className="fade-in-element delay-300" style={{
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
                Nouveaux canaux en 5 minutes
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#6b7280',
                lineHeight: '1.6',
                marginBottom: '32px',
                fontWeight: '300'
              }}>
                Vous souhaitez tester Amazon, Cdiscount ou Fnac ? Configurez votre diffusion en quelques clics. Pas besoin de développer ni d&apos;intégrer des APIs complexes.
              </p>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {[
                  { icon: <Clock style={{ width: '16px', height: '16px', color: '#6b7280' }} />, text: 'Configuration en 5 minutes' },
                  { icon: <Zap style={{ width: '16px', height: '16px', color: '#6b7280' }} />, text: 'Mise en ligne automatique' },
                  { icon: <Target style={{ width: '16px', height: '16px', color: '#6b7280' }} />, text: 'Adaptation automatique des formats' }
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
            <div className="fade-in-element delay-400" style={{
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
                Expansion géographique facile
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#6b7280',
                lineHeight: '1.6',
                marginBottom: '32px',
                fontWeight: '300'
              }}>
                Lancez-vous sur l&apos;Italie, l&apos;Espagne, l&apos;Allemagne ou tout autre marché européen sans effort technique. Traduction automatique, adaptation des devises et formats locaux.
              </p>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {[
                  { icon: <Globe style={{ width: '16px', height: '16px', color: '#6b7280' }} />, text: 'Multi-pays et multi-langues' },
                  { icon: <Zap style={{ width: '16px', height: '16px', color: '#6b7280' }} />, text: 'Déploiement instantané' },
                  { icon: <CheckCircle style={{ width: '16px', height: '16px', color: '#6b7280' }} />, text: 'Conformité locale automatique' }
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
                  title: 'De 3 à 15 canaux',
                  description: 'Un de nos clients est passé de 3 canaux à 15 canaux en 2 semaines',
                  metric: '5x'
                },
                {
                  title: 'France → Italie',
                  description: 'Déploiement complet sur le marché italien en 48h',
                  metric: '48h'
                },
                {
                  title: '70% de coûts réduits',
                  description: 'Élimination des développements techniques d&apos;intégration',
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
            Fonctionnalités avancées
          </div>
          
          <h2 className="fade-in-element delay-100 responsive-text" style={{
            fontSize: 'clamp(40px, 5vw, 56px)',
            fontWeight: '300',
            color: '#0a0a0a',
            marginBottom: '24px',
            letterSpacing: '-0.03em',
            maxWidth: '800px'
          }}>
            Plus qu&apos;une synchronisation,
            <br />
            une plateforme d&apos;optimisation intelligente
          </h2>
          
          <p className="fade-in-element delay-200 responsive-text-small" style={{
            fontSize: '18px',
            color: '#4a4a4a',
            marginBottom: '64px',
            fontWeight: '300',
            maxWidth: '720px',
            lineHeight: '1.6'
          }}>
            FeedPlug ne se contente pas de synchroniser vos produits. Analysez les performances, testez vos stratégies et optimisez automatiquement vos catalogues avec l&apos;IA.
          </p>

          <div className="responsive-grid-3" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '48px',
            marginBottom: '80px'
          }}>
            {/* Analytics & Performance */}
            <div className="feature-card fade-in-element delay-200" style={{
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
                Analytics & Performance
              </h3>
              <p style={{
                fontSize: '15px',
                color: '#6b7280',
                lineHeight: '1.6',
                marginBottom: '24px',
                fontWeight: '300'
              }}>
                Suivez les performances de vos produits en temps réel : impressions, clics, conversions, ROI par canal et par marché.
              </p>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {[
                  'Tableaux de bord temps réel',
                  'ROI par canal et marché',
                  'Rapports personnalisables',
                  'Alertes de performance'
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
            <div className="feature-card fade-in-element delay-300" style={{
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
                A/B Testing intégré
              </h3>
              <p style={{
                fontSize: '15px',
                color: '#6b7280',
                lineHeight: '1.6',
                marginBottom: '24px',
                fontWeight: '300'
              }}>
                Testez différents titres, descriptions, prix et images sur vos canaux. Identifiez les variantes qui convertissent le mieux.
              </p>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {[
                  'Tests multi-variantes',
                  'Répartition de trafic automatique',
                  'Analyse statistique de confiance',
                  'Recommandations d\'optimisation'
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
            <div className="feature-card fade-in-element delay-400" style={{
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
                Scoring & IA automatique
              </h3>
              <p style={{
                fontSize: '15px',
                color: '#6b7280',
                lineHeight: '1.6',
                marginBottom: '24px',
                fontWeight: '300'
              }}>
                Scorez automatiquement vos produits selon leur qualité, complétude et potentiel de conversion. L&apos;IA génère et optimise vos contenus.
              </p>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {[
                  'Scoring qualité automatique',
                  'Génération IA titres/descriptions',
                  'Optimisation par canal',
                  'Détection d&apos;anomalies'
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
                title: 'Visibilité complète',
                description: 'Comprenez quels produits, sur quels canaux, génèrent le plus de revenus.'
              },
              {
                icon: <Target style={{ width: '24px', height: '24px', color: '#0a0a0a' }} />,
                title: 'Optimisation continue',
                description: 'L\'IA améliore automatiquement vos contenus produits pour maximiser les conversions.'
              },
              {
                icon: <TrendingUp style={{ width: '24px', height: '24px', color: '#0a0a0a' }} />,
                title: 'Décisions data-driven',
                description: 'Prenez des décisions stratégiques basées sur des données réelles, pas des intuitions.'
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

      {/* CTA Enterprise */}
      <section id="contact" className="responsive-padding" style={{
        padding: '120px 48px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', textAlign: 'left' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '500',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#6b7280',
            marginBottom: '16px'
          }}>
            Contact
          </div>
          
          <h2 className="fade-in-element responsive-text" style={{
            fontSize: 'clamp(40px, 5vw, 56px)',
            fontWeight: '300',
            color: '#0a0a0a',
            marginBottom: '24px',
            letterSpacing: '-0.03em',
            maxWidth: '600px'
          }}>
            Prêt à multiplier vos ventes ?
          </h2>
          
          <p className="fade-in-element delay-100 responsive-text-small" style={{
            fontSize: '18px',
            color: '#4a4a4a',
            marginBottom: '48px',
            fontWeight: '300',
            maxWidth: '560px',
            lineHeight: '1.6'
          }}>
            Réservez une démonstration personnalisée et découvrez comment déployer vos produits sur de nouveaux canaux et de nouveaux marchés en quelques minutes.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <a href="mailto:contact@feedplug.com" style={{
              color: '#0a0a0a',
              fontSize: '18px',
              textDecoration: 'none',
              borderBottom: '1px solid #0a0a0a',
              paddingBottom: '4px',
              display: 'inline-block',
              width: 'fit-content',
              transition: 'opacity 0.2s'
            }}>
              contact@feedplug.com
            </a>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '16px 0 0 0' }}>
              Réponse sous 24h
            </p>
          </div>
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
                Plateforme de synchronisation produits pour les entreprises.
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
                Legal
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a href="#" style={{ color: '#4a4a4a', fontSize: '14px', textDecoration: 'none', fontWeight: '300' }}>
                  Confidentialité
                </a>
                <a href="#" style={{ color: '#4a4a4a', fontSize: '14px', textDecoration: 'none', fontWeight: '300' }}>
                  Conditions d&apos;utilisation
                </a>
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
            © 2024 FeedPlug. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}


