"use client";

import { Suspense } from "react";
import { CatalogueWorkbench } from "@/components/catalogue/catalogue-workbench";
import { PageLoading } from "@/components/layout";

export default function CataloguePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CatalogueWorkbench />
    </Suspense>
  );
}
