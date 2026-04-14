"use client";

import { cn } from "@/lib/utils";

const RECOMMENDED_LABELS: Record<string, string> = {
  brand: "Marque",
  gtin: "GTIN (code-barres)",
  mpn: "MPN (numéro fabricant)",
  condition: "Condition",
};

export interface ProductQualityRecommendedSectionProps {
  recommended: Record<
    string,
    {
      filled?: boolean;
      weight?: number;
    }
  >;
  onScrollToField: (field: string) => void;
}

type RecommendedFieldData = ProductQualityRecommendedSectionProps["recommended"][string];

export function ProductQualityRecommendedSection({
  recommended,
  onScrollToField,
}: ProductQualityRecommendedSectionProps) {
  const entries = Object.entries(recommended || {});

  if (entries.length === 0) return null;

  return (
    <div className="mb-8 p-5 bg-muted/50 border border-border rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-bold text-foreground m-0">
          Détails des champs recommandés
        </h3>
        <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded font-medium">
          20% du score total
        </span>
      </div>
      <div className="grid gap-2">
        {entries.map(([key, data]: [string, RecommendedFieldData]) => {
          const gain = !data.filled ? Math.round((data.weight ?? 0) * 100) : 0;
          return (
            <div
              key={key}
              onClick={() => !data.filled && onScrollToField(key)}
              className={cn(
                "flex items-center justify-between gap-2 text-sm p-2.5 rounded border transition-all",
                data.filled
                  ? "bg-green-50 border-green-200"
                  : "bg-muted border-border cursor-pointer hover:bg-muted-foreground/10 hover:translate-x-0.5"
              )}
            >
              <div className="flex items-center gap-2 flex-1">
                <span
                  className={
                    data.filled ? "text-green-600" : "text-muted-foreground"
                  }
                >
                  {data.filled ? "✓" : "○"}
                </span>
                <div>
                  <span className="text-foreground font-medium">
                    {RECOMMENDED_LABELS[key] || key}
                  </span>
                  {!data.filled && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Gain potentiel: +{gain} points
                    </div>
                  )}
                </div>
              </div>
              {!data.filled && (
                <span className="text-xs text-primary font-medium">
                  Cliquer pour ajouter →
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
