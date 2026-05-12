"use client";

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

import { API_BASE_URL } from '@/lib/api';
import AuthPageShell from '@/components/auth/AuthPageShell';
const API_URL = API_BASE_URL;

function getResetPasswordErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Erreur";
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <AuthPageShell
        eyebrow="Lien invalide"
        title="Ce lien ne peut plus être utilisé"
        description="Le jeton de réinitialisation est absent, invalide ou expiré. Le plus propre est de demander un nouveau lien."
        highlights={[
          "Les liens de réinitialisation sont temporaires et à usage limité.",
          "Aucun changement de mot de passe n’est appliqué sans token valide.",
          "Vous pouvez redemander un lien immédiatement depuis FeedPlug.",
        ]}
      >
        <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto', padding: '12px 0', textAlign: 'center' }}>
          <AlertCircle style={{ width: '48px', height: '48px', color: 'var(--danger)', margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 8px' }}>Lien invalide</h1>
          <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: '0 0 24px' }}>
            Ce lien de réinitialisation est invalide ou a expiré.
          </p>
          <Link href="/forgot-password" style={{ fontSize: '14px', color: 'var(--accent)', textDecoration: 'none', fontWeight: '500' }}>
            Demander un nouveau lien
          </Link>
        </div>
      </AuthPageShell>
    );
  }

  if (success) {
    return (
      <AuthPageShell
        eyebrow="Mot de passe mis à jour"
        title="Votre accès est rétabli"
        description="Le mot de passe a bien été remplacé. Vous pouvez maintenant revenir sur la connexion et reprendre votre session normalement."
        highlights={[
          "L’ancien mot de passe n’est plus valide.",
          "Vous pouvez revenir immédiatement sur la page de connexion.",
          "La suite logique est de reprendre l’onboarding ou votre catalogue.",
        ]}
      >
        <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto', padding: '12px 0', textAlign: 'center' }}>
          <CheckCircle style={{ width: '48px', height: '48px', color: 'var(--success)', margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 8px' }}>Mot de passe modifié</h1>
          <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: '0 0 24px' }}>
            Votre mot de passe a été réinitialisé avec succès.
          </p>
          <Link href="/login" style={{ display: 'inline-block', padding: '12px 24px', backgroundColor: 'var(--ink)', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
            Se connecter
          </Link>
        </div>
      </AuthPageShell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data: { message?: string } = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur');
      setSuccess(true);
    } catch (err: unknown) {
      setError(getResetPasswordErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPageShell
      eyebrow="Nouveau mot de passe"
      title="Choisissez un mot de passe solide"
      description="Définissez un nouveau mot de passe conforme aux règles de sécurité FeedPlug, puis revenez dans votre compte sans friction."
      highlights={[
        "Minimum 8 caractères, avec au moins une majuscule et un chiffre.",
        "Le changement s’applique immédiatement après validation.",
        "Une fois enregistré, vous pourrez vous reconnecter normalement.",
      ]}
    >
      <div style={{ maxWidth: '400px', width: '100%', margin: '0 auto' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 8px' }}>Nouveau mot de passe</h1>
        <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: '0 0 24px' }}>
          Choisissez un nouveau mot de passe (8+ caractères, 1 majuscule, 1 chiffre).
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--ink-2)', marginBottom: '6px' }}>Nouveau mot de passe</label>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: 'var(--ink-4)' }} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                style={{ width: '100%', padding: '12px 12px 12px 40px', border: '1px solid var(--line-strong)', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--ink-2)', marginBottom: '6px' }}>Confirmer le mot de passe</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
              style={{ width: '100%', padding: '12px', border: '1px solid var(--line-strong)', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {error && <p style={{ fontSize: '13px', color: 'var(--danger)', margin: '0 0 12px' }}>{error}</p>}

          <button type="submit" disabled={isLoading || !password || !confirmPassword}
            style={{ width: '100%', padding: '12px', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', color: 'white', backgroundColor: isLoading ? 'var(--line-strong)' : 'var(--ink)', cursor: isLoading ? 'not-allowed' : 'pointer' }}
          >
            {isLoading ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </div>
    </AuthPageShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Chargement...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
