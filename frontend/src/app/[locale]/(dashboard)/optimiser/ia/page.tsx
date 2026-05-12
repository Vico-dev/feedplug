"use client";

import { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, CheckCircle, Loader2, TrendingUp, 
  FileText, Image as ImageIcon, ArrowRight, Eye,
  Zap, TestTube, ChevronDown, ChevronUp, BarChart3
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Mode = 'choose' | 'all' | 'ab';
type ABMethod = 'random' | 'segment';
type Step = 'config' | 'processing' | 'done';

interface BatchResult {
  total: number;
  found: number;
  titles?: { succeeded: number; failed: number; cached: number; totalCost: number; results: OptimizationResultItem[] };
  descriptions?: { succeeded: number; failed: number; cached: number; totalCost: number; results: OptimizationResultItem[] };
  images?: unknown;
  totalCost: number;
  saved?: { titles: number; descriptions: number };
}

interface OptimizationResultItem {
  success?: boolean;
  cached?: boolean;
  cost?: number;
  productId: string;
  originalTitle?: string;
  optimizedTitle?: string;
  originalDescription?: string;
  optimizedDescription?: string;
}

interface FeedSummary {
  id: string;
}

interface FeedItemsResponse {
  items?: Array<{ id: string }>;
}

interface ScoresResponse {
  scores?: Record<string, { global: number }>;
}

interface SegmentFilters {
  brands?: string[];
  categories?: string[];
  priceRange?: { min?: number; max?: number };
  enrichmentFilter?: string;
}

interface FilterItemsResponse {
  total?: number;
  itemIds?: string[];
}

interface BatchApiResponse {
  found?: number;
  totalCost?: number;
  saved?: { titles?: number; descriptions?: number };
  titles?: { results?: OptimizationResultItem[] };
  descriptions?: { results?: OptimizationResultItem[] };
}

interface CreateAbTestResponse {
  id: string;
  variantItemIds?: string[];
}

interface Segments {
  brands: { brand: string; count: number }[];
  categories: { category: string; count: number }[];
  priceRanges: Record<string, number>;
  stock: { inStock: number; outOfStock: number };
  enrichment: { hasOptTitle: number; noOptTitle: number; hasOptDesc: number; noOptDesc: number; total: number };
  total: number;
}

import { API_BASE_URL, authFetch } from '@/lib/api';
import {
  DashboardSection,
  DashboardStatCard,
  DashboardStatGrid,
  DashboardToolbar,
  PageButtonPrimary,
  PageButtonSecondary,
  PageLayout,
  PageHeader,
  PageCard
} from '@/components/layout';
const API_URL = API_BASE_URL;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export default function IAOptimizationPage() {
  const [mode, setMode] = useState<Mode>('choose');
  const [step, setStep] = useState<Step>('config');
  const [totalProducts, setTotalProducts] = useState(0);
  const [allItemIds, setAllItemIds] = useState<string[]>([]);
  const [avgScore, setAvgScore] = useState(0);
  const [loading, setLoading] = useState(true);

  const [optimizations, setOptimizations] = useState({ titles: true, descriptions: true, images: false });
  const [selectedPlatform, setSelectedPlatform] = useState<string>('GMC');
  const [allPlatforms, setAllPlatforms] = useState(false);
  const [abMethod, setAbMethod] = useState<ABMethod>('random');
  const [abPercent, setAbPercent] = useState(20);
  const [segments, setSegments] = useState<Segments | null>(null);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('');
  const [enrichmentFilter, setEnrichmentFilter] = useState<string>('');
  const [segmentCount, setSegmentCount] = useState(0);
  const [segmentItemIds, setSegmentItemIds] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [result, setResult] = useState<BatchResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const feedsRes = await authFetch(`${API_URL}/ingestion/feeds`);
      if (!feedsRes.ok) return;
      const feeds = await feedsRes.json() as FeedSummary[];
      if (!feeds || feeds.length === 0) return;
      let allIds: string[] = [];
      for (const feed of feeds) {
        const itemsRes = await authFetch(`${API_URL}/ingestion/feeds/${feed.id}/items?limit=5000`);
        if (itemsRes.ok) {
          const data = await itemsRes.json() as FeedItemsResponse;
          const ids = (data.items || []).map((item) => item.id);
          allIds = [...allIds, ...ids];
        }
      }
      setAllItemIds(allIds);
      setTotalProducts(allIds.length);
      if (allIds.length > 0) {
        const sample = allIds.slice(0, Math.min(20, allIds.length));
        try {
          const scoresRes = await authFetch(`${API_URL}/enrichment/scores`, { method: 'POST', body: JSON.stringify({ itemIds: sample }) });
          if (scoresRes.ok) {
            const scoresData = await scoresRes.json() as ScoresResponse;
            const scores = Object.values(scoresData.scores || {});
            if (scores.length > 0) {
              setAvgScore(
                Math.round(scores.reduce((sum, score) => sum + score.global, 0) / scores.length)
              );
            }
          }
        } catch {}
      }
    } catch (err) { console.error('Erreur chargement:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const fetchSegments = useCallback(async () => {
    if (segments) return;
    setLoadingSegments(true);
    try {
      const res = await authFetch(`${API_URL}/enrichment/segments`);
      if (res.ok) setSegments(await res.json());
    } catch (err) { console.warn('Erreur segments:', err); }
    finally { setLoadingSegments(false); }
  }, [segments]);

  const fetchFilteredItems = useCallback(async () => {
    try {
      const filters: SegmentFilters = {};
      if (selectedBrands.size > 0) filters.brands = Array.from(selectedBrands);
      if (selectedCategories.size > 0) filters.categories = Array.from(selectedCategories);
      if (selectedPriceRange) {
        const ranges: Record<string, {min?: number; max?: number}> = { 'under10': { max: 10 }, '10to30': { min: 10, max: 30 }, '30to50': { min: 30, max: 50 }, '50to100': { min: 50, max: 100 }, 'over100': { min: 100 } };
        filters.priceRange = ranges[selectedPriceRange];
      }
      if (enrichmentFilter) filters.enrichmentFilter = enrichmentFilter;
      if (Object.keys(filters).length === 0) { setSegmentCount(0); setSegmentItemIds([]); return; }
      const res = await authFetch(`${API_URL}/enrichment/filter-items`, { method: 'POST', body: JSON.stringify(filters) });
      if (res.ok) {
        const data = await res.json() as FilterItemsResponse;
        setSegmentCount(data.total || 0);
        setSegmentItemIds(data.itemIds || []);
      }
    } catch (err) { console.warn('Erreur filtrage:', err); }
  }, [selectedBrands, selectedCategories, selectedPriceRange, enrichmentFilter]);

  useEffect(() => { if (abMethod === 'segment') { const t = setTimeout(fetchFilteredItems, 300); return () => clearTimeout(t); } }, [abMethod, fetchFilteredItems]);

  const handleOptimize = async (targetIds: string[]) => {
    if (targetIds.length === 0) return;
    setStep('processing');
    setProgress(0);
    setResult(null);
    try {
      const batchSize = 50;
      const batches: string[][] = [];
      for (let i = 0; i < targetIds.length; i += batchSize) batches.push(targetIds.slice(i, i + batchSize));
      const combined: BatchResult = { total: targetIds.length, found: 0, totalCost: 0, saved: { titles: 0, descriptions: 0 } };
      let titleResults: OptimizationResultItem[] = [];
      let descResults: OptimizationResultItem[] = [];
      for (let i = 0; i < batches.length; i++) {
        setProgressLabel(`Lot ${i + 1}/${batches.length} (${batches[i].length} produits)`);
        setProgress(Math.round(((i) / batches.length) * 90));
        const body: {
          itemIds: string[];
          optimizations: typeof optimizations;
          platforms?: string[];
          platform?: string;
        } = { itemIds: batches[i], optimizations };
        if (allPlatforms) {
          body.platforms = ['gmc', 'meta', 'amazon', 'chatgpt'];
        } else {
          body.platform = selectedPlatform;
        }
        const res = await authFetch(`${API_URL}/enrichment/batch`, { method: 'POST', body: JSON.stringify(body) });
        if (res.ok) {
          const data = await res.json() as BatchApiResponse;
          combined.found += data.found || 0;
          combined.totalCost += data.totalCost || 0;
          if (data.saved) { combined.saved!.titles += data.saved.titles || 0; combined.saved!.descriptions += data.saved.descriptions || 0; }
          if (data.titles) titleResults = [...titleResults, ...(data.titles.results || [])];
          if (data.descriptions) descResults = [...descResults, ...(data.descriptions.results || [])];
        }
      }
      if (titleResults.length > 0) combined.titles = { succeeded: titleResults.filter(r => r.success).length, failed: titleResults.filter(r => !r.success).length, cached: titleResults.filter(r => r.cached).length, totalCost: titleResults.reduce((s, r) => s + (r.cost || 0), 0), results: titleResults };
      if (descResults.length > 0) combined.descriptions = { succeeded: descResults.filter(r => r.success).length, failed: descResults.filter(r => !r.success).length, cached: descResults.filter(r => r.cached).length, totalCost: descResults.reduce((s, r) => s + (r.cost || 0), 0), results: descResults };
      setResult(combined);
      setProgress(100);
      setProgressLabel('Terminé');
      setStep('done');
    } catch (err: unknown) {
      alert('Erreur: ' + getErrorMessage(err, 'Erreur inconnue'));
      setStep('config');
    }
  };

  const handleOptimizeAll = () => handleOptimize(allItemIds);

  const handleOptimizeAB = async () => {
    const targetIds = abMethod === 'segment' && segmentItemIds.length > 0
      ? segmentItemIds
      : (() => { const count = Math.max(1, Math.round(allItemIds.length * abPercent / 100)); const shuffled = [...allItemIds].sort(() => Math.random() - 0.5); return shuffled.slice(0, count); })();
    if (targetIds.length === 0) return;
    setStep('processing');
    setProgressLabel('Création du test A/B (témoin + variant)...');
    setProgress(10);
    try {
      const platformNorm = allPlatforms ? 'GMC' : selectedPlatform;
      const controlPercent = 50;
      const variantPercent = 50;
      const name = `Test titres ${platformNorm} ${new Date().toLocaleDateString('fr-FR')}`;
      const createRes = await authFetch(`${API_URL}/ab-tests`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          platform: platformNorm,
          itemIds: targetIds,
          controlPercent,
          variantPercent,
          variantTitles: {}
        })
      });
      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.message || 'Création du test impossible');
      }
      const created = await createRes.json() as CreateAbTestResponse;
      const variantItemIds = created.variantItemIds || [];
      setProgress(20);
      setProgressLabel(`Génération des titres optimisés pour ${variantItemIds.length} produits (variant)...`);
      const variantTitles: Record<string, string> = {};
      if (variantItemIds.length > 0 && optimizations.titles) {
        const batchSize = 50;
        for (let i = 0; i < variantItemIds.length; i += batchSize) {
          setProgress(20 + Math.round((i / variantItemIds.length) * 70));
          const batch = variantItemIds.slice(i, i + batchSize);
          const body = { itemIds: batch, optimizations: { titles: true, descriptions: false, images: false }, platform: platformNorm };
          const batchRes = await authFetch(`${API_URL}/enrichment/batch`, { method: 'POST', body: JSON.stringify(body) });
          if (batchRes.ok) {
            const data = await batchRes.json() as BatchApiResponse;
            const results = data.titles?.results || [];
            for (const r of results) {
              if (r.success && r.optimizedTitle && r.productId) variantTitles[r.productId] = r.optimizedTitle;
            }
          }
        }
      }
      setProgress(92);
      setProgressLabel('Enregistrement des titres variant...');
      const patchRes = await authFetch(`${API_URL}/ab-tests/${created.id}/variant-values`, {
        method: 'PATCH',
        body: JSON.stringify({ variantTitles })
      });
      if (!patchRes.ok) console.warn('Patch variant values failed');
      setProgress(100);
      setProgressLabel('Test A/B créé en brouillon.');
      window.location.href = `/optimiser/ab-tests?created=${created.id}`;
    } catch (err: unknown) {
      alert('Erreur: ' + getErrorMessage(err, 'Erreur inconnue'));
      setStep('config');
    }
  };

  const getPreviewItems = () => {
    if (!result) return [];
    const map = new Map<string, OptimizationResultItem>();
    for (const r of (result.titles?.results || [])) { if (r.success) map.set(r.productId, { ...r }); }
    for (const r of (result.descriptions?.results || [])) {
      if (r.success) { const existing = map.get(r.productId); if (existing) { existing.originalDescription = r.originalDescription; existing.optimizedDescription = r.optimizedDescription; } else map.set(r.productId, { ...r }); }
    }
    return Array.from(map.values()).slice(0, 10);
  };

  const estimateCost = (count: number) => {
    let cost = 0;
    if (optimizations.titles) cost += count * 0.00005;
    if (optimizations.descriptions) cost += count * 0.00015;
    return (cost * 0.2).toFixed(4);
  };

  function renderOptCard(key: keyof typeof optimizations, label: string, desc: string, Icon: LucideIcon) {
    const isSelected = optimizations[key as keyof typeof optimizations];
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--line)'}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: isSelected ? 'var(--accent-bg)' : 'white' }}>
        <input type="checkbox" checked={isSelected} onChange={(e) => setOptimizations({ ...optimizations, [key]: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent)' }} />
        <Icon style={{ width: '20px', height: '20px', color: isSelected ? 'var(--accent)' : 'var(--ink-4)' }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--ink)', margin: 0 }}>{label}</p>
          <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: 0 }}>{desc}</p>
        </div>
      </label>
    );
  }

  return (
    <PageLayout style={{ maxWidth: '900px' }}>
      <PageHeader title="Enrichissement IA" icon={Sparkles} subtitle={loading ? <span style={{ color: 'var(--ink-4)' }}>Chargement du catalogue…</span> : <span><strong>{totalProducts}</strong> produits — Score moyen : <strong style={{ color: avgScore >= 60 ? 'var(--success)' : 'var(--danger)' }}>{avgScore}/100</strong></span>} />

      {!loading && step === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
          <DashboardStatGrid>
            <DashboardStatCard icon={<Sparkles size={20} />} label="Catalogue eligible" value={totalProducts} hint="Produits disponibles pour optimisation IA" accent="var(--accent)" />
            <DashboardStatCard icon={<BarChart3 size={20} />} label="Score moyen" value={`${avgScore}/100`} hint={avgScore >= 60 ? 'Base catalogue deja saine' : 'Potentiel d amelioration eleve'} accent={avgScore >= 60 ? 'var(--success)' : 'var(--danger)'} />
            <DashboardStatCard icon={<TestTube size={20} />} label="Mode disponible" value="Tout ou A/B" hint="Optimisation complete ou validation par echantillon" accent="var(--accent)" />
          </DashboardStatGrid>

          <DashboardSection title="Comment avancer" description="Choisissez entre une optimisation globale ou un test A/B. Les contenus sont ensuite enrichis canal par canal avec estimation de cout avant lancement.">
            <DashboardToolbar>
              <span style={{ fontSize: '14px', color: 'var(--app-text-muted)', flex: '1 1 320px' }}>
                Commencez par un test A/B si vous voulez mesurer l impact avant de generaliser a tout le catalogue.
              </span>
              {mode !== 'choose' && (
                <PageButtonSecondary onClick={() => { setMode('choose'); setStep('config'); }}>
                  Retour au choix
                </PageButtonSecondary>
              )}
            </DashboardToolbar>
          </DashboardSection>
        </div>
      )}

      {step === 'config' && mode === 'choose' && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: 'var(--section-gap)' }}>
          <PageCard style={{ borderWidth: 2, padding: 32, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s ease' }} onClick={() => setMode('all')} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(14,165,233,0.15)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Zap style={{ width: '32px', height: '32px', color: 'var(--accent)' }} /></div>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 8px' }}>Optimiser tout</h2>
            <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: '0 0 16px', lineHeight: '1.5' }}>Appliquer l&apos;IA sur les <strong>{totalProducts}</strong> produits du catalogue en un clic</p>
            <span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: '500' }}>Recommandé pour un premier lancement</span>
          </PageCard>
          <PageCard style={{ borderWidth: 2, padding: 32, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s ease' }} onClick={() => setMode('ab')} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(42,111,232,0.15)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><TestTube style={{ width: '32px', height: '32px', color: 'var(--accent)' }} /></div>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 8px' }}>Test A/B</h2>
            <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: '0 0 16px', lineHeight: '1.5' }}>Optimiser un échantillon pour comparer les performances avant/après</p>
            <span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: '500' }}>Idéal pour valider l&apos;impact</span>
          </PageCard>
        </div>
      )}

      {step === 'config' && mode === 'all' && (
        <PageCard style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Zap style={{ width: '24px', height: '24px', color: 'var(--accent)' }} /><h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>Optimiser tout le catalogue</h2></div>
            <button onClick={() => setMode('choose')} style={{ fontSize: '13px', color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retour</button>
          </div>
          <div style={{ padding: '32px' }}>
            <p style={{ fontSize: '14px', color: 'var(--ink-3)', marginBottom: '16px' }}>Que souhaitez-vous optimiser ?</p>
            <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>{renderOptCard('titles', 'Titres produits', 'Marque + type + attributs clés, optimisé SEO', FileText)}{renderOptCard('descriptions', 'Descriptions produits', 'Bullet points + paragraphe, adapté par industrie', TrendingUp)}{renderOptCard('images', 'Images produits', 'Compression WebP, resize multi-tailles', ImageIcon)}</div>
            <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ink-2)', marginBottom: '8px' }}>Plateforme cible (titre/description différente par canal) :</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={allPlatforms} onChange={(e) => setAllPlatforms(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} />
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Optimiser pour tous les canaux (Google + Meta + Amazon + ChatGPT)</span>
              </label>
              {!allPlatforms && (
                <select value={selectedPlatform} onChange={(e) => setSelectedPlatform(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line-strong)', fontSize: '14px', maxWidth: '280px' }}>
                  <option value="GMC">Google Merchant Center</option>
                  <option value="META">Meta (Facebook/Instagram)</option>
                  <option value="AMAZON">Amazon</option>
                  <option value="CHATGPT">ChatGPT / LLM</option>
                </select>
              )}
            </div>
            <div style={{ backgroundColor: 'var(--paper-2)', borderRadius: '8px', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div><p style={{ fontSize: '14px', color: 'var(--ink-2)', margin: '0 0 4px' }}><strong>{totalProducts}</strong> produits seront optimisés</p><p style={{ fontSize: '13px', color: 'var(--ink-3)', margin: 0 }}>Coût estimé : <strong>{estimateCost(totalProducts)}€</strong> (cache ~80%)</p></div>
              <PageButtonPrimary onClick={handleOptimizeAll} disabled={totalProducts === 0} style={{ padding: '0 24px' }}><Zap style={{ width: '18px', height: '18px' }} />Lancer sur {totalProducts} produits</PageButtonPrimary>
            </div>
          </div>
        </PageCard>
      )}

      {step === 'config' && mode === 'ab' && (
        <PageCard style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><TestTube style={{ width: '24px', height: '24px', color: 'var(--accent)' }} /><h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>Test A/B</h2></div>
            <button onClick={() => setMode('choose')} style={{ fontSize: '13px', color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retour</button>
          </div>
          <div style={{ padding: '32px' }}>
            <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--ink-2)', marginBottom: '12px' }}>Comment sélectionner les produits ?</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px' }}>
              <button onClick={() => setAbMethod('random')} style={{ padding: '16px', border: `2px solid ${abMethod === 'random' ? 'var(--accent)' : 'var(--line)'}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'left', backgroundColor: abMethod === 'random' ? 'var(--accent-bg)' : 'white' }}><p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 4px' }}>Échantillon aléatoire</p><p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: 0 }}>X% du catalogue, sélection aléatoire</p></button>
              <button onClick={() => { setAbMethod('segment'); fetchSegments(); }} style={{ padding: '16px', border: `2px solid ${abMethod === 'segment' ? 'var(--accent)' : 'var(--line)'}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'left', backgroundColor: abMethod === 'segment' ? 'var(--accent-bg)' : 'white' }}><p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 4px' }}>Par segment</p><p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: 0 }}>Marque, catégorie, prix, enrichissement</p></button>
            </div>
            {abMethod === 'random' && (<><p style={{ fontSize: '14px', color: 'var(--ink-3)', marginBottom: '12px' }}>Pourcentage du catalogue :</p><div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>{[10, 20, 30, 50].map(pct => (<button key={pct} onClick={() => setAbPercent(pct)} style={{ flex: 1, padding: '14px', border: `2px solid ${abPercent === pct ? 'var(--accent)' : 'var(--line)'}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'center', backgroundColor: abPercent === pct ? 'var(--accent-bg)' : 'white' }}><p style={{ fontSize: '22px', fontWeight: '600', color: abPercent === pct ? 'var(--accent)' : 'var(--ink)', margin: '0 0 2px' }}>{pct}%</p><p style={{ fontSize: '11px', color: 'var(--ink-3)', margin: 0 }}>{Math.round(totalProducts * pct / 100)} produits</p></button>))}</div></>)}
            {abMethod === 'segment' && (loadingSegments ? <div style={{ textAlign: 'center', padding: '24px', color: 'var(--ink-3)' }}><Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />Chargement...</div> : segments && (
              <div style={{ display: 'grid', gap: '20px', marginBottom: '24px' }}>
                <div><p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink-2)', marginBottom: '8px' }}>Marques {selectedBrands.size > 0 && <span style={{ color: 'var(--accent)' }}>({selectedBrands.size})</span>}</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{segments.brands.slice(0, 15).map(b => { const sel = selectedBrands.has(b.brand); return <button key={b.brand} onClick={() => { const next = new Set(selectedBrands); if (sel) { next.delete(b.brand); } else { next.add(b.brand); } setSelectedBrands(next); }} style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', border: `1px solid ${sel ? 'var(--accent)' : 'var(--line-strong)'}`, backgroundColor: sel ? 'var(--accent-bg)' : 'white', color: sel ? 'var(--accent-2)' : 'var(--ink-2)', fontWeight: sel ? '600' : '400' }}>{b.brand} <span style={{ color: 'var(--ink-4)', fontSize: '11px' }}>({b.count})</span></button>; })}</div></div>
                <div><p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink-2)', marginBottom: '8px' }}>Catégories</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{segments.categories.slice(0, 12).map(c => { const label = c.category.includes('>') ? c.category.split('>').pop()?.trim() || c.category : c.category; const sel = selectedCategories.has(c.category); return <button key={c.category} onClick={() => { const next = new Set(selectedCategories); if (sel) { next.delete(c.category); } else { next.add(c.category); } setSelectedCategories(next); }} style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', border: `1px solid ${sel ? 'var(--accent)' : 'var(--line-strong)'}`, backgroundColor: sel ? 'var(--accent-bg)' : 'white', color: sel ? 'var(--accent-2)' : 'var(--ink-2)', fontWeight: sel ? '600' : '400' }}>{label} ({c.count})</button>; })}</div></div>
                <div><p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink-2)', marginBottom: '8px' }}>Tranche de prix</p><div style={{ display: 'flex', gap: '8px' }}>{[{ key: '', label: 'Tous', count: totalProducts }, { key: 'under10', label: '< 10€', count: segments.priceRanges.under10 || 0 }, { key: '10to30', label: '10-30€', count: segments.priceRanges['10to30'] || 0 }, { key: '30to50', label: '30-50€', count: segments.priceRanges['30to50'] || 0 }, { key: '50to100', label: '50-100€', count: segments.priceRanges['50to100'] || 0 }, { key: 'over100', label: '> 100€', count: segments.priceRanges.over100 || 0 }].map(r => <button key={r.key} onClick={() => setSelectedPriceRange(r.key)} style={{ flex: 1, padding: '8px 4px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', border: `2px solid ${selectedPriceRange === r.key ? 'var(--accent)' : 'var(--line)'}`, backgroundColor: selectedPriceRange === r.key ? 'var(--accent-bg)' : 'white', color: selectedPriceRange === r.key ? 'var(--accent-2)' : 'var(--ink-2)', textAlign: 'center' }}><p style={{ fontWeight: '600', margin: '0 0 2px' }}>{r.label}</p><p style={{ fontSize: '10px', color: 'var(--ink-4)', margin: 0 }}>{r.count}</p></button>)}</div></div>
                <div><p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ink-2)', marginBottom: '8px' }}>Statut enrichissement</p><div style={{ display: 'flex', gap: '8px' }}>{[{ key: '', label: 'Tous', count: segments.enrichment.total }, { key: 'not_optimized', label: 'Pas encore optimisés', count: segments.enrichment.noOptTitle }, { key: 'already_optimized', label: 'Déjà optimisés', count: segments.enrichment.hasOptTitle }].map(f => <button key={f.key} onClick={() => setEnrichmentFilter(f.key)} style={{ flex: 1, padding: '10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', border: `2px solid ${enrichmentFilter === f.key ? 'var(--accent)' : 'var(--line)'}`, backgroundColor: enrichmentFilter === f.key ? 'var(--accent-bg)' : 'white', color: enrichmentFilter === f.key ? 'var(--accent-2)' : 'var(--ink-2)', textAlign: 'center' }}><p style={{ fontWeight: '500', margin: '0 0 2px' }}>{f.label}</p><p style={{ fontSize: '10px', color: 'var(--ink-4)', margin: 0 }}>{f.count} produits</p></button>)}</div></div>
                {(selectedBrands.size > 0 || selectedCategories.size > 0 || selectedPriceRange || enrichmentFilter) && <div style={{ backgroundColor: 'var(--accent-bg)', borderRadius: '8px', padding: '14px 16px', border: '1px solid var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><p style={{ fontSize: '14px', color: 'var(--accent-2)', margin: 0 }}><strong>{segmentCount}</strong> produits correspondent</p><button onClick={() => { setSelectedBrands(new Set()); setSelectedCategories(new Set()); setSelectedPriceRange(''); setEnrichmentFilter(''); }} style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Réinitialiser</button></div>}
              </div>
            ))}
            <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--ink-2)', marginBottom: '12px', marginTop: '8px' }}>Optimisations :</p>
            <div style={{ display: 'grid', gap: '12px', marginBottom: '12px' }}>{renderOptCard('titles', 'Titres produits', 'Marque + type + attributs clés', FileText)}{renderOptCard('descriptions', 'Descriptions produits', 'Bullet points + paragraphe', TrendingUp)}{renderOptCard('images', 'Images produits', 'Compression WebP, resize', ImageIcon)}</div>
            <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ink-2)', marginBottom: '8px' }}>Plateforme cible :</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={allPlatforms} onChange={(e) => setAllPlatforms(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} />
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Tous les canaux (Google + Meta + Amazon + ChatGPT)</span>
              </label>
              {!allPlatforms && (
                <select value={selectedPlatform} onChange={(e) => setSelectedPlatform(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line-strong)', fontSize: '14px', maxWidth: '280px' }}>
                  <option value="GMC">Google Merchant Center</option>
                  <option value="META">Meta (Facebook/Instagram)</option>
                  <option value="AMAZON">Amazon</option>
                  <option value="CHATGPT">ChatGPT / LLM</option>
                </select>
              )}
            </div>
            <div style={{ backgroundColor: 'var(--accent-bg)', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', border: '1px solid var(--accent-bg)' }}>
              <p style={{ fontSize: '13px', color: 'var(--accent-2)', margin: 0 }}><strong>Test statistiquement cohérent :</strong> 50% des produits gardent le titre d’origine (témoin), 50% reçoivent le titre optimisé (variant). Durée minimale recommandée : 14 jours. Au moins 100 produits par bras pour des résultats significatifs.</p>
            </div>
            <div style={{ backgroundColor: 'var(--paper-2)', borderRadius: '8px', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div><p style={{ fontSize: '14px', color: 'var(--ink-2)', margin: '0 0 4px' }}><strong>{abMethod === 'random' ? Math.round(totalProducts * abPercent / 100) : segmentCount}</strong> produits {abMethod === 'random' ? `(${abPercent}%)` : '(segment)'} → répartis en témoin / variant</p><p style={{ fontSize: '13px', color: 'var(--ink-3)', margin: 0 }}>Coût estimé (IA pour le bras variant uniquement) : <strong>{estimateCost(Math.ceil((abMethod === 'random' ? Math.round(totalProducts * abPercent / 100) : segmentCount) / 2))}€</strong></p></div>
              <PageButtonPrimary onClick={handleOptimizeAB} disabled={abMethod === 'segment' ? segmentCount === 0 : totalProducts === 0} style={{ padding: '0 24px', backgroundColor: (abMethod === 'segment' ? segmentCount > 0 : totalProducts > 0) ? 'var(--accent)' : 'var(--line-strong)' }}><TestTube style={{ width: '18px', height: '18px' }} />Créer le test A/B</PageButtonPrimary>
            </div>
          </div>
        </PageCard>
      )}

      {step === 'processing' && (
        <PageCard style={{ padding: '48px 32px', textAlign: 'center' }}>
          <Loader2 style={{ width: '48px', height: '48px', color: 'var(--accent)', margin: '0 auto 24px', animation: 'spin 1s linear infinite' }} />
          <h2 style={{ fontSize: '22px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 8px' }}>Optimisation en cours...</h2>
          <p style={{ fontSize: '14px', color: 'var(--ink-3)', margin: '0 0 32px' }}>{progressLabel}</p>
          <div style={{ maxWidth: '400px', margin: '0 auto' }}><div style={{ width: '100%', height: '10px', backgroundColor: 'var(--line)', borderRadius: '5px', overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'var(--accent)', transition: 'width 0.5s ease', borderRadius: '5px' }} /></div><p style={{ fontSize: '13px', color: 'var(--ink-4)', marginTop: '8px' }}>{progress}%</p></div>
        </PageCard>
      )}

      {step === 'done' && result && (
        <div>
          <div style={{ border: '2px solid #BBF7D0', borderRadius: '12px', padding: '32px', backgroundColor: 'var(--success-bg)', textAlign: 'center', marginBottom: '24px' }}>
            <CheckCircle style={{ width: '48px', height: '48px', color: 'var(--success)', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--success)', margin: '0 0 8px' }}>{mode === 'ab' ? 'Test A/B terminé' : 'Catalogue optimisé'}</h2>
            <p style={{ fontSize: '16px', color: 'var(--success)', margin: '0 0 24px' }}>{result.saved?.titles || 0} titres et {result.saved?.descriptions || 0} descriptions sauvegardés</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '32px' }}><div><p style={{ fontSize: '32px', fontWeight: '700', color: 'var(--ink)', margin: 0 }}>{result.found}</p><p style={{ fontSize: '12px', color: 'var(--ink-3)' }}>produits traités</p></div>{result.titles && <div><p style={{ fontSize: '32px', fontWeight: '700', color: 'var(--success)', margin: 0 }}>{result.titles.succeeded}</p><p style={{ fontSize: '12px', color: 'var(--ink-3)' }}>titres optimisés</p></div>}{result.descriptions && <div><p style={{ fontSize: '32px', fontWeight: '700', color: 'var(--success)', margin: 0 }}>{result.descriptions.succeeded}</p><p style={{ fontSize: '12px', color: 'var(--ink-3)' }}>descriptions enrichies</p></div>}<div><p style={{ fontSize: '32px', fontWeight: '700', color: 'var(--accent)', margin: 0 }}>${result.totalCost?.toFixed(4)}</p><p style={{ fontSize: '12px', color: 'var(--ink-3)' }}>coût total</p></div></div>
          </div>
          {getPreviewItems().length > 0 && (
            <div style={{ border: '1px solid var(--line)', borderRadius: '12px', backgroundColor: 'white', overflow: 'hidden', marginBottom: '24px' }}>
              <div onClick={() => setPreviewOpen(!previewOpen)} style={{ padding: '16px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Eye style={{ width: '20px', height: '20px', color: 'var(--accent)' }} /><h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>Avant / Après ({getPreviewItems().length} produits)</h3></div>{previewOpen ? <ChevronUp style={{ width: '20px', height: '20px', color: 'var(--ink-4)' }} /> : <ChevronDown style={{ width: '20px', height: '20px', color: 'var(--ink-4)' }} />}</div>
              {previewOpen && <div style={{ borderTop: '1px solid var(--paper-2)', padding: '24px', maxHeight: '600px', overflowY: 'auto' }}>{getPreviewItems().map((item, idx) => (<div key={item.productId} style={{ marginBottom: idx < getPreviewItems().length - 1 ? '24px' : 0, paddingBottom: '24px', borderBottom: idx < getPreviewItems().length - 1 ? '1px solid var(--paper-2)' : 'none' }}><p style={{ fontSize: '12px', color: 'var(--ink-4)', marginBottom: '8px' }}>Produit {item.productId.substring(0, 8)}...{item.cached && <span style={{ marginLeft: '8px', fontSize: '10px', backgroundColor: 'var(--accent-bg)', color: 'var(--accent-2)', padding: '1px 6px', borderRadius: '4px' }}>Cache</span>}</p>{item.optimizedTitle && <div style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr', gap: '8px', alignItems: 'center', marginBottom: '8px' }}><div style={{ padding: '10px 12px', backgroundColor: 'var(--danger-bg)', borderRadius: '6px', borderLeft: '3px solid #fca5a5' }}><p style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: '600', marginBottom: '4px' }}>TITRE ORIGINAL</p><p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: 0 }}>{item.originalTitle || '(vide)'}</p></div><ArrowRight style={{ width: '16px', height: '16px', color: 'var(--line-strong)' }} /><div style={{ padding: '10px 12px', backgroundColor: 'var(--success-bg)', borderRadius: '6px', borderLeft: '3px solid #BBF7D0' }}><p style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '600', marginBottom: '4px' }}>TITRE OPTIMISÉ</p><p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: 0, fontWeight: '500' }}>{item.optimizedTitle}</p></div></div>}{item.optimizedDescription && <div style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr', gap: '8px', alignItems: 'start' }}><div style={{ padding: '10px 12px', backgroundColor: 'var(--danger-bg)', borderRadius: '6px', borderLeft: '3px solid #fca5a5' }}><p style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: '600', marginBottom: '4px' }}>DESCRIPTION ORIGINALE</p><p style={{ fontSize: '12px', color: 'var(--ink-2)', margin: 0, maxHeight: '60px', overflow: 'hidden' }}>{item.originalDescription || '(vide)'}</p></div><ArrowRight style={{ width: '16px', height: '16px', color: 'var(--line-strong)', marginTop: '20px' }} /><div style={{ padding: '10px 12px', backgroundColor: 'var(--success-bg)', borderRadius: '6px', borderLeft: '3px solid #BBF7D0' }}><p style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '600', marginBottom: '4px' }}>DESCRIPTION OPTIMISÉE</p><p style={{ fontSize: '12px', color: 'var(--ink-2)', margin: 0, maxHeight: '100px', overflow: 'hidden', whiteSpace: 'pre-line' }}>{item.optimizedDescription?.substring(0, 400)}{(item.optimizedDescription?.length || 0) > 400 ? '...' : ''}</p></div></div>}</div>))}</div>}
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={() => { setStep('config'); setMode('choose'); setResult(null); }} style={{ padding: '12px 24px', border: '1px solid var(--line-strong)', borderRadius: '8px', fontSize: '14px', fontWeight: '500', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink-2)' }}><ArrowRight style={{ width: '16px', height: '16px', transform: 'rotate(180deg)' }} />Nouvelle optimisation</button>
            <button onClick={() => window.location.href = '/flux'} style={{ padding: '12px 24px', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', backgroundColor: 'var(--ink)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>Exporter le flux optimisé<ArrowRight style={{ width: '16px', height: '16px' }} /></button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </PageLayout>
  );
}
