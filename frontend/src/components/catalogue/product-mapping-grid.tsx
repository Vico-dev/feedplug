"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getFieldLabel, getAvailableFields } from "@/lib/catalogue-field-labels";
import { cn } from "@/lib/utils";

type FieldSource = "flux" | "custom";

function findValue(obj: Record<string, unknown>, key: string): unknown {
  if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
    return obj[key];
  }
  const lowerKey = key.toLowerCase();
  if (obj[lowerKey] !== undefined && obj[lowerKey] !== null && obj[lowerKey] !== "") {
    return obj[lowerKey];
  }
  const upperKey = key.toUpperCase();
  if (obj[upperKey] !== undefined && obj[upperKey] !== null && obj[upperKey] !== "") {
    return obj[upperKey];
  }
  if (key.includes("_")) {
    const camelCase = key
      .split("_")
      .map((word, i) =>
        i === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join("");
    if (
      obj[camelCase] !== undefined &&
      obj[camelCase] !== null &&
      obj[camelCase] !== ""
    ) {
      return obj[camelCase];
    }
    const PascalCase = key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
    if (
      obj[PascalCase] !== undefined &&
      obj[PascalCase] !== null &&
      obj[PascalCase] !== ""
    ) {
      return obj[PascalCase];
    }
  }
  return null;
}

export interface ProductMappingGridProps {
  item: {
    feed?: {
      mappingJson?: Record<string, string>;
      mappingjson?: Record<string, string>;
    };
    customfields?: Record<string, unknown>;
    customFields?: Record<string, unknown>;
    [key: string]: unknown;
  };
  editedItem: Record<string, unknown>;
  onEditedItemChange: (next: Record<string, unknown>) => void;
  isEditing: boolean;
}

export function ProductMappingGrid({
  item,
  editedItem,
  onEditedItemChange,
  isEditing,
}: ProductMappingGridProps) {
  const t = useTranslations("dashboard");
  const [fieldSources, setFieldSources] = useState<Record<string, FieldSource>>({});
  const getLabel = (fieldKey: string) => {
    const raw = t(`fields.${fieldKey}` as never);
    return raw && !String(raw).startsWith("fields.") && !String(raw).includes("dashboard.") ? raw : getFieldLabel(fieldKey);
  };
  const mapping =
    item.feed?.mappingJson ?? item.feed?.mappingjson ?? {};
  const mappingKeys = Object.keys(mapping);

  if (mappingKeys.length === 0) return null;

  const customFields = item.customfields ?? item.customFields ?? {};

  return (
    <>
      <Card className="mt-8">
        <CardContent className="p-7">
          <div className="flex flex-wrap justify-between gap-4 mb-5">
            <div>
              <p className="m-0 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                {t("mapping.feedMapping")}
              </p>
              <CardTitle className="text-xl font-semibold mt-1.5 mb-1">
                {t("mapping.title")}
              </CardTitle>
              <CardDescription>
                {t("mapping.subtitle")}
              </CardDescription>
            </div>
            <Badge
              variant="secondary"
              className="px-3.5 py-2 text-sm font-semibold"
            >
              {mappingKeys.length} champ{mappingKeys.length > 1 ? "s" : ""}{" "}
              mappé{mappingKeys.length > 1 ? "s" : ""}
            </Badge>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-[18px] w-full box-border">
            {Object.entries(mapping).map(([fieldKey, sourceColumn]) => {
              let fieldValue: unknown = null;
              if (
                typeof customFields === "object" &&
                customFields !== null &&
                Object.keys(customFields).length > 0
              ) {
                fieldValue = findValue(
                  customFields as Record<string, unknown>,
                  fieldKey
                );
              }
              if (!fieldValue) {
                fieldValue = findValue(item as Record<string, unknown>, fieldKey);
              }
              if (!fieldValue && sourceColumn && sourceColumn !== fieldKey) {
                fieldValue = findValue(
                  item as Record<string, unknown>,
                  sourceColumn
                );
              }

              const fieldLabel = getLabel(fieldKey);
              const fluxVal = fieldValue != null && fieldValue !== "" ? String(fieldValue) : null;
              const source: FieldSource =
                fieldSources[fieldKey] ??
                (editedItem[fieldKey] !== undefined && editedItem[fieldKey] !== fieldValue ? "custom" : "flux");

              return (
                <Card
                  key={fieldKey}
                  className="p-3.5 bg-muted flex flex-col gap-2.5 min-h-[130px] overflow-hidden break-words w-full box-border max-w-full"
                >
                  <div className="flex justify-between items-start gap-2.5 min-w-0">
                    <div className="text-sm font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">
                      {fieldLabel}
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-xs uppercase tracking-wider whitespace-nowrap flex-shrink-0"
                    >
                      {fieldKey}
                    </Badge>
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setFieldSources((prev) => ({ ...prev, [fieldKey]: "flux" }));
                            onEditedItemChange({ ...editedItem, [fieldKey]: fluxVal ?? "" });
                          }}
                          className={cn(
                            "px-2 py-1 rounded text-xs border",
                            source === "flux"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-input hover:bg-muted"
                          )}
                        >
                          {t("mapping.fluxValue")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFieldSources((prev) => ({ ...prev, [fieldKey]: "custom" }))}
                          className={cn(
                            "px-2 py-1 rounded text-xs border",
                            source === "custom"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-input hover:bg-muted"
                          )}
                        >
                          {t("mapping.customValue")}
                        </button>
                      </div>
                      {source === "flux" ? (
                        <p className="text-sm text-muted-foreground bg-background/50 rounded px-2 py-1.5 border border-border">
                          {fluxVal ?? t("mapping.noValueInFeed")}
                        </p>
                      ) : (
                        <Input
                          type="text"
                          value={String(editedItem[fieldKey] ?? "")}
                          onChange={(e) =>
                            onEditedItemChange({
                              ...editedItem,
                              [fieldKey]: e.target.value,
                            })
                          }
                          placeholder={`Colonne source: ${sourceColumn}`}
                          className="break-words"
                        />
                      )}
                    </div>
                  ) : (
                    <p
                      className={`m-0 text-[15px] leading-[1.4] ${
                        fieldValue
                          ? "font-medium text-foreground"
                          : "font-normal text-muted-foreground italic"
                      } break-words overflow-hidden max-w-full`}
                    >
                      {fieldValue != null && fieldValue !== ""
                        ? String(fieldValue)
                        : "Non renseigné"}
                    </p>
                  )}
                  <div className="mt-auto text-xs text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap max-w-full">
                    Colonne source :{" "}
                    <Badge
                      variant="secondary"
                      className="font-semibold text-foreground inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap align-middle"
                    >
                      {sourceColumn || "—"}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="p-6">
          <CardTitle className="text-base font-semibold mb-1.5">
            {t("mapping.extraFieldsTitle")}
          </CardTitle>
          <CardDescription className="mb-4">
            {t("mapping.extraFieldsDesc")}
          </CardDescription>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
            {getAvailableFields()
              .filter((field) => !mapping[field.key])
              .map((field) => (
                <Badge
                  key={field.key}
                  variant="outline"
                  className="px-3 py-2.5 text-sm inline-flex items-center justify-center"
                >
                  {getLabel(field.key)}
                </Badge>
              ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
