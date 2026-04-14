"use client";

import { cn } from "@/lib/utils";

const REQUIRED_LABELS: Record<string, string> = {
  title: "Titre",
  description: "Description",
  image: "Image",
  price: "Prix",
};

export interface ProductQualityDetailsSectionProps {
  required: Record<
    string,
    {
      filled?: boolean;
      quality?: number;
      weight?: number;
      qualityDetails?: {
        sellingScore?: number;
        details?: {
          technicalQuality?: {
            score?: number;
            avgSaturation?: number;
            avgBrightness?: number;
            issues?: string[];
          };
          productVisibility?: {
            score?: number;
            objectsDetected?: number;
            largeObjectsDetected?: number;
            issues?: string[];
          };
          imageIssues?: {
            score?: number;
            textBlocksCount?: number;
            hasWatermark?: boolean;
            issues?: string[];
          };
          labels?: Array<{ description?: string; score?: number }>;
        };
        recommendations?: string[];
      };
      length?: number;
      wordCount?: number;
      sentenceCount?: number;
      issues?: string[];
    }
  >;
}

type RequiredFieldData = ProductQualityDetailsSectionProps["required"][string];
type DetectedLabel = NonNullable<
  NonNullable<NonNullable<RequiredFieldData["qualityDetails"]>["details"]>["labels"]
>[number];

export function ProductQualityDetailsSection({
  required,
}: ProductQualityDetailsSectionProps) {
  const entries = Object.entries(required || {});

  if (entries.length === 0) return null;

  return (
    <div className="mt-8 mb-8 p-5 bg-muted/50 border border-border rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-bold text-foreground m-0">
          Détails des champs obligatoires
        </h3>
        <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded font-medium">
          70% du score total
        </span>
      </div>
      <div className="grid gap-2">
        {entries.map(([key, data]: [string, RequiredFieldData]) => {
          const labels = REQUIRED_LABELS;
          const quality = data.qualityDetails || {};
          const qualityRecommendations = quality.recommendations ?? [];
          const fieldIssues = data.issues ?? [];
          const qualityScore =
            data.quality !== undefined ? Math.round(data.quality * 100) : null;

          // Image avec analyse détaillée
          if (
            key === "image" &&
            data.filled &&
            quality.sellingScore !== undefined
          ) {
            const imageDetails = quality.details || {};
            const technicalQuality = imageDetails.technicalQuality || {};
            const technicalIssues = technicalQuality.issues ?? [];
            const productVisibility = imageDetails.productVisibility || {};
            const productVisibilityIssues = productVisibility.issues ?? [];
            const imageIssues = imageDetails.imageIssues || {};
            const imageIssueList = imageIssues.issues ?? [];
            const labelsDetected = imageDetails.labels || [];

            return (
              <div
                key={key}
                className={cn(
                  "p-4 rounded border mb-3",
                  data.filled
                    ? quality.sellingScore < 70
                      ? "bg-amber-50 border-amber-200"
                      : "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                )}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className={cn(
                      "text-xl",
                      data.filled
                        ? quality.sellingScore < 70
                          ? "text-amber-500"
                          : "text-green-600"
                        : "text-red-500"
                    )}
                  >
                    {data.filled
                      ? quality.sellingScore < 70
                        ? "⚠"
                        : "✓"
                      : "✗"}
                  </span>
                  <span className="text-foreground font-semibold text-[15px] flex-1">
                    Image
                  </span>
                  <div className="flex flex-col items-end">
                    <span
                      className={cn(
                        "text-lg font-bold",
                        quality.sellingScore >= 70
                          ? "text-green-600"
                          : "text-amber-500"
                      )}
                    >
                      Score &quot;vendeuse&quot;: {quality.sellingScore}/100
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Qualité globale: {qualityScore}%
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 mt-3">
                  {technicalQuality.score !== undefined && (
                    <div className="p-2.5 bg-background border border-border rounded">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[13px] font-semibold text-foreground">
                          📸 Qualité technique
                        </span>
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            technicalQuality.score >= 0.7
                              ? "text-green-600"
                              : "text-amber-500"
                          )}
                        >
                          {Math.round(technicalQuality.score * 100)}%
                        </span>
                      </div>
                      {technicalQuality.avgSaturation !== undefined && (
                        <div className="text-[11px] text-muted-foreground mt-1">
                          Saturation:{" "}
                          {(technicalQuality.avgSaturation * 100).toFixed(0)}%
                          • Luminosité:{" "}
                          {((technicalQuality.avgBrightness ?? 0) * 100).toFixed(0)}%
                        </div>
                      )}
                      {technicalIssues.length > 0 && (
                        <ul className="mt-1.5 ml-5 p-0 text-[11px] text-muted-foreground list-disc">
                          {technicalIssues.map(
                            (issue: string, idx: number) => (
                              <li key={idx} className="mb-0.5">
                                {issue}
                              </li>
                            )
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                  {productVisibility.score !== undefined && (
                    <div className="p-2.5 bg-background border border-border rounded">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[13px] font-semibold text-foreground">
                          👁️ Visibilité du produit
                        </span>
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            productVisibility.score >= 0.7
                              ? "text-green-600"
                              : "text-amber-500"
                          )}
                        >
                          {Math.round(productVisibility.score * 100)}%
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Objets détectés:{" "}
                        {productVisibility.objectsDetected || 0} • Grands
                        objets: {productVisibility.largeObjectsDetected || 0}
                      </div>
                      {productVisibilityIssues.length > 0 && (
                        <ul className="mt-1.5 ml-5 p-0 text-[11px] text-muted-foreground list-disc">
                          {productVisibilityIssues.map(
                            (issue: string, idx: number) => (
                              <li key={idx} className="mb-0.5">
                                {issue}
                              </li>
                            )
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                  {imageIssues.score !== undefined && (
                    <div className="p-2.5 bg-background border border-border rounded">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[13px] font-semibold text-foreground">
                          🔍 Problèmes détectés
                        </span>
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            imageIssues.score >= 0.8
                              ? "text-green-600"
                              : "text-amber-500"
                          )}
                        >
                          {Math.round(imageIssues.score * 100)}%
                        </span>
                      </div>
                      {imageIssues.textBlocksCount !== undefined && (
                        <div className="text-[11px] text-muted-foreground mt-1">
                          Blocs de texte: {imageIssues.textBlocksCount}
                          {imageIssues.hasWatermark && " • Watermark détecté"}
                        </div>
                      )}
                      {imageIssueList.length > 0 && (
                        <ul className="mt-1.5 ml-5 p-0 text-[11px] text-muted-foreground list-disc">
                          {imageIssueList.map(
                            (issue: string, idx: number) => (
                              <li key={idx} className="mb-0.5">
                                {issue}
                              </li>
                            )
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                  {labelsDetected.length > 0 && (
                    <div className="p-2.5 bg-background border border-border rounded">
                      <span className="text-[13px] font-semibold text-foreground block mb-1.5">
                        🏷️ Labels détectés ({labelsDetected.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {labelsDetected.slice(0, 5).map((label: DetectedLabel, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-muted border border-border rounded text-[11px] text-foreground"
                          >
                            {label.description} (
                            {((label.score ?? 0) * 100).toFixed(0)}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {qualityRecommendations.length > 0 && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded">
                      <span className="text-[13px] font-semibold text-amber-800 block mb-1.5">
                        💡 Recommandations
                      </span>
                      <ul className="mt-1.5 ml-5 p-0 text-[11px] text-amber-900 list-disc">
                        {qualityRecommendations.map(
                          (rec: string, idx: number) => (
                            <li key={idx} className="mb-1">
                              {rec}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Image sans analyse
          if (
            key === "image" &&
            data.filled &&
            quality.sellingScore === undefined
          ) {
            return (
              <div
                key={key}
                className="p-3 bg-green-50 border border-green-200 rounded"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-600 text-base">✓</span>
                  <span className="text-foreground font-medium flex-1">
                    Image
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Présente
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground italic">
                  Analyse d&apos;image en cours ou non disponible
                </div>
              </div>
            );
          }

          // Titre / Description avec métriques
          if (
            (key === "title" || key === "description") &&
            data.length !== undefined
          ) {
            const bgClass = data.filled
              ? qualityScore != null && qualityScore < 70
                ? "bg-amber-50 border-amber-200"
                : "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200";
            const iconColor = data.filled
              ? qualityScore != null && qualityScore < 70
                ? "text-amber-500"
                : "text-green-600"
              : "text-red-500";
            const qualityColor =
              qualityScore != null && qualityScore >= 70
                ? "text-green-600"
                : "text-amber-600";
            return (
              <div
                key={key}
                className={cn("p-3.5 rounded border", bgClass)}
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <span className={cn("text-base", iconColor)}>
                    {data.filled
                      ? qualityScore != null && qualityScore < 70
                        ? "⚠"
                        : "✓"
                      : "✗"}
                  </span>
                  <span className="text-foreground font-medium flex-1">
                    {labels[key] || key}
                  </span>
                  {qualityScore !== null && (
                    <span
                      className={cn("text-xs font-semibold", qualityColor)}
                    >
                      Qualité: {qualityScore}%
                    </span>
                  )}
                  {!data.filled && (
                    <span className="text-red-500 text-xs">Manquant</span>
                  )}
                </div>
                <div
                  className={cn(
                    "flex gap-3 text-[11px] text-muted-foreground p-2 bg-background rounded border border-border",
                    fieldIssues.length ? "mb-2" : ""
                  )}
                >
                  {data.length !== undefined && (
                    <span>📏 Longueur: {data.length} caractères</span>
                  )}
                  {data.wordCount !== undefined && (
                    <span>📝 Mots: {data.wordCount}</span>
                  )}
                  {key === "description" &&
                    data.sentenceCount !== undefined && (
                      <span>💬 Phrases: {data.sentenceCount}</span>
                    )}
                </div>
                {fieldIssues.length > 0 && (
                  <ul className="mt-2 ml-6 p-0 text-xs text-muted-foreground list-disc">
                    {fieldIssues.map((issue: string, idx: number) => (
                      <li key={idx} className="mb-1">
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }

          // Autres champs (prix, etc.)
          const stdBg = data.filled
            ? qualityScore != null && qualityScore < 70
              ? "bg-amber-50 border-amber-200"
              : "bg-green-50 border-green-200"
            : "bg-red-50 border-red-200";
          const stdIcon = data.filled
            ? qualityScore != null && qualityScore < 70
              ? "text-amber-500"
              : "text-green-600"
            : "text-red-500";
          const stdQuality =
            qualityScore != null && qualityScore >= 70
              ? "text-green-600"
              : "text-amber-600";
          return (
            <div key={key} className={cn("p-3 rounded border", stdBg)}>
              <div
                className={cn(
                  "flex items-center gap-2",
                  fieldIssues.length ? "mb-2" : ""
                )}
              >
                <span className={cn("text-base", stdIcon)}>
                  {data.filled
                    ? qualityScore != null && qualityScore < 70
                      ? "⚠"
                      : "✓"
                    : "✗"}
                </span>
                <span className="text-foreground font-medium flex-1">
                  {labels[key] || key}
                </span>
                {qualityScore !== null && (
                  <span
                    className={cn("text-xs font-semibold", stdQuality)}
                  >
                    Qualité: {qualityScore}%
                  </span>
                )}
                {!data.filled && (
                  <span className="text-red-500 text-xs">Manquant</span>
                )}
              </div>
              {fieldIssues.length > 0 && (
                <ul className="mt-2 ml-6 p-0 text-xs text-muted-foreground list-disc">
                  {fieldIssues.map((issue: string, idx: number) => (
                    <li key={idx} className="mb-1">
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
