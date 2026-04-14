"use client";

import { ArrowLeft } from "lucide-react";
import { PageLayout } from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton de la fiche produit : même structure que la page réelle,
 * avec des placeholders animés pour une transition fluide au chargement.
 */
export function ProductDetailSkeleton() {
  return (
    <PageLayout>
      {/* Sticky bar */}
      <div className="sticky top-0 z-10 bg-background border-b border-border -mx-[var(--page-padding-x)] px-[var(--page-padding-x)] py-3 flex items-center justify-between flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au catalogue
        </Button>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>

      {/* Header produit */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_140px] gap-6 items-start">
            <Skeleton className="w-full aspect-square rounded-md max-w-[160px]" />
            <div className="min-w-0 space-y-3">
              <Skeleton className="h-6 w-3/4 max-w-md" />
              <div className="flex flex-wrap gap-3">
                <Skeleton className="h-5 w-20 rounded" />
                <Skeleton className="h-5 w-16 rounded" />
                <Skeleton className="h-4 w-14" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="rounded-lg border-2 border-border bg-muted/50 p-4 text-center w-full max-w-[140px]">
              <Skeleton className="h-3 w-20 mx-auto mb-2" />
              <Skeleton className="h-9 w-12 mx-auto mb-1" />
              <Skeleton className="h-4 w-8 mx-auto" />
              <Skeleton className="h-3 w-24 mx-auto mt-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score par axe */}
      <Card className="mb-6">
        <CardHeader>
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Conformité Google */}
      <Card className="mb-6">
        <CardHeader>
          <Skeleton className="h-5 w-56 mb-1" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Données produit */}
      <Card className="mb-6">
        <CardHeader>
          <Skeleton className="h-5 w-36 mb-1" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
            <Skeleton className="w-full aspect-square rounded-md max-w-[400px]" />
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enrichissement IA */}
      <Card className="mb-6">
        <CardHeader>
          <Skeleton className="h-5 w-48 mb-1" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-64 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
          <Skeleton className="h-10 w-32 mt-4 rounded-md" />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
