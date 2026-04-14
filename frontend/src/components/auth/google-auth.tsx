"use client";

import { GoogleLogin, CredentialResponse } from "@react-oauth/google";

interface GoogleAuthProps {
  onSuccess: (credential: string) => Promise<void>;
  onError: (error: string) => void;
  isLoading: boolean;
  setIsLoading?: (loading: boolean) => void;
}

export default function GoogleAuth({
  onSuccess,
  onError,
  isLoading,
}: GoogleAuthProps) {
  const handleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) {
      onError("Réponse Google invalide");
      return;
    }
    try {
      await onSuccess(response.credential);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erreur de connexion");
    }
  };

  return (
    <div style={{ opacity: isLoading ? 0.6 : 1, pointerEvents: isLoading ? "none" : "auto" }}>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => onError("La connexion Google a échoué")}
        useOneTap={false}
        theme="outline"
        size="large"
        type="standard"
        text="continue_with"
        shape="rectangular"
        width="100%"
      />
    </div>
  );
}
