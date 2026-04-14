"use client";

import { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';

import { API_BASE_URL } from '@/lib/api';
import AuthPageShell from '@/components/auth/AuthPageShell';
const API_URL = API_BASE_URL;

function getForgotPasswordErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Erreur lors de l'envoi. Vérifiez votre connexion.";
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 s max

    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data: { message?: string } = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Erreur');
      }

      setSent(true);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Le serveur met trop de temps à répondre. Réessayez dans un instant.');
      } else {
        setError(getForgotPasswordErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthPageShell
        eyebrow="Réinitialisation"
        title="Un lien de réinitialisation est prêt"
        description="Si le compte existe, FeedPlug envoie un lien sécurisé pour reprendre l’accès sans exposer l’état réel de l’adresse."
        highlights={[
          "Le lien est envoyé uniquement si un compte correspond à l’adresse indiquée.",
          "La procédure reste discrète pour éviter l’énumération des comptes.",
          "Vous pourrez ensuite revenir directement sur la connexion.",
        ]}
      >
        <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto', padding: '12px 0', textAlign: 'center' }}>
          <CheckCircle style={{ width: '48px', height: '48px', color: '#16a34a', margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: '#111827', margin: '0 0 8px' }}>Email envoyé</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px', lineHeight: '1.5' }}>
            Si un compte existe avec l&apos;adresse <strong>{email}</strong>, vous recevrez un lien de réinitialisation.
          </p>
          <Link href="/login" style={{ fontSize: '14px', color: '#0ea5e9', textDecoration: 'none', fontWeight: '500' }}>
            Retour à la connexion
          </Link>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      eyebrow="Mot de passe oublié"
      title="Récupérez l’accès sans friction"
      description="Entrez votre adresse, FeedPlug vous renvoie un lien sécurisé pour redéfinir votre mot de passe sans assistance manuelle."
      highlights={[
        "La réinitialisation se fait par email, sans exposition inutile de vos données.",
        "Le lien vous renvoie vers une page de changement de mot de passe sécurisée.",
        "Une fois le mot de passe changé, vous revenez directement dans l’app.",
      ]}
    >
      <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto' }}>
        <Link href="/login" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6b7280', textDecoration: 'none', marginBottom: '24px' }}>
          <ArrowLeft style={{ width: '14px', height: '14px' }} /> Retour
        </Link>

        <h1 style={{ fontSize: '22px', fontWeight: '600', color: '#111827', margin: '0 0 8px' }}>Mot de passe oublié</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px' }}>
          Entrez votre email, nous vous enverrons un lien de réinitialisation.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Email</label>
            <div style={{ position: 'relative' }}>
              <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#9ca3af' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="votre@email.com"
                style={{ width: '100%', padding: '12px 12px 12px 40px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {error && (
            <p style={{ fontSize: '13px', color: '#dc2626', margin: '0 0 12px' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !email}
            style={{
              width: '100%', padding: '12px', border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: '600', color: 'white',
              backgroundColor: isLoading || !email ? '#d1d5db' : '#111827',
              cursor: isLoading || !email ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Envoi...' : 'Envoyer le lien'}
          </button>
        </form>
      </div>
    </AuthPageShell>
  );
}
