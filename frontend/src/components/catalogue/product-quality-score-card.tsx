"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ProductGainsSection, type PotentialGain } from "./product-gains-section";

const POSITIVE_THRESHOLD = 80;

function calculatePotentialGains(productScore: {
  qualityDetails?: {
    required?: Record<string, { filled?: boolean; quality?: number; weight?: number; qualityDetails?: { sellingScore?: number } }>;
    recommended?: Record<string, { filled?: boolean; weight?: number }>;
  };
}): PotentialGain[] {
  const gains: PotentialGain[] = [];
  const required = productScore.qualityDetails?.required ?? {};
  const recommended = productScore.qualityDetails?.recommended ?? {};

  const titleData = required.title;
  const titleWeight = titleData?.weight ?? 0;
  if (titleData?.filled && titleData.quality !== undefined) {
    const currentScore = Math.round(titleData.quality * 100);
    if (currentScore < 100) {
      gains.push({
        field: "title",
        label: "Titre",
        currentScore,
        maxScore: 100,
        gain: Math.round((1 - titleData.quality) * titleWeight * 100),
        priority: currentScore < 70 ? "high" : "medium",
        action: "Optimiser le titre",
      });
    }
  } else if (!titleData?.filled) {
    gains.push({
      field: "title",
      label: "Titre",
      currentScore: 0,
      maxScore: 100,
      gain: Math.round(titleWeight * 100),
      priority: "high",
      action: "Ajouter un titre",
    });
  }

  const descData = required.description;
  const descWeight = descData?.weight ?? 0;
  if (descData?.filled && descData.quality !== undefined) {
    const currentScore = Math.round(descData.quality * 100);
    if (currentScore < 100) {
      gains.push({
        field: "description",
        label: "Description",
        currentScore,
        maxScore: 100,
        gain: Math.round((1 - descData.quality) * descWeight * 100),
        priority: currentScore < 70 ? "high" : "medium",
        action: "Améliorer la description",
      });
    }
  } else if (!descData?.filled) {
    gains.push({
      field: "description",
      label: "Description",
      currentScore: 0,
      maxScore: 100,
      gain: Math.round(descWeight * 100),
      priority: "high",
      action: "Ajouter une description",
    });
  }

  const imageData = required.image;
  const imageWeight = imageData?.weight ?? 0;
  if (imageData?.filled && imageData.qualityDetails?.sellingScore !== undefined) {
    const currentScore = imageData.qualityDetails.sellingScore;
    if (currentScore < 100) {
      gains.push({
        field: "image",
        label: "Image",
        currentScore,
        maxScore: 100,
        gain: Math.round(
          ((100 - currentScore) / 100) * imageWeight * 100
        ),
        priority: currentScore < 70 ? "high" : "medium",
        action: "Améliorer l'image",
      });
    }
  } else if (!imageData?.filled) {
    gains.push({
      field: "image",
      label: "Image",
      currentScore: 0,
      maxScore: 100,
      gain: Math.round(imageWeight * 100),
      priority: "high",
      action: "Ajouter une image",
    });
  }

  Object.entries(recommended).forEach(([key, data]: [string, { filled?: boolean; weight?: number }]) => {
    if (!data.filled) {
      const labels: Record<string, string> = {
        brand: "Marque",
        gtin: "GTIN",
        mpn: "MPN",
        condition: "Condition",
      };
      gains.push({
        field: key,
        label: labels[key] || key,
        currentScore: 0,
        maxScore: 100,
        gain: Math.round((data.weight ?? 0) * 100),
        priority: "low",
        action: `Ajouter ${labels[key] || key}`,
      });
    }
  });

  return gains.sort((a, b) => {
    if (a.priority === "high" && b.priority !== "high") return -1;
    if (b.priority === "high" && a.priority !== "high") return 1;
    return b.gain - a.gain;
  });
}

export interface ProductQualityScoreCardProps {
  productScore: {
    qualityScore: number;
    dimensions?: Record<string, number>;
    qualityDetails?: {
      required?: Record<string, { filled?: boolean; quality?: number; weight?: number; qualityDetails?: { sellingScore?: number } }>;
      recommended?: Record<string, { filled?: boolean; weight?: number }>;
      recommendations?: Array<{ priority?: string; message?: string; impact?: string }>;
    };
  };
  onScrollToField: (field: string) => void;
  showPositiveFields: boolean;
  onTogglePositiveFields: () => void;
}

type RequiredQualityField = NonNullable<
  NonNullable<ProductQualityScoreCardProps["productScore"]["qualityDetails"]>["required"]
>[string];
type RecommendedQualityField = NonNullable<
  NonNullable<ProductQualityScoreCardProps["productScore"]["qualityDetails"]>["recommended"]
>[string];
type ProductRecommendation = NonNullable<
  NonNullable<ProductQualityScoreCardProps["productScore"]["qualityDetails"]>["recommendations"]
>[number];

export function ProductQualityScoreCard({
  productScore,
  onScrollToField,
  showPositiveFields,
  onTogglePositiveFields,
}: ProductQualityScoreCardProps) {
  const potentialGains = calculatePotentialGains(productScore);
  const totalPotentialGain = potentialGains.reduce((sum, g) => sum + g.gain, 0);
  const potentialFinalScore = Math.min(
    100,
    productScore.qualityScore + totalPotentialGain
  );

  const required = productScore.qualityDetails?.required ?? {};
  const recommended = productScore.qualityDetails?.recommended ?? {};
  const positiveFields: Array<{
    field: string;
    label: string;
    score?: number;
    type: "required" | "recommended";
  }> = [];

  Object.entries(required).forEach(([key, data]: [string, RequiredQualityField]) => {
    if (data.filled) {
      const labels: Record<string, string> = {
        title: "Titre",
        description: "Description",
        image: "Image",
        price: "Prix",
      };
      const qualityScore =
        data.quality !== undefined ? Math.round(data.quality * 100) : null;
      if (
        qualityScore === null ||
        qualityScore >= POSITIVE_THRESHOLD
      ) {
        positiveFields.push({
          field: key,
          label: labels[key] || key,
          score: qualityScore ?? undefined,
          type: "required",
        });
      }
    }
  });

  Object.entries(recommended).forEach(([key, data]: [string, RecommendedQualityField]) => {
    if (data.filled) {
      const labels: Record<string, string> = {
        brand: "Marque",
        gtin: "GTIN",
        mpn: "MPN",
        condition: "Condition",
      };
      positiveFields.push({
        field: key,
        label: labels[key] || key,
        type: "recommended",
      });
    }
  });

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="grid grid-cols-[1fr_auto] gap-8 items-center mb-8 pb-6 border-b-2">
          <div>
            <CardTitle className="text-2xl font-bold mb-2">
              Score de qualité du produit
            </CardTitle>
            <CardDescription>
              Analyse complète de la qualité et recommandations
              d&apos;optimisation
            </CardDescription>
          </div>
          <div
            className={cn(
              "text-center p-6 rounded-lg min-w-[180px]",
              productScore.qualityScore >= 80
                ? "bg-green-50 border-2 border-green-500"
                : productScore.qualityScore >= 60
                  ? "bg-yellow-50 border-2 border-yellow-500"
                  : "bg-red-50 border-2 border-red-500"
            )}
          >
            <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
              Score actuel
            </div>
            <div
              className={cn(
                "text-5xl font-bold leading-none mb-2",
                productScore.qualityScore >= 80
                  ? "text-green-500"
                  : productScore.qualityScore >= 60
                    ? "text-yellow-500"
                    : "text-red-500"
              )}
            >
              {productScore.qualityScore}
            </div>
            <div className="text-sm text-muted-foreground font-medium">
              / 100
            </div>
            {totalPotentialGain > 0 && (
              <div className="mt-3 pt-3 border-t">
                <div className="text-xs text-muted-foreground mb-1">
                  Potentiel
                </div>
                <div className="text-xl font-semibold text-blue-600 leading-none">
                  {potentialFinalScore}
                  <span className="text-sm text-green-500 ml-1">
                    (+{totalPotentialGain})
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {productScore.dimensions && (
          <div className="mb-8 p-6 bg-muted/50 border border-border rounded">
            <h3 className="text-base font-semibold mb-5 text-foreground">
              Scores par dimension
            </h3>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
              {[
                { key: "compliance", label: "Conformité GMC", weight: "30%" },
                {
                  key: "dataQuality",
                  label: "Qualité des données",
                  weight: "30%",
                },
                { key: "seo", label: "Optimisation SEO", weight: "25%" },
                {
                  key: "conversion",
                  label: "Potentiel conversion",
                  weight: "15%",
                },
              ].map((dim) => {
                const score = productScore.dimensions![dim.key] ?? 0;
                const borderColor =
                  score >= 80
                    ? "border-green-500"
                    : score >= 60
                      ? "border-amber-500"
                      : "border-red-500";
                const textColor =
                  score >= 80
                    ? "text-green-600"
                    : score >= 60
                      ? "text-amber-600"
                      : "text-red-600";
                const barColor =
                  score >= 80
                    ? "bg-green-500"
                    : score >= 60
                      ? "bg-amber-500"
                      : "bg-red-500";
                return (
                  <div
                    key={dim.key}
                    className={cn(
                      "p-4 bg-background rounded border-2",
                      borderColor
                    )}
                  >
                    <div className="text-xs text-muted-foreground mb-2 font-medium">
                      {dim.label}
                      <span className="text-[10px] text-muted-foreground/80 ml-1">
                        ({dim.weight})
                      </span>
                    </div>
                    <div
                      className={cn(
                        "text-3xl font-bold leading-none mb-2",
                        textColor
                      )}
                    >
                      {score}
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width]",
                          barColor
                        )}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {productScore.qualityDetails?.recommendations &&
          productScore.qualityDetails.recommendations.length > 0 && (
            <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded">
              <h3 className="text-base font-semibold mb-4 text-foreground">
                Recommandations prioritaires
              </h3>
              <div className="flex flex-col gap-3">
                {productScore.qualityDetails.recommendations
                  .slice(0, 5)
                  .map((rec: ProductRecommendation, idx: number) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 bg-background rounded border",
                        rec.priority === "high"
                          ? "border-red-300"
                          : "border-amber-300"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Circle
                          className={cn(
                            "mt-0.5 h-3 w-3 shrink-0 fill-current",
                            rec.priority === "high"
                              ? "text-[var(--danger)]"
                              : "text-[var(--warning)]"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-foreground mb-1">
                            {rec.message}
                          </div>
                          {rec.impact && (
                            <div className="text-xs text-muted-foreground">
                              Impact estimé: {rec.impact}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-foreground">
              Progression
            </span>
            <span className="text-sm text-muted-foreground">
              {productScore.qualityScore}% complété
              {totalPotentialGain > 0 && (
                <span className="text-primary ml-2">
                  • Potentiel: {potentialFinalScore}%
                </span>
              )}
            </span>
          </div>
          <div className="w-full h-4 bg-muted rounded-lg overflow-hidden relative shadow-inner">
            <div
              className={cn(
                "h-full rounded-lg transition-[width]",
                productScore.qualityScore >= 80
                  ? "bg-green-500"
                  : productScore.qualityScore >= 60
                    ? "bg-amber-500"
                    : "bg-red-500"
              )}
              style={{ width: `${productScore.qualityScore}%` }}
            />
            {totalPotentialGain > 0 && (
              <div
                className="absolute h-full bg-gradient-to-r from-blue-200 to-blue-300 opacity-70 border-l-2 border-white"
                style={{
                  left: `${productScore.qualityScore}%`,
                  width: `${totalPotentialGain}%`,
                }}
              />
            )}
          </div>
        </div>

        <ProductGainsSection
          potentialGains={potentialGains}
          onScrollToField={onScrollToField}
        />

        {positiveFields.length > 0 && (
          <div className="mb-6 rounded-lg border border-[var(--success)] bg-[var(--success-bg)] p-5">
            <button
              type="button"
              onClick={onTogglePositiveFields}
              className="w-full flex justify-between items-center bg-transparent border-0 cursor-pointer p-0 text-left"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-[var(--success)]" />
                <div>
                  <h3 className="text-base font-bold text-foreground m-0">
                    Ce qui va bien
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 m-0">
                    {positiveFields.length} champ
                    {positiveFields.length > 1 ? "s" : ""} correctement rempli
                    {positiveFields.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "text-xl text-green-600 transition-transform",
                  showPositiveFields && "rotate-180"
                )}
              >
                ▼
              </span>
            </button>
            {showPositiveFields && (
              <div className="mt-5 pt-5 border-t border-green-200 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                {positiveFields.map((field) => (
                  <div
                    key={field.field}
                    className="p-3 bg-background border border-green-200 rounded-md flex items-center gap-2"
                  >
                    <span className="text-lg text-green-600">✓</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground">
                        {field.label}
                      </div>
                      {field.score !== undefined && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Qualité: {field.score}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
