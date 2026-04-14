"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirection vers la page Sources principale.
 * L’ancienne URL /admin/sources est conservée pour les liens et favoris.
 */
export default function AdminSourcesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sources");
  }, [router]);

  return null;
}
