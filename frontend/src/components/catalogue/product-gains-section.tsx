"use client";

import { cn } from "@/lib/utils";

export interface PotentialGain {
  field: string;
  label: string;
  currentScore: number;
  maxScore: number;
  gain: number;
  priority: "high" | "medium" | "low";
  action: string;
}

export function ProductGainsSection({
  potentialGains,
  onScrollToField,
}: {
  potentialGains: PotentialGain[];
  onScrollToField: (field: string) => void;
}) {
  const urgentGains = potentialGains.filter(
    (g) => g.priority === "high" || g.priority === "medium"
  );
  const optionalGains = potentialGains.filter((g) => g.priority === "low");

  if (potentialGains.length === 0) return null;

  return (
    <div
      className={cn(
        "grid gap-5 mb-8",
        urgentGains.length > 0 && optionalGains.length > 0
          ? "lg:grid-cols-2"
          : "grid-cols-1"
      )}
    >
      {urgentGains.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🚨</span>
            <h3 className="text-base font-bold text-foreground m-0">
              Actions prioritaires
            </h3>
            <span className="px-2 py-1 bg-red-600 text-white rounded text-[11px] font-bold uppercase">
              {urgentGains.length}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-4 mt-0">
            Ces actions ont le plus d&apos;impact sur votre score
          </p>
          <div className="grid gap-2.5">
            {urgentGains.map((gain) => {
              const borderClass =
                gain.priority === "high"
                  ? "border-red-300"
                  : "border-amber-300";
              const badgeClass =
                gain.priority === "high"
                  ? "bg-red-200 text-red-700"
                  : "bg-amber-200 text-amber-800";
              return (
                <div
                  key={gain.field}
                  onClick={() => onScrollToField(gain.field)}
                  className={cn(
                    "flex justify-between items-center p-3.5 bg-background border-2 rounded-md cursor-pointer transition-all hover:translate-x-0.5 hover:shadow-md",
                    borderClass
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-bold text-foreground">
                        {gain.action}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          badgeClass
                        )}
                      >
                        {gain.priority === "high" ? "Urgent" : "Important"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {gain.currentScore > 0
                        ? `Score actuel: ${gain.currentScore}%`
                        : "Champ manquant"}{" "}
                      • Gain:{" "}
                      <strong className="text-green-600">+{gain.gain} pts</strong>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-green-600 ml-4">
                    +{gain.gain}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {optionalGains.length > 0 && (
        <div className="bg-muted border-2 border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">💡</span>
            <h3 className="text-base font-bold text-foreground m-0">
              Améliorations optionnelles
            </h3>
            <span className="px-2 py-1 bg-muted-foreground text-background rounded text-[11px] font-bold uppercase">
              {optionalGains.length}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-4 mt-0">
            Ces améliorations peuvent encore augmenter votre score
          </p>
          <div className="grid gap-2.5">
            {optionalGains.map((gain) => (
              <div
                key={gain.field}
                onClick={() => onScrollToField(gain.field)}
                className="flex justify-between items-center p-3.5 bg-background border border-border rounded-md cursor-pointer transition-all hover:translate-x-0.5 hover:shadow"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-foreground">
                      {gain.action}
                    </span>
                    <span className="px-2 py-0.5 bg-muted rounded text-[10px] font-semibold uppercase text-muted-foreground">
                      Optionnel
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Gain potentiel:{" "}
                    <strong className="text-green-600">+{gain.gain} pts</strong>
                  </div>
                </div>
                <div className="text-lg font-bold text-green-600 ml-4">
                  +{gain.gain}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
