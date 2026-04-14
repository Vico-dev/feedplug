// Script de debug pour l'onboarding
// À utiliser dans la console du navigateur
// Note : la bannière et « visite terminée » sont aussi persistées côté serveur (OnboardingProgress.collectedData).
// Un reset localStorage seul réaffiche la bannière jusqu'au prochain chargement depuis l'API.

declare global {
  interface Window {
    debugOnboarding: () => void;
    showOnboardingState: () => void;
    resetOnboarding: () => void;
    forceOnboarding: () => void;
  }
}

export function debugOnboarding() {
  if (typeof window !== 'undefined') {
    console.log('=== DEBUG ONBOARDING ===');
    const currentState = localStorage.getItem('feedplug-onboarding');
    console.log('État local:', currentState ? JSON.parse(currentState) : 'Aucun état');
    localStorage.removeItem('feedplug-onboarding');
    console.log('✅ LocalStorage réinitialisé (rechargez pour resync avec le serveur)');
    window.location.reload();
  }
}

export function showOnboardingState() {
  if (typeof window !== 'undefined') {
    const currentState = localStorage.getItem('feedplug-onboarding');
    console.log('État onboarding:', currentState ? JSON.parse(currentState) : 'Aucun état');
  }
}

// Fonctions globales pour la console
if (typeof window !== 'undefined') {
  window.debugOnboarding = debugOnboarding;
  window.showOnboardingState = showOnboardingState;
  window.resetOnboarding = () => {
    localStorage.removeItem('feedplug-onboarding');
    console.log('✅ Onboarding réinitialisé');
  };
  window.forceOnboarding = () => {
    localStorage.setItem('feedplug-onboarding', JSON.stringify({
      isCompleted: false,
      hasSeenWelcome: false,
      currentStep: 0
    }));
    console.log('✅ Onboarding forcé - rechargez la page');
  };
}



