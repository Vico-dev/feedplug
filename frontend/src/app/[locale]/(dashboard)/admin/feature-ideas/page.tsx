"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Lightbulb, Download } from "lucide-react";
import {
  PageLayout,
  PageHeader,
  PageError,
  PageLoading,
  EmptyState,
  DataTable,
  DataTableHeader,
  DataTableBody,
  DataTableRow,
  DataTableTh,
  DataTableTd,
  PageButtonPrimary,
  PageButtonSecondary,
} from "@/components/layout";

interface FeatureIdea {
  id: string;
  email: string;
  name: string | null;
  idea: string;
  createdAt: string;
}

export default function AdminFeatureIdeasPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [ideas, setIdeas] = useState<FeatureIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 20;

  useEffect(() => {
    if (!authLoading && !user?.isStaff) {
      router.replace("/dashboard");
    }
  }, [authLoading, user?.isStaff, router]);

  const fetchIdeas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get(
        `/marketing/feature-ideas?page=${page}&limit=${limit}`
      );
      const data = response.data as {
        ideas: FeatureIdea[];
        total: number;
        totalPages: number;
      };
      setIdeas(data.ideas || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    } catch (err: unknown) {
      const message = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Erreur lors du chargement";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [limit, page]);

  useEffect(() => {
    if (user?.isStaff) {
      void fetchIdeas();
    }
  }, [fetchIdeas, user?.isStaff]);

  const exportToCSV = () => {
    const headers = ["Email", "Nom", "Idée", "Date"];
    const rows = ideas.map((idea) => [
      idea.email,
      idea.name || "",
      idea.idea.replace(/"/g, '""'),
      new Date(idea.createdAt).toLocaleDateString("fr-FR"),
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `idees_feature_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <PageLayout style={{ maxWidth: 1000 }}>
      <PageHeader
        title="Idées feature (Roadmap)"
        icon={Lightbulb}
        subtitle={
          <>
            Idées soumises par les visiteurs sur la page{" "}
            <a href="https://feedplug.com/docs/roadmap" target="_blank" rel="noopener noreferrer" style={{ color: "#0a0a0a", textDecoration: "underline" }}>
              feedplug.com/docs/roadmap
            </a>
            . Pensez à appliquer la migration <code style={{ fontSize: 12 }}>012_feature_ideas.sql</code> en prod pour les persister en base.
          </>
        }
        actions={
          <PageButtonPrimary onClick={exportToCSV} disabled={ideas.length === 0}>
            <Download size={18} />
            Exporter CSV
          </PageButtonPrimary>
        }
      />

      {error && <PageError message={error} onRetry={fetchIdeas} />}

      {loading ? (
        <PageLoading message="Chargement des idées…" />
      ) : ideas.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Aucune idée pour le moment"
          description="Les idées soumises sur la page roadmap apparaîtront ici."
        />
      ) : (
        <>
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableTh>Email</DataTableTh>
                <DataTableTh>Nom</DataTableTh>
                <DataTableTh>Idée</DataTableTh>
                <DataTableTh>Date</DataTableTh>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {ideas.map((idea) => (
                <DataTableRow key={idea.id}>
                  <DataTableTd>
                    <a href={`mailto:${idea.email}`} style={{ color: "#0a0a0a", textDecoration: "underline" }}>
                      {idea.email}
                    </a>
                  </DataTableTd>
                  <DataTableTd style={{ color: "var(--ink-2)" }}>{idea.name || "—"}</DataTableTd>
                  <DataTableTd style={{ color: "var(--ink-2)", maxWidth: 400 }}>{idea.idea}</DataTableTd>
                  <DataTableTd style={{ color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                    {new Date(idea.createdAt).toLocaleDateString("fr-FR")}
                  </DataTableTd>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24 }}>
              <span style={{ color: "var(--ink-3)", fontSize: 14 }}>
                {total} idée{total !== 1 ? "s" : ""} — page {page} / {totalPages}
              </span>
              <PageButtonSecondary disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Précédent
              </PageButtonSecondary>
              <PageButtonSecondary disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Suivant
              </PageButtonSecondary>
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
