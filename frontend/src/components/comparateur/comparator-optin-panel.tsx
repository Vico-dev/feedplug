"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api";

export function ComparatorOptInPanel() {
  const [optedIn, setOptedIn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ optedIn: boolean }>("/account/comparator-optin")
      .then((r) => setOptedIn(r.data?.optedIn ?? false))
      .catch(() => setOptedIn(false));
  }, []);

  async function toggle(next: boolean) {
    const prev = optedIn;
    setOptedIn(next);
    setSaving(true);
    try {
      await apiClient.put("/account/comparator-optin", { optedIn: next });
    } catch {
      setOptedIn(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-gray-900">Diffusion dans le comparateur</h3>
          <p className="mt-1 text-sm text-gray-500">
            Autorise l&apos;affichage de tes produits dans notre comparateur public, aux côtés
            d&apos;autres marchands. Désactivé par défaut — rien n&apos;est diffusé sans ton accord,
            et tu peux te retirer à tout moment.
          </p>
          {optedIn === true && (
            <p className="mt-2 text-xs text-green-700">Tes produits peuvent apparaître dans le comparateur.</p>
          )}
        </div>
        <Switch
          checked={optedIn ?? false}
          disabled={optedIn === null || saving}
          onCheckedChange={toggle}
          aria-label="Diffuser mes produits dans le comparateur"
        />
      </div>
    </div>
  );
}
