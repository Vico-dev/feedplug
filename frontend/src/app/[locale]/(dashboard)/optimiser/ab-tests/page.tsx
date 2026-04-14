"use client";

import { useState, useEffect } from 'react';
import {
  TestTube,
  Plus,
  Loader2,
  Play,
  XCircle,
  Sparkles,
  TrendingUp,
  Eye,
  Zap,
  Target,
  Trophy,
  ChevronRight,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { API_BASE_URL, authFetch } from '@/lib/api';
import { PageLayout, PageHeader, PageLoading } from '@/components/layout';
import { Button } from '@/components/ui/button';

type ABTestStatus = 'DRAFT' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
type FieldUnderTest = 'title' | 'description' | 'image';

interface ABTest {
  id: string;
  name: string;
  platform: string;
  fieldUnderTest?: string;
  status: ABTestStatus;
  startDate: string | null;
  endDate: string | null;
  minDurationDays: number;
  controlPercent: number;
  variantPercent: number;
  prerequisitesMet: boolean | null;
  assignmentCount?: number;
  controlCount?: number;
  variantCount?: number;
  createdAt: string;
}

const FIELD_LABEL: Record<string, string> = {
  title: 'Titres',
  description: 'Descriptions',
  image: 'Images',
};

const STATUS_CONFIG: Record<ABTestStatus, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Brouillon', color: '#6b7280', bg: '#f3f4f6' },
  RUNNING: { label: 'En cours', color: '#2563eb', bg: '#dbeafe' },
  COMPLETED: { label: 'Terminé', color: '#16a34a', bg: '#dcfce7' },
  CANCELLED: { label: 'Annulé', color: '#dc2626', bg: '#fee2e2' },
};

const PLATFORM_LABEL: Record<string, string> = {
  GMC: 'Google',
  META: 'Meta',
  AMAZON: 'Amazon',
  CHATGPT: 'ChatGPT',
};

const EXAMPLE_TESTS = [
  {
    field: 'title' as FieldUnderTest,
    platform: 'GMC',
    title: 'Titles enrichis avec la marque',
    description: 'Ajoutez la marque au titre pour augmenter le CTR sur Google',
    controlExample: 'Air Max 90 - 124€',
    variantExample: 'Nike Air Max 90 Premium - 124€',
    impact: '+12%',
  },
  {
    field: 'description' as FieldUnderTest,
    platform: 'META',
    title: 'Descriptions adaptées aux réseaux',
    description: 'Des descriptions courtes et engageantes pour Facebook et Instagram',
    controlExample: 'Chaussure de running légère.',
    variantExample: '⚡ Légère (280g) | 💪 Amorti Air Max',
    impact: '+18%',
  },
  {
    field: 'image' as FieldUnderTest,
    platform: 'AMAZON',
    title: 'Photos lifestyle vs produit',
    description: 'Testez l\'impact des visuels sur vos conversions Amazon',
    controlExample: 'Photo produit fond blanc',
    variantExample: 'Modèle en situation réelle',
    impact: '+24%',
  },
];

function formatDate(dateValue: string | null | undefined) {
  if (!dateValue) return '—';
  return new Date(dateValue).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function StatCard({ icon: Icon, value, label, accent }: { icon: typeof Target; value: string | number; label: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accent}15` }}>
          <Icon size={18} style={{ color: accent }} />
        </div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <div className="text-3xl font-semibold" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function TestTypeCard({ example, onClick }: { example: typeof EXAMPLE_TESTS[0]; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-300 hover:shadow-lg transition-all group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100">
          {example.field === 'title' && <Eye size={20} />}
          {example.field === 'description' && <Sparkles size={20} />}
          {example.field === 'image' && <span className="text-xl">🖼️</span>}
        </div>
        <div>
          <div className="text-xs text-slate-500">{PLATFORM_LABEL[example.platform]}</div>
          <div className="font-semibold text-slate-900">{FIELD_LABEL[example.field]}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm font-bold text-green-600">{example.impact}</span>
          <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
        </div>
      </div>
      <p className="text-sm text-slate-600">{example.description}</p>
    </button>
  );
}

export default function ABTestsPage() {
  const t = useTranslations('dashboard');
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTestType, setSelectedTestType] = useState<typeof EXAMPLE_TESTS[0] | null>(null);

  const fetchTests = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/ab-tests`);
      if (res.ok) {
        const data = await res.json();
        setTests(data);
      }
    } catch (e) {
      console.error('Erreur chargement tests:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTests(); }, []);

  const handleStart = async (id: string) => {
    try {
      setStartingId(id);
      const res = await authFetch(`${API_BASE_URL}/ab-tests/${id}/start`, { method: 'POST' });
      if (res.ok) await fetchTests();
      else {
        const err = await res.json();
        alert(err.message || 'Impossible de démarrer');
      }
    } finally {
      setStartingId(null);
    }
  };

  const stats = {
    total: tests.length,
    running: tests.filter(t => t.status === 'RUNNING').length,
    completed: tests.filter(t => t.status === 'COMPLETED').length,
  };

  if (loading) return <PageLoading />;

  return (
    <PageLayout>
      <PageHeader
        title="Tests A/B"
        subtitle="Découvrez ce qui fonctionne le mieux pour vos fiches produits"
      />

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #0f766e 0%, #115e59 100%)",
        borderRadius: "var(--card-radius)",
        padding: 28,
        marginBottom: 24,
        color: "white",
      }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}>
          <div>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.2)",
              fontSize: 13,
              marginBottom: 12,
            }}>
              <Target size={14} />
              Data-driven optimization
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 700 }}>
              Testez, mesurez, améliorez
            </h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, opacity: 0.9, maxWidth: 560 }}>
              Créez des variantes de vos titles, descriptions ou images. 
              FeedPlug divise automatiquement votre trafic et vous montre 
              quelle version génère le plus de performances.
            </p>
            <Button 
              onClick={() => setShowCreateModal(true)} 
              style={{
                marginTop: 20,
                backgroundColor: "white",
                color: "var(--app-accent)",
                fontWeight: 600,
              }}
            >
              <Plus size={16} />
              Nouveau test
            </Button>
          </div>

          {/* Visual Example */}
          <div style={{
            backgroundColor: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)",
            borderRadius: 16,
            padding: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <TrendingUp size={18} style={{ color: "#86efac" }} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>Exemple d&apos;impact</span>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>Contrôle A</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Air Max 90</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>124€</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.4)", fontSize: 18 }}>vs</div>
              <div style={{ flex: 1, backgroundColor: "rgba(52,211,153,0.3)", borderRadius: 12, padding: 16, border: "1px solid rgba(52,211,153,0.5)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#86efac", marginBottom: 6 }}>
                  <Sparkles size={10} />
                  Variante B
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Nike Air Max 90 Premium</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>+23% CTR</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={TestTube} value={stats.total} label="Tests créés" accent="#6366f1" />
        <StatCard icon={Play} value={stats.running} label="En cours" accent="#2563eb" />
        <StatCard icon={Trophy} value={stats.completed} label="Terminés" accent="#16a34a" />
      </div>

      {/* Types de tests */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Types de tests disponibles</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {EXAMPLE_TESTS.map((example, index) => (
            <TestTypeCard
              key={index}
              example={example}
              onClick={() => { setSelectedTestType(example); setShowCreateModal(true); }}
            />
          ))}
        </div>
      </div>

      {/* Vos tests */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Vos tests</h3>
          <Button variant="outline" size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} />
            Nouveau
          </Button>
        </div>

        {tests.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <TestTube size={28} className="text-slate-400" />
            </div>
            <h4 className="text-lg font-semibold text-slate-900 mb-2">Aucun test créé</h4>
            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
              Commencez par sélectionner un type de test ci-dessus.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              Créer mon premier test
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {tests.map((test) => {
              const status = STATUS_CONFIG[test.status];
              return (
                <div key={test.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: status.bg, color: status.color }}>
                            {status.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {FIELD_LABEL[test.fieldUnderTest || 'title']} · {PLATFORM_LABEL[test.platform] || test.platform}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 truncate">{test.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">
                          Split {test.controlPercent}% / {test.variantPercent}%
                          {test.startDate && ` · ${formatDate(test.startDate)}`}
                        </p>
                      </div>
                      {test.status === 'DRAFT' && (
                        <Button size="sm" onClick={() => handleStart(test.id)} disabled={startingId === test.id}>
                          {startingId === test.id ? <Loader2 size={14} className="animate-spin" /> : <><Play size={14} /> Démarrer</>}
                        </Button>
                      )}
                    </div>

                    {test.status === 'RUNNING' && test.assignmentCount !== undefined && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="bg-slate-50 rounded-xl p-3">
                            <div className="text-lg font-semibold text-slate-900">{test.assignmentCount}</div>
                            <div className="text-xs text-slate-500">Total</div>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-3">
                            <div className="text-lg font-semibold text-slate-900">{test.controlCount || 0}</div>
                            <div className="text-xs text-slate-500">Contrôle A</div>
                          </div>
                          <div className="bg-blue-50 rounded-xl p-3">
                            <div className="text-lg font-semibold text-blue-600">{test.variantCount || 0}</div>
                            <div className="text-xs text-blue-600">Variante B</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal création */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Créer un test A/B</h2>
              <p className="text-sm text-slate-500 mt-1">Sélectionnez le type d&apos;optimisation à tester</p>
            </div>
            <div className="p-6">
              <div className="grid gap-4">
                {EXAMPLE_TESTS.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      alert(`Création d&apos;un test: ${example.title}\n\nCe module sera implémenté complètement.`);
                      setShowCreateModal(false);
                    }}
                    className="text-left rounded-2xl border-2 border-slate-200 p-5 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                        {example.field === 'title' && <Eye size={20} className="text-indigo-600" />}
                        {example.field === 'description' && <Sparkles size={20} className="text-indigo-600" />}
                        {example.field === 'image' && <span className="text-xl">🖼️</span>}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{example.title}</div>
                        <div className="text-sm text-slate-500">{example.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">{example.impact}</div>
                        <div className="text-xs text-slate-400">CTR estimé</div>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100">
                      <div className="flex-1">
                        <div className="text-xs text-slate-400 mb-1">Variante A</div>
                        <div className="text-sm font-medium text-slate-700">{example.controlExample}</div>
                      </div>
                      <div className="w-8 flex items-center justify-center text-slate-400">→</div>
                      <div className="flex-1">
                        <div className="text-xs text-indigo-400 mb-1">Variante B</div>
                        <div className="text-sm font-medium text-slate-700">{example.variantExample}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-3xl">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="w-full">
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
