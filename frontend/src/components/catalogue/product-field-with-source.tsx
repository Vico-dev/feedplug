"use client";

import { ExternalLink, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FieldSource = "flux" | "custom";

export interface ProductFieldWithSourceProps {
  label: string;
  fluxValue: string | number | null | undefined;
  value: string | number | null | undefined;
  onChange: (value: string | number | null) => void;
  source: FieldSource;
  onSourceChange: (source: FieldSource) => void;
  isEditing: boolean;
  type?: "text" | "number" | "textarea";
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** Pour les selects (ex. condition) */
  selectOptions?: Array<{ value: string; label: string }>;
  /** Référence pour scroll depuis qualité */
  fieldRef?: React.RefObject<HTMLDivElement | null>;
  highlighted?: boolean;
  /** Affiche un bouton "Optimiser" à côté du label (ouvre modal titre ou scroll enrichissement) */
  onOptimize?: () => void;
}

function formatDisplayValue(
  v: string | number | null | undefined,
  type: "text" | "number" | "textarea"
): string {
  if (v === null || v === undefined || v === "") return "—";
  if (type === "number") return Number(v).toFixed(2);
  return String(v);
}

export function ProductFieldWithSource({
  label,
  fluxValue,
  value,
  onChange,
  source,
  onSourceChange,
  isEditing,
  type = "text",
  placeholder,
  className,
  inputClassName,
  selectOptions,
  fieldRef,
  highlighted,
  onOptimize,
}: ProductFieldWithSourceProps) {
  const fluxDisplay = formatDisplayValue(fluxValue, type);
  const hasFluxValue = fluxDisplay !== "—";

  if (!isEditing) {
    const displayValue = value !== undefined && value !== null && value !== "" ? value : fluxValue;
    const isFromFeed = hasFluxValue && (displayValue === fluxValue || (value === undefined && fluxValue !== undefined));
    let str = formatDisplayValue(displayValue, type);
    if (selectOptions && str !== "—") {
      const option = selectOptions.find((o) => o.value === String(displayValue));
      if (option) str = option.label;
    }
    return (
      <div
        ref={fieldRef as React.RefObject<HTMLDivElement>}
        className={cn(
          "rounded-md transition-all",
          highlighted && "p-3 bg-amber-50 border-2 border-amber-500"
        )}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className="block text-sm font-medium text-muted-foreground">{label}</label>
          {onOptimize && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-primary hover:text-primary"
              onClick={onOptimize}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Optimiser
            </Button>
          )}
        </div>
        {str !== "—" && (label === "URL produit" || (typeof str === "string" && str.startsWith("http"))) ? (
          <a
            href={String(str)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-foreground no-underline hover:underline"
          >
            Voir le produit <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <p
            className={cn(
              "m-0 text-sm",
              str !== "—" ? "text-foreground" : "text-muted-foreground italic"
            )}
          >
            {str !== "—" ? str : "Non renseigné"}
          </p>
        )}
        {str !== "—" && (
          <p className="m-0 mt-1 text-xs text-muted-foreground">
            {isFromFeed ? "Source : Flux marchand" : "Valeur enrichie par FeedPlug"}
          </p>
        )}
        {!isFromFeed && hasFluxValue && (
          <button
            type="button"
            onClick={() => {
              onSourceChange("flux");
              onChange(type === "number" ? (Number(fluxValue) as number) : (fluxValue as string) ?? null);
            }}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Revenir à la valeur du flux
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={fieldRef as React.RefObject<HTMLDivElement>}
      className={cn(
        "rounded-md transition-all space-y-2",
        highlighted && "p-3 bg-amber-50 border-2 border-amber-500",
        className
      )}
    >
      <label className="block text-sm font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            onSourceChange("flux");
            if (hasFluxValue) {
              onChange(
                type === "number"
                  ? (Number(fluxValue) as number)
                  : (fluxValue as string) ?? ""
              );
            }
          }}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm border transition-colors",
            source === "flux"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-input hover:bg-muted"
          )}
        >
          Valeur du flux
        </button>
        <button
          type="button"
          onClick={() => onSourceChange("custom")}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm border transition-colors",
            source === "custom"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-input hover:bg-muted"
          )}
        >
          Autre valeur
        </button>
      </div>
      {source === "flux" ? (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 border border-border">
          {hasFluxValue ? fluxDisplay : "Aucune valeur dans le flux"}
        </p>
      ) : type === "textarea" ? (
        <textarea
          value={value != null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={5}
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y",
            inputClassName
          )}
        />
      ) : selectOptions ? (
        <select
          value={value != null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            inputClassName
          )}
        >
          <option value="">{placeholder ?? "Non renseigné"}</option>
          {selectOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          type={type}
          step={type === "number" ? "0.01" : undefined}
          value={
            type === "number"
              ? value != null && value !== "" && !Number.isNaN(Number(value))
                ? Number(value)
                : ""
              : value ?? ""
          }
          onChange={(e) =>
            onChange(
              type === "number"
                ? (parseFloat(e.target.value) as number) || null
                : e.target.value || null
            )
          }
          placeholder={placeholder}
          className={inputClassName}
        />
      )}
    </div>
  );
}
