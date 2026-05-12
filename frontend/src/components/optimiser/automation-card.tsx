"use client";

import Link from "next/link";
import { Edit2, Eye, ExternalLink, PauseCircle, PlayCircle, TestTube, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Rule } from "@/components/optimiser/types";

interface AutomationCardProps {
  rule: Rule;
  summary: string;
  feedLabel: string;
  channelLabel: string;
  localePrefix: string;
  previewLoading: boolean;
  startingAbTestId: string | null;
  onToggleActive: (rule: Rule) => void;
  onPreview: (rule: Rule) => void;
  onEdit: (rule: Rule) => void;
  onDelete: (rule: Rule) => void;
  onStartAbTest: (rule: Rule) => void;
}

function getActionTone(rule: Rule) {
  if (rule.actionJson?.type === "ai_fill") return "IA";
  if (rule.actionJson?.type === "exclude") return "Exclusion";
  if (rule.actionJson?.type === "calculate") return "Calcul";
  return "Règle";
}

export function AutomationCard({
  rule,
  summary,
  feedLabel,
  channelLabel,
  localePrefix,
  previewLoading,
  startingAbTestId,
  onToggleActive,
  onPreview,
  onEdit,
  onDelete,
  onStartAbTest,
}: AutomationCardProps) {
  const isAbDraft = rule.abTest?.status === "DRAFT";

  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={rule.isActive ? "success" : "outline"}>
                {rule.isActive ? "Active" : "En pause"}
              </Badge>
              <Badge variant="secondary">{getActionTone(rule)}</Badge>
              {rule.runOnIngestion !== false ? <Badge variant="outline">Auto</Badge> : null}
              {rule.abTest ? (
                <Badge variant="outline">
                  A/B {rule.abTest.status === "RUNNING" ? "actif" : "brouillon"}
                </Badge>
              ) : null}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">{rule.name}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{summary}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggleActive(rule)}
            className="text-slate-600 hover:text-slate-900"
          >
            {rule.isActive ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
            {rule.isActive ? "Mettre en pause" : "Réactiver"}
          </Button>
        </div>

        <div className="grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600 md:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Flux</p>
            <p className="mt-1 text-sm font-medium text-slate-700">{feedLabel}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Canal / destination</p>
            <p className="mt-1 text-sm font-medium text-slate-700">{channelLabel}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Priorité</p>
            <p className="mt-1 text-sm font-medium text-slate-700">{rule.priority ?? 0}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onPreview(rule)} disabled={previewLoading}>
            <Eye className="h-4 w-4" />
            {previewLoading ? "Simulation..." : "Prévisualiser"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit(rule)}>
            <Edit2 className="h-4 w-4" />
            Modifier
          </Button>
          {rule.abTest ? (
            <>
              {isAbDraft ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onStartAbTest(rule)}
                  disabled={startingAbTestId !== null}
                >
                  <TestTube className="h-4 w-4" />
                  {startingAbTestId === rule.abTest.id ? "Lancement..." : "Démarrer le test"}
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href={`${localePrefix}/optimiser/ab-tests/${rule.abTest.id}`} prefetch={false}>
                  <ExternalLink className="h-4 w-4" />
                  Voir le test
                </Link>
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(rule)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </div>
    </article>
  );
}
