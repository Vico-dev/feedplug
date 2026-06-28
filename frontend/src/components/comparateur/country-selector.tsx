"use client";

import type { ChangeEvent } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const COUNTRIES = [
  { code: "FR", label: "France · EUR" },
  { code: "DE", label: "Allemagne · EUR" },
  { code: "GB", label: "Royaume-Uni · GBP" },
];

export default function CountrySelector({ country }: { country: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(e: ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("country", e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
      <span>Pays</span>
      <select
        value={country}
        onChange={onChange}
        className="h-9 rounded-lg border border-gray-300 px-2 text-sm"
        aria-label="Choisir le pays de livraison"
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}
