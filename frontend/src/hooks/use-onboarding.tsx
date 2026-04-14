"use client";

/**
 * Fallback hook pour les pages hors OnboardingProvider (ex. app/(dashboard)/flux).
 * Retourne un état "onboarding terminé" pour ne pas afficher le guide contextuel.
 * Les pages sous [locale]/(dashboard) utilisent le context via useOnboarding() de @/contexts/onboarding-context.
 */
import { useState } from "react";

const defaultState = {
  isCompleted: true,
  currentStep: 0,
  hasSeenWelcome: true,
};

export function useOnboarding() {
  const [onboardingState] = useState(defaultState);
  return {
    onboardingState,
    isTourOpen: false,
    startOnboarding: () => {},
    completeOnboarding: () => {},
    closeOnboarding: () => {},
    dismissWelcomeBanner: () => {},
    setOnboardingFromServer: () => {},
    registerPersistWelcomeBanner: () => {},
    registerPersistTourCompleted: () => {},
    resetOnboarding: () => {},
    nextStep: () => {},
    skipStep: () => {},
    shouldShowOnboarding: () => false,
    shouldShowWelcomeBanner: () => false,
  };
}
