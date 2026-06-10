"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { 
  ShoppingCart, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw,
} from 'lucide-react';

interface ShopifyConnectorProps {
  onConnected?: (shopName: string) => void;
}

interface ShopifyConnectResponse {
  url?: string;
}

interface ShopifyVerifyResponse {
  ok?: boolean;
  data?: unknown;
}

interface ShopifyShopData {
  shop?: {
    name?: string;
  };
}

interface ShopifyApiError {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const apiError = error as ShopifyApiError;
    return apiError.response?.data?.message || apiError.message || fallback;
  }
  return fallback;
}

function normalizeShopifyShopInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')
    .at(0)
    ?.replace(/\.myshopify\.com$/i, '')
    ?.trim() || '';
}

export function ShopifyConnector({ onConnected }: ShopifyConnectorProps) {
  const [shopName, setShopName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected');
  const [shopData, setShopData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const resolvedShopData =
    shopData && typeof shopData === 'object' ? (shopData as ShopifyShopData) : null;

  const handleConnect = async () => {
    const normalizedShop = normalizeShopifyShopInput(shopName);
    if (!normalizedShop) {
      setError('Veuillez entrer le nom de votre boutique');
      return;
    }
    const isValidShop = /^[a-z0-9-]+$/i.test(normalizedShop);
    if (!isValidShop) {
      setError('Utilisez le sous-domaine Shopify, par ex. ma-boutique ou ma-boutique.myshopify.com.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Appeler l'API pour initier la connexion OAuth Shopify
      const response = await apiClient.post<ShopifyConnectResponse>('/connectors/shopify/connect', {
        shop: normalizedShop
      });

      if (response.data.url) {
        // Rediriger vers Shopify pour l'autorisation
        window.location.href = response.data.url;
      } else {
        throw new Error('URL de connexion non reçue');
      }
    } catch (err: unknown) {
      console.error('Erreur de connexion Shopify:', err);
      setError(getErrorMessage(err, 'Erreur lors de la connexion à Shopify'));
      setConnectionStatus('error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleVerify = async () => {
    const normalizedShop = normalizeShopifyShopInput(shopName);
    if (!normalizedShop) return;

    setIsVerifying(true);
    setError(null);

    try {
      const response = await apiClient.get<ShopifyVerifyResponse>(`/connectors/shopify/verify?shop=${normalizedShop}`);
      
      if (response.data.ok) {
        setConnectionStatus('connected');
        setShopData(response.data.data);
        onConnected?.(normalizedShop);
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (err: unknown) {
      console.error('Erreur de vérification Shopify:', err);
      setError(getErrorMessage(err, 'Erreur lors de la vérification'));
      setConnectionStatus('error');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Card style={{ border: '1px solid var(--line)', borderRadius: '12px', backgroundColor: 'white' }}>
      <CardHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '48px', 
            height: '48px', 
            backgroundColor: 'var(--accent-bg)', 
            borderRadius: '12px' 
          }}>
            <ShoppingCart style={{ width: '24px', height: '24px', color: 'var(--accent)' }} />
          </div>
          <div>
            <CardTitle style={{ fontSize: '20px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>
              Connecteur Shopify
            </CardTitle>
            <CardDescription style={{ fontSize: '14px', color: 'var(--ink-3)', margin: 0 }}>
              Connectez votre boutique Shopify pour synchroniser vos produits
            </CardDescription>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {connectionStatus === 'connected' && (
            <Badge style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
              <CheckCircle style={{ width: '12px', height: '12px', marginRight: '4px' }} />
              Connecté
            </Badge>
          )}
          {connectionStatus === 'error' && (
            <Badge style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
              <AlertCircle style={{ width: '12px', height: '12px', marginRight: '4px' }} />
              Erreur
            </Badge>
          )}
          {connectionStatus === 'disconnected' && (
            <Badge style={{ backgroundColor: 'var(--paper-2)', color: 'var(--ink-3)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
              Non connecté
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {connectionStatus === 'disconnected' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label htmlFor="shopify-shop-name" style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--ink-2)',
                marginBottom: '6px'
              }}>
                Nom de votre boutique Shopify
              </label>
              <input
                type="text"
                id="shopify-shop-name"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="ma-boutique"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: error ? '2px solid var(--danger)' : '2px solid var(--line)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--line)'}
              />
              <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: '4px 0 0 0' }}>
                💡 Exemple : vous pouvez saisir ma-boutique, ma-boutique.myshopify.com ou l’URL directe de la boutique
              </p>
            </div>

            {error && (
              <div style={{
                backgroundColor: 'var(--danger-bg)',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px',
                color: 'var(--danger)',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <Button
              onClick={handleConnect}
              disabled={isConnecting || !shopName.trim()}
              style={{
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isConnecting || !shopName.trim() ? 0.6 : 1,
                cursor: isConnecting || !shopName.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              {isConnecting ? (
                <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
              ) : (
                <ExternalLink style={{ width: '16px', height: '16px' }} />
              )}
              {isConnecting ? 'Connexion en cours...' : 'Continuer avec Shopify'}
            </Button>

            <div style={{
              backgroundColor: 'var(--warning-bg)',
              border: '1px solid var(--warning)',
              borderRadius: '8px',
              padding: '12px',
              margin: '16px 0'
            }}>
              <p style={{ fontSize: '14px', color: 'var(--warning)', margin: 0 }}>
                💡 <strong>Conseil :</strong> Nous utiliserons l&apos;authentification sécurisée Shopify OAuth. 
                Vous serez redirigé vers Shopify pour autoriser l&apos;accès à vos données.
              </p>
            </div>
          </div>
        )}

        {connectionStatus === 'connected' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              backgroundColor: 'var(--success-bg)',
              border: '1px solid #BBF7D0',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <CheckCircle style={{ width: '20px', height: '20px', color: 'var(--success)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--success)', margin: 0 }}>
                  Boutique connectée avec succès !
                </h4>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--success)', margin: 0 }}>
                Votre boutique <strong>{shopName}</strong> est maintenant connectée à FeedPlug.
              </p>
            </div>

            {resolvedShopData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '32px', 
                    height: '32px', 
                    backgroundColor: 'var(--paper-2)', 
                    borderRadius: '8px' 
                  }}>
                    <ShoppingCart style={{ width: '16px', height: '16px', color: 'var(--ink-3)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: 0 }}>
                      Boutique
                    </p>
                    <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--ink)', margin: 0 }}>
                      {resolvedShopData.shop?.name || shopName}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Button
                onClick={handleVerify}
                disabled={isVerifying}
                variant="outline"
                style={{
                  border: '1px solid var(--line-strong)',
                  color: 'var(--ink-2)',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isVerifying ? 0.6 : 1
                }}
              >
                {isVerifying ? (
                  <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <RefreshCw style={{ width: '16px', height: '16px' }} />
                )}
                Vérifier la connexion
              </Button>
            </div>
          </div>
        )}

        {connectionStatus === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <AlertCircle style={{ width: '20px', height: '20px', color: 'var(--danger)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--danger)', margin: 0 }}>
                  Erreur de connexion
                </h4>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--danger)', margin: 0 }}>
                {error || 'Une erreur est survenue lors de la connexion à Shopify.'}
              </p>
            </div>

            <Button
              onClick={() => {
                setConnectionStatus('disconnected');
                setError(null);
                setShopData(null);
              }}
              style={{
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <RefreshCw style={{ width: '16px', height: '16px' }} />
              Réessayer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
