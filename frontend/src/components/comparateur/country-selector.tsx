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
    <label className="inline-flex items-center gap-2 text-fs-13 text-ink-3">
      <span className="font-mono text-fs-12 uppercase tracking-wider text-ink-4">Pays</span>
      <select
        value={country}
        onChange={onChange}
        className="h-10 cursor-pointer rounded-lg border border-line bg-surface px-3 text-fs-14 text-ink shadow-xs outline-none transition duration-base ease-ds hover:border-line-strong focus:border-steel focus:ring-2 focus:ring-steel/30"
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
