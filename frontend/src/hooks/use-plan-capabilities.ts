"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import type { PlanId } from '@/config/plans';
import { PLAN_LIMITS, PLAN_FEATURES } from '@/config/plans';
import { useAuth } from './use-auth';

export interface PlanLimits {
  maxProducts: number | null;
  maxFeedSources: number | null;
  maxFeeds: number | null;
  maxChannels?: number | null;
}

export interface PlanFeatures {
  exportGmc: boolean;
  aiEnrichment: boolean;
  qualityScore: boolean;
  supportLevel: string;
  /** Grille V2 : pack IA (génération titres + images) souscrit */
  addonIA?: boolean;
}

export interface PlanUsage {
  sourcesCount: number;
  feedsCount: number;
  productsCount: number;
  channelsCount?: number;
}

export interface AccountCapabilitiesResponse {
  plan: PlanId;
  limits: PlanLimits;
  features: PlanFeatures;
  usage: PlanUsage;
}

export function usePlanCapabilities() {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<AccountCapabilitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCapabilities = useCallback(async () => {
    if (!isAuthenticated) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<AccountCapabilitiesResponse>('/account/capabilities');
      setData(res.data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Erreur chargement des capacités'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCapabilities();
  }, [fetchCapabilities]);

  const plan = data?.plan ?? 'STARTER';
  const limits = useMemo(
    () => data?.limits ?? { ...PLAN_LIMITS.STARTER, maxChannels: 5 },
    [data?.limits]
  );
  const features = useMemo(
    () => data?.features ?? { ...PLAN_FEATURES.STARTER, addonIA: false },
    [data?.features]
  );
  const usage = useMemo(
    () => data?.usage ?? { sourcesCount: 0, feedsCount: 0, productsCount: 0, channelsCount: 0 },
    [data?.usage]
  );

  const canUseFeature = useCallback(
    (featureKey: keyof PlanFeatures): boolean => {
      return !!features[featureKey];
    },
    [features]
  );

  const isAtLimit = useCallback(
    (limitKey: keyof PlanLimits): boolean => {
      const limit = limits[limitKey];
      if (limit == null) return false; // null = illimité (ex. canaux sur devis)
      const count =
        limitKey === 'maxFeedSources'
          ? usage.sourcesCount
          : limitKey === 'maxFeeds'
            ? usage.feedsCount
            : limitKey === 'maxChannels'
              ? (usage.channelsCount ?? 0)
              : usage.productsCount;
      return count >= limit;
    },
    [limits, usage]
  );

  const canAddSource = limits.maxFeedSources == null || usage.sourcesCount < (limits.maxFeedSources ?? Infinity);
  const canAddFeed = limits.maxFeeds == null || usage.feedsCount < (limits.maxFeeds ?? Infinity);
  const canAddProducts = limits.maxProducts == null || usage.productsCount < (limits.maxProducts ?? Infinity);
  const maxChannels = limits.maxChannels ?? 5; // null = illimité (sur devis)
  const channelsCount = usage.channelsCount ?? 0;
  const canAddChannel = maxChannels == null || channelsCount < maxChannels;
  const canUseAddonIA = !!(features.addonIA ?? features.aiEnrichment);

  return {
    plan,
    limits,
    features,
    usage,
    loading,
    error,
    refetch: fetchCapabilities,
    canUseFeature,
    canUseAddonIA,
    isAtLimit,
    canAddSource,
    canAddFeed,
    canAddProducts,
    canAddChannel,
    channelsCount,
    maxChannels,
  };
}
