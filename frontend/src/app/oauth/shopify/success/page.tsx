"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ShopifySuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const connected = searchParams.get('connected');
    const shop = searchParams.get('shop') || '';
    const host = searchParams.get('host') || '';
    const locale = ['fr', 'en', 'es'].includes(searchParams.get('locale') || '')
      ? String(searchParams.get('locale'))
      : 'fr';

    if (connected === '1') {
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('shopify_connected', 'true');
          if (shop) localStorage.setItem('shopify_shop', shop);
        }
      } catch (error) {
        console.error('Error setting localStorage:', error);
      }
    }
    const guest = searchParams.get('guest');
    const params = new URLSearchParams({
      shopify: connected === '1' ? 'connected' : 'unknown',
    });
    if (shop) params.set('shop', shop);
    if (guest === '1') params.set('guest', '1');
    if (host) {
      params.set('host', host);
      params.set('embedded', '1');
    }
    const redirectUrl = `/${locale}/sources?${params.toString()}`;
    router.replace(redirectUrl);
  }, [router, searchParams]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-2)' }}>
      <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 10px 30px rgba(17,24,39,0.08)', color: 'var(--ink)' }}>
        <p style={{ margin: 0, fontSize: 14 }}>Redirection vers vos sources…</p>
      </div>
    </div>
  );
}

export default function ShopifySuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-2)' }}>
        <div style={{ background: 'white', padding: 24, borderRadius: 12, color: 'var(--ink)' }}>
          <p style={{ margin: 0, fontSize: 14 }}>Chargement…</p>
        </div>
      </div>
    }>
      <ShopifySuccessContent />
    </Suspense>
  );
}





