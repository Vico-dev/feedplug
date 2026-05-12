"use client";

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react';
import GoogleAuth from '@/components/auth/google-auth';
import { hasGoogleAuth } from '@/lib/google-auth';
import TurnstileWidget from '@/components/auth/turnstile-widget';
import AuthPageShell from '@/components/auth/AuthPageShell';
import { trackEvent } from '@/components/analytics/GoogleAnalytics';
import { buildLocalizedPath, getLocalePrefixFromPathname } from '@/lib/locale-navigation';
import { appendShopifyEmbeddedParams } from '@/lib/shopify-navigation';

const MIN_PASSWORD_LENGTH = 8;

/** Règles mot de passe alignées avec le backend (majuscule + chiffre). */
function validatePassword(pwd: string): { ok: boolean; message?: string } {
  if (pwd.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères` };
  }
  if (!/[A-Z]/.test(pwd)) {
    return { ok: false, message: 'Le mot de passe doit contenir au moins une majuscule' };
  }
  if (!/[0-9]/.test(pwd)) {
    return { ok: false, message: 'Le mot de passe doit contenir au moins un chiffre' };
  }
  return { ok: true };
}

function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response &&
    error.response.data &&
    typeof error.response.data === 'object' &&
    'message' in error.response.data
  ) {
    const message = error.response.data.message;
    return Array.isArray(message) ? message.join(' ') : String(message);
  }
  return fallback;
}

function isGoogleConflictMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('un compte existe déjà avec cet email') && normalized.includes('mot de passe');
}

function RegisterPageContent() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [formStartedAt] = useState(() => Date.now());
  
  const { register, loginWithGoogle } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const localePrefix = getLocalePrefixFromPathname(pathname);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  const captchaEnabled = turnstileSiteKey.length > 0;
  const onboardingHref = appendShopifyEmbeddedParams(buildLocalizedPath('/onboarding', localePrefix), searchParams);
  const loginHref = appendShopifyEmbeddedParams(buildLocalizedPath('/login', localePrefix), searchParams);
  const forgotPasswordHref = appendShopifyEmbeddedParams(buildLocalizedPath('/forgot-password', localePrefix), searchParams);

  const APP_URL = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_APP_URL || "https://app.feedplug.com").replace(/\/$/, "")
    : "https://app.feedplug.com";

  useEffect(() => {
    const prefilledEmail = (searchParams.get('email') || '').trim();
    if (prefilledEmail && !email) {
      setEmail(prefilledEmail);
    }
  }, [searchParams, email]);

  const redirectToOnboarding = () => {
    if (typeof window === "undefined") {
      router.push(onboardingHref);
      return;
    }
    const host = window.location.hostname;
    const isAppDomain = host === "app.feedplug.com" || host.endsWith(".run.app");
    if (isAppDomain) {
      router.push(onboardingHref);
    } else {
      window.location.href = `${APP_URL}${onboardingHref}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setIsLoading(false);
      return;
    }
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.ok) {
      setError(pwdCheck.message || 'Mot de passe invalide');
      setIsLoading(false);
      return;
    }
    if (captchaEnabled && !captchaToken) {
      setError('Merci de valider le captcha avant de créer le compte');
      setIsLoading(false);
      return;
    }

    const { firstName, lastName } = parseName(name);
    const accountName = company.trim() || `${firstName} ${lastName}`.trim() || 'Mon entreprise';

    try {
      await register({
        email,
        password,
        firstName,
        lastName,
        accountName,
        captchaToken: captchaToken || undefined,
        companyWebsite,
        formStartedAt
      });
      trackEvent('sign_up', {
        method: 'email',
        source: searchParams.get('source') || 'direct',
      });
      redirectToOnboarding();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Une erreur est survenue lors de l\'inscription'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential: string) => {
    setIsGoogleLoading(true);
    setError('');
    try {
      await loginWithGoogle(credential);
      redirectToOnboarding();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Erreur lors de la connexion avec Google'));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <AuthPageShell
      eyebrow="Essai gratuit"
      title="Créez votre compte FeedPlug"
      description="Ouvrez un essai, connectez une source et posez votre première base catalogue sans bricoler votre stack."
      highlights={[
        "30 jours d’essai gratuit sans carte bancaire.",
        "Connexion email ou Google selon votre mode de création de compte.",
        "Le parcours ouvre ensuite directement sur l’onboarding FeedPlug.",
      ]}
    >
      <div style={{
        width: '100%',
        maxWidth: '420px',
        margin: '0 auto',
      }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '400',
            color: '#0a0a0a',
            marginBottom: '8px'
          }}>Créer un compte</h1>
          <p style={{
            fontSize: '16px',
            color: 'var(--ink-3)'
          }}>
            30 jours d&apos;essai gratuit, sans carte bancaire
          </p>
        </div>

        {hasGoogleAuth && (
          <>
            <GoogleAuth
              onSuccess={handleGoogleSuccess}
              onError={setError}
              isLoading={isGoogleLoading}
            />
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '24px 0',
              gap: '16px'
            }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--line)' }} />
              <span style={{ fontSize: '14px', color: 'var(--ink-4)', fontWeight: '500' }}>ou</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--line)' }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
              pointerEvents: 'none'
            }}
          />
          {error && (
            <div style={{
              padding: '12px',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid #fecaca',
              borderRadius: '2px',
              color: 'var(--danger)',
              fontSize: '14px'
            }}>
              <div>{error}</div>
              {isGoogleConflictMessage(error) && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: '#7f1d1d', lineHeight: 1.5 }}>
                  Ce compte existe déjà en email/mot de passe.
                  {' '}
                  <Link href={loginHref} style={{ color: 'var(--danger)', textDecoration: 'underline', fontWeight: 600 }}>
                    Connecte-toi ici
                  </Link>
                  {' '}ou{' '}
                  <Link href={forgotPasswordHref} style={{ color: 'var(--danger)', textDecoration: 'underline', fontWeight: 600 }}>
                    réinitialise ton mot de passe
                  </Link>
                  .
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="register-name" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#0a0a0a',
              marginBottom: '8px'
            }}>
              Nom complet
            </label>
            <div style={{ position: 'relative' }}>
              <User style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '18px',
                height: '18px',
                color: 'var(--ink-4)'
              }} />
              <input
                id="register-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: '1px solid var(--line)',
                  borderRadius: '2px',
                  fontSize: '14px',
                  color: '#0a0a0a',
                  backgroundColor: '#ffffff'
                }}
                placeholder="John Doe"
              />
            </div>
          </div>

          <div>
            <label htmlFor="register-email" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#0a0a0a',
              marginBottom: '8px'
            }}>
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '18px',
                height: '18px',
                color: 'var(--ink-4)'
              }} />
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: '1px solid var(--line)',
                  borderRadius: '2px',
                  fontSize: '14px',
                  color: '#0a0a0a',
                  backgroundColor: '#ffffff'
                }}
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="register-company" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#0a0a0a',
              marginBottom: '8px'
            }}>
              Entreprise <span style={{ color: 'var(--ink-4)', fontWeight: '400' }}>(optionnel)</span>
            </label>
            <input
              id="register-company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              autoComplete="organization"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--line)',
                borderRadius: '2px',
                fontSize: '14px',
                color: '#0a0a0a',
                backgroundColor: '#ffffff'
              }}
              placeholder="Mon entreprise"
            />
          </div>

          <div>
            <label htmlFor="register-password" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#0a0a0a',
              marginBottom: '8px'
            }}>
              Mot de passe
            </label>
            <div style={{ position: 'relative' }}>
              <Lock style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '18px',
                height: '18px',
                color: 'var(--ink-4)'
              }} />
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 40px',
                  border: '1px solid var(--line)',
                  borderRadius: '2px',
                  fontSize: '14px',
                  color: '#0a0a0a',
                  backgroundColor: '#ffffff'
                }}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {showPassword ? (
                  <EyeOff style={{ width: '18px', height: '18px', color: 'var(--ink-4)' }} />
                ) : (
                  <Eye style={{ width: '18px', height: '18px', color: 'var(--ink-4)' }} />
                )}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '4px', marginBottom: 0 }}>
              Au moins {MIN_PASSWORD_LENGTH} caractères, une majuscule et un chiffre
            </p>
          </div>

          <div>
            <label htmlFor="register-confirm-password" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#0a0a0a',
              marginBottom: '8px'
            }}>
              Confirmer le mot de passe
            </label>
            <div style={{ position: 'relative' }}>
              <Lock style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '18px',
                height: '18px',
                color: 'var(--ink-4)'
              }} />
              <input
                id="register-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 40px',
                  border: '1px solid var(--line)',
                  borderRadius: '2px',
                  fontSize: '14px',
                  color: '#0a0a0a',
                  backgroundColor: '#ffffff'
                }}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {showConfirmPassword ? (
                  <EyeOff style={{ width: '18px', height: '18px', color: 'var(--ink-4)' }} />
                ) : (
                  <Eye style={{ width: '18px', height: '18px', color: 'var(--ink-4)' }} />
                )}
              </button>
            </div>
          </div>

          {captchaEnabled && (
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#0a0a0a',
                marginBottom: '8px'
              }}>
                Vérification anti-spam
              </label>
              <div style={{
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '12px',
                backgroundColor: '#fafafa'
              }}>
                <TurnstileWidget siteKey={turnstileSiteKey} onTokenChange={setCaptchaToken} />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || (captchaEnabled && !captchaToken)}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: isLoading || (captchaEnabled && !captchaToken) ? 'var(--ink-4)' : 'var(--ink)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: isLoading || (captchaEnabled && !captchaToken) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'opacity 0.2s',
            }}
          >
            {isLoading ? 'Inscription...' : 'Créer mon compte'}
            {!isLoading && <ArrowRight style={{ width: '18px', height: '18px' }} />}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          marginTop: '24px',
          fontSize: '14px',
          color: 'var(--ink-3)'
        }}>
          Déjà un compte ?{' '}
          <Link href={loginHref} style={{ color: 'var(--ink)', textDecoration: 'none', fontWeight: '600' }}>
            Se connecter
          </Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', color: 'var(--ink-4)' }}>
          <Link href="/tarifs" style={{ color: 'var(--ink-3)', textDecoration: 'underline' }}>Voir les tarifs</Link>
        </p>
      </div>
    </AuthPageShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#ffffff" }} />}>
      <RegisterPageContent />
    </Suspense>
  );
}
