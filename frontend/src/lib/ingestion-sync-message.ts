/**
 * Construit un message détaillé pour le client après une synchro d'ingestion,
 * afin qu'il comprenne exactement ce qui s'est passé (succès ou échec).
 */
export interface IngestionRunResponse {
  totalFetched?: number;
  totalInserted?: number;
  totalUpdated?: number;
  totalSkipped?: number;
  diagnostic?: {
    sampleColumns?: string[];
    skipReason?: string | null;
    skipReasonMessage?: string | null;
    mappingKeysCount?: number;
    firstRowSample?: { id?: string | null; title?: string | null; link?: string | null; url?: string | null; sku?: string | null; _keys?: string } | null;
  };
}

export function getIngestionSyncToastMessage(
  data: IngestionRunResponse,
  context: 'sources' | 'catalogue'
): { message: string; type: 'success' | 'error' | 'info' } {
  const totalFetched = data.totalFetched ?? 0;
  const totalInserted = data.totalInserted ?? 0;
  const totalUpdated = data.totalUpdated ?? 0;
  const totalSkipped = data.totalSkipped ?? 0;
  const added = totalInserted + totalUpdated;
  const diag = data.diagnostic;

  if (added > 0) {
    const parts =
      totalInserted > 0 && totalUpdated > 0
        ? `${totalInserted} produit(s) importé(s), ${totalUpdated} mis à jour.`
        : totalInserted > 0
          ? `${totalInserted} produit(s) importé(s).`
          : `${totalUpdated} produit(s) mis à jour.`;
    return { message: parts, type: 'success' };
  }

  if (totalFetched > 0 && totalSkipped === 0) {
    return {
      message: 'Synchronisation terminée. Aucun changement détecté sur ce flux.',
      type: 'info',
    };
  }

  // Cas fréquent pour les connecteurs API : tous les produits ont été relus,
  // mais aucun n'a changé depuis la précédente synchro.
  if (totalFetched > 0 && totalSkipped === totalFetched && !diag?.skipReasonMessage) {
    return {
      message: `Synchronisation terminée. ${totalFetched} produit(s) relu(s), aucun changement détecté sur ce flux.`,
      type: 'info',
    };
  }

  // Aucun produit importé : message d'erreur guidé, puis détail
  const lines: string[] = [];
  lines.push('La synchro a bien tourné, mais aucun produit exploitable n’a été importé.');
  lines.push(`Résultat : ${totalFetched} ligne(s) lue(s), ${totalSkipped} ignorée(s), 0 ajoutée ou mise à jour.`);

  if (diag?.mappingKeysCount !== undefined && diag.mappingKeysCount === 0) {
    lines.push('');
    lines.push('Cause probable : aucun champ du fichier n’est encore mappé vers votre catalogue.');
  } else if (diag?.skipReasonMessage) {
    lines.push('');
    lines.push('Cause probable :');
    lines.push(diag.skipReasonMessage);
  }

  lines.push('');
  if (context === 'sources') {
    lines.push('Action recommandée : ouvrez le mapping de cette source et vérifiez au minimum un Titre, un ID/SKU ou une URL produit.');
  } else {
    lines.push('Action recommandée : retournez dans Sources, ouvrez le mapping de ce flux et vérifiez au minimum un Titre, un ID/SKU ou une URL produit.');
  }

  if (diag?.sampleColumns && diag.sampleColumns.length > 0) {
    const cols = diag.sampleColumns.slice(0, 20).join(', ');
    const more = diag.sampleColumns.length > 20 ? ` (+${diag.sampleColumns.length - 20} autres)` : '';
    lines.push('');
    lines.push(`Colonnes détectées : ${cols}${more}.`);
  }

  if (diag?.firstRowSample) {
    const s = diag.firstRowSample;
    const parts = [s.id != null ? `id="${s.id}"` : null, s.title != null ? `title="${s.title}"` : null, s.link != null ? `link="${s.link}"` : null, s.url != null ? `url="${s.url}"` : null, s.sku != null ? `sku="${s.sku}"` : null].filter(Boolean);
    if (parts.length) {
      lines.push('');
      lines.push('Repères lus sur la première ligne : ' + parts.join(' ; '));
    } else {
      lines.push('');
      lines.push('Aucun repère produit exploitable n’a été lu sur la première ligne (id, title, link, url ou sku).');
      if (s._keys) {
        lines.push('Clés présentes sur cette ligne : ' + s._keys);
      }
    }
  }

  return { message: lines.join('\n'), type: 'error' };
}

/** Message quand le fichier est vide ou aucune ligne lue */
export function getIngestionEmptyFileMessage(): string {
  return 'Aucune ligne lue. Le fichier est vide ou le format n\'a pas été reconnu. Attendu : CSV ou TSV avec une première ligne d\'en-têtes (virgules ou tabulations). Vérifiez le fichier et réessayez.';
}
