"use client";

import { Suspense, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';
import GoogleAuth from '@/components/auth/google-auth';
import { hasGoogleAuth } from '@/lib/google-auth';
import AuthPageShell from '@/components/auth/AuthPageShell';
import { buildLocalizedPath, getLocalePrefixFromPathname } from '@/lib/locale-navigation';
import { appendShopifyEmbeddedParams } from '@/lib/shopify-navigation';

function getAuthErrorMessage(error: unknown, fallback: string): string {
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

function LoginPageContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const localePrefix = getLocalePrefixFromPathname(pathname);
  const dashboardHref = appendShopifyEmbeddedParams(buildLocalizedPath('/dashboard', localePrefix), searchParams);
  const registerHref = appendShopifyEmbeddedParams(buildLocalizedPath('/register', localePrefix), searchParams);
  const forgotPasswordHref = appendShopifyEmbeddedParams(buildLocalizedPath('/forgot-password', localePrefix), searchParams);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login({ email, password });
      router.push(dashboardHref);
    } catch (error: unknown) {
      setError(getAuthErrorMessage(error, 'Une erreur est survenue lors de la connexion'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential: string) => {
    setIsGoogleLoading(true);
    setError('');
    try {
      await loginWithGoogle(credential);
      router.push(dashboardHref);
    } catch (error: unknown) {
      setError(getAuthErrorMessage(error, 'Erreur lors de la connexion avec Google'));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Styles uniformes pour les champs (Notion-like)
  const inputStyles = {
    width: '100%',
    padding: '10px 12px 10px 40px',
    border: '1px solid #e5e7eb',
    borderRadius: '2px',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s ease',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box' as const,
    fontFamily: 'Inter, system-ui, sans-serif',
  };

  const inputFocusStyles = {
    borderColor: '#0a0a0a',
    boxShadow: 'none',
  };

  const iconStyles = {
    position: 'absolute' as const,
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '18px',
    height: '18px',
    color: '#9ca3af',
    pointerEvents: 'none' as const,
  };

  return (
    <AuthPageShell
      eyebrow="Accès client"
      title="Connectez-vous à FeedPlug"
      description="Retrouvez votre catalogue, vos flux et vos optimisations dans une interface plus claire, plus sobre et plus contrôlable."
      highlights={[
        "Un seul point d’entrée pour vos catalogues, vos flux et vos exports.",
        "Accès direct à l’éditeur, aux sources et aux diagnostics produit.",
        "Connexion email ou Google selon votre mode de création de compte.",
      ]}
    >
      <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '400',
            color: '#0a0a0a',
            marginBottom: '8px',
            margin: 0
          }}>
            Connexion
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#6b7280',
            margin: 0
          }}>
            Connectez-vous à votre compte FeedPlug
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '2px',
            padding: '16px',
            marginBottom: '24px',
          }}>
            <p style={{
              fontSize: '14px',
              color: '#dc2626',
              margin: 0,
            }}>
              {error}
            </p>
            {isGoogleConflictMessage(error) && (
              <div style={{ marginTop: '10px', fontSize: '13px', color: '#7f1d1d', lineHeight: 1.5 }}>
                Connecte-toi avec ton mot de passe pour accéder à ce compte.
                {' '}
                <Link href={forgotPasswordHref} style={{ color: '#991b1b', textDecoration: 'underline', fontWeight: 600 }}>
                  Mot de passe oublié ?
                </Link>
              </div>
            )}
          </div>
        )}

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
              gap: '16px',
            }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
              <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: '500' }}>ou</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
            </div>
          </>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Email */}
          <div>
            <label htmlFor="login-email" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '400',
              color: '#0a0a0a',
              marginBottom: '8px',
            }}>
              Adresse email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail style={iconStyles} />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={inputStyles}
                onFocus={(e) => Object.assign(e.target.style, inputFocusStyles)}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
                placeholder="votre@email.com"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="login-password" style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '400',
              color: '#0a0a0a',
              marginBottom: '8px',
            }}>
              Mot de passe
            </label>
            <div style={{ position: 'relative' }}>
              <Lock style={iconStyles} />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={inputStyles}
                onFocus={(e) => Object.assign(e.target.style, inputFocusStyles)}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
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
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  padding: '4px',
                  borderRadius: '2px',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#6b7280'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
              >
                {showPassword ? (
                  <EyeOff style={{ width: '18px', height: '18px' }} />
                ) : (
                  <Eye style={{ width: '18px', height: '18px' }} />
                )}
              </button>
            </div>
          </div>

          {/* Forgot password link */}
          <div style={{ textAlign: 'right', marginBottom: '16px' }}>
            <Link href={forgotPasswordHref} style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>
              Mot de passe oublié ?
            </Link>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '10px 16px',
              backgroundColor: isLoading ? '#f3f4f6' : '#0a0a0a',
              color: isLoading ? '#6b7280' : '#ffffff',
              border: 'none',
              borderRadius: '2px',
              fontSize: '14px',
              fontWeight: '400',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = '#1a1a1a';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = '#0a0a0a';
              }
            }}
          >
            {isLoading ? (
              'Connexion...'
            ) : (
              <>
                Se connecter
                <ArrowRight style={{ width: '16px', height: '16px' }} />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid #e5e7eb',
        }}>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: 0,
          }}>
            Pas encore de compte ?{' '}
            <Link
              href={registerHref}
              style={{
                color: '#0a0a0a',
                textDecoration: 'none',
                fontWeight: '400',
                transition: 'color 0.2s ease',
              }}
            >
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </AuthPageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#ffffff' }} />}>
      <LoginPageContent />
    </Suspense>
  );
}
