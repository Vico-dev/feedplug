"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

interface OnboardingState {
  isCompleted: boolean;
  currentStep: number;
  hasSeenWelcome: boolean;
}

const ONBOARDING_KEY = 'feedplug-onboarding';

type OnboardingContextValue = {
  onboardingState: OnboardingState;
  isTourOpen: boolean;
  startOnboarding: () => void;
  completeOnboarding: () => void;
  closeOnboarding: () => void;
  /** Ferme la bannière « Nouveau sur FeedPlug ? » et ne plus l’afficher (persiste en localStorage). */
  dismissWelcomeBanner: () => void;
  setOnboardingFromServer: (payload: { hasSeenWelcomeBanner?: boolean; tourCompleted?: boolean }) => void;
  /** À appeler quand le chargement serveur a échoué : on considère le chargement terminé sans écraser le state local (évite que la bannière revienne après fermeture). */
  markServerWelcomeLoaded: () => void;
  registerPersistWelcomeBanner: (fn: () => void | Promise<void>) => void;
  registerPersistTourCompleted: (fn: () => void | Promise<void>) => void;
  resetOnboarding: () => void;
  nextStep: () => void;
  skipStep: () => void;
  shouldShowOnboarding: () => boolean;
  shouldShowWelcomeBanner: () => boolean;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function getInitialOnboardingState(): OnboardingState {
  const fallbackState: OnboardingState = {
    isCompleted: false,
    currentStep: 0,
    hasSeenWelcome: false,
  };

  if (typeof window === "undefined") {
    return fallbackState;
  }

  const saved = localStorage.getItem(ONBOARDING_KEY);
  if (!saved) {
    return fallbackState;
  }

  try {
    return JSON.parse(saved) as OnboardingState;
  } catch (error) {
    console.error("Error parsing onboarding state:", error);
    return fallbackState;
  }
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [onboardingState, setOnboardingState] = useState<OnboardingState>(
    getInitialOnboardingState
  );
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [serverWelcomeLoaded, setServerWelcomeLoaded] = useState(false);
  const persistWelcomeBannerRef = useRef<(() => void | Promise<void>) | null>(null);
  const persistTourCompletedRef = useRef<(() => void | Promise<void>) | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(onboardingState));
    }
  }, [onboardingState]);

  const saveOnboardingState = (newState: Partial<OnboardingState>) => {
    setOnboardingState((prev) => ({ ...prev, ...newState }));
  };

  const startOnboarding = () => {
    persistWelcomeBannerRef.current?.();
    setIsTourOpen(true);
    saveOnboardingState({ hasSeenWelcome: true, currentStep: 0 });
  };

  const completeOnboarding = () => {
    persistTourCompletedRef.current?.();
    setIsTourOpen(false);
    saveOnboardingState({ isCompleted: true, currentStep: 0 });
  };

  const closeOnboarding = () => {
    setIsTourOpen(false);
  };

  const setOnboardingFromServer = (payload: { hasSeenWelcomeBanner?: boolean; tourCompleted?: boolean }) => {
    setServerWelcomeLoaded(true);
    setOnboardingState((prev) => {
      return {
        ...prev,
        ...(payload.hasSeenWelcomeBanner !== undefined && { hasSeenWelcome: payload.hasSeenWelcomeBanner }),
        ...(payload.tourCompleted !== undefined && { isCompleted: payload.tourCompleted }),
      };
    });
  };

  const markServerWelcomeLoaded = () => {
    setServerWelcomeLoaded(true);
  };

  const registerPersistWelcomeBanner = (fn: () => void | Promise<void>) => {
    persistWelcomeBannerRef.current = fn;
  };

  const registerPersistTourCompleted = (fn: () => void | Promise<void>) => {
    persistTourCompletedRef.current = fn;
  };

  const dismissWelcomeBanner = () => {
    persistWelcomeBannerRef.current?.();
    saveOnboardingState({ hasSeenWelcome: true });
    setIsTourOpen(false);
  };

  const nextStep = () => {
    const newStep = onboardingState.currentStep + 1;
    saveOnboardingState({ currentStep: newStep });
  };

  const skipStep = () => {
    const newStep = onboardingState.currentStep + 1;
    saveOnboardingState({ currentStep: newStep });
  };

  const resetOnboarding = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(ONBOARDING_KEY);
    }
    setServerWelcomeLoaded(true);
    setOnboardingState({
      isCompleted: false,
      currentStep: 0,
      hasSeenWelcome: false,
    });
    setIsTourOpen(false);
  };

  const shouldShowOnboarding = () => {
    return !onboardingState.isCompleted && !onboardingState.hasSeenWelcome;
  };

  const shouldShowWelcomeBanner = () => {
    return serverWelcomeLoaded && !onboardingState.isCompleted && !onboardingState.hasSeenWelcome;
  };

  return (
    <OnboardingContext.Provider
      value={{
        onboardingState,
        isTourOpen,
        startOnboarding,
        completeOnboarding,
        closeOnboarding,
        dismissWelcomeBanner,
        setOnboardingFromServer,
        markServerWelcomeLoaded,
        registerPersistWelcomeBanner,
        registerPersistTourCompleted,
        resetOnboarding,
        nextStep,
        skipStep,
        shouldShowOnboarding,
        shouldShowWelcomeBanner,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return ctx;
}

