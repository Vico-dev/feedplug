const crypto = require('crypto');
const { analyzeProduct, enrichProduct } = require('../enrichment/auto-enrichment');
const { createRevision } = require('../lib/revisions');
const { fetchWithTimeout, DEFAULT_FETCH_TIMEOUT_MS } = require('../lib/resilience');
const {
	buildNormalizedRow,
	getFirstNonEmptyValue,
	getRowValueCaseInsensitive,
	mapRowToItem,
} = require('./csv-mapping');

function buildIngestionSnapshot(item, finalCustomFields, priceValue) {
	return {
		title: item.title || null,
		descriptionhtml: item.descriptionHtml || null,
		descriptiontext: item.descriptionText || null,
		imageurl: item.imageUrl || null,
		brand: item.brand || null,
		sku: item.sku || null,
		price: priceValue,
		currency: item.currency || null,
		inventory: item.inventory != null ? Number(item.inventory) : null,
		url: item.url || null,
		gtin: item.gtin || null,
		mpn: item.mpn || null,
		condition: item.condition || null,
		customfields: finalCustomFields || {}
	};
}

async function fetchText(url, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
	const res = await fetchWithTimeout(url, { method: 'GET', timeoutMs });
	if (!res.ok) throw new Error(`Fetch CSV failed: ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	// Flux gzip (ex. AWIN /compression/gzip/, redirige vers legacydatafeeds) :
	// décompresser si l'entête magic gzip (1f 8b) est présente. Sinon UTF-8 brut.
	if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
		return require('zlib').gunzipSync(buf).toString('utf8');
	}
	return buf.toString('utf8');
}

function computeHash(obj) {
	const s = JSON.stringify(obj);
	return crypto.createHash('sha256').update(s).digest('hex');
}

module.exports.ingestCsvFromUrl = async function ingestCsvFromUrl({ prisma, feed, csvUrl, csvText }) {
	// csvUrl OU csvText requis (csvText = contenu déjà récupéré, ex. depuis GCS)
	if (!csvUrl && !csvText) throw new Error('csvUrl ou csvText requis');
	if (!feed?.id) throw new Error('feed manquant');

	// Créer l'IngestionRun avec une requête raw
	const runId = require('crypto').randomUUID();
	const now = new Date().toISOString();
	
	await prisma.$executeRawUnsafe(`
		INSERT INTO "IngestionRun" (id, feedid, status, startedat)
		VALUES ($1::text, $2::text, $3::text, $4::timestamptz)
	`, runId, feed.id, 'RUNNING', now);
	
	const run = { id: runId, feedId: feed.id, status: 'RUNNING', startedAt: new Date(now) };

	let totalFetched = 0, totalInserted = 0, totalUpdated = 0, totalSkipped = 0;
	/** Diagnostic pour le client : colonnes détectées, raisons des lignes ignorées, échantillon première ligne */
	const diagnostic = { sampleColumns: [], skipReason: null, skipReasonMessage: null, mappingKeysCount: 0, firstRowSample: null };

	try {
		const text = csvText != null ? csvText : await fetchText(csvUrl);
		const { parse } = require('csv-parse/sync');
		
		// Détecter le délimiteur : celui qui donne le plus de colonnes sur la 1ère ligne (header)
		const firstLine = text.split(/\r?\n/)[0] || '';
		const countCols = (del) => firstLine.split(del).length;
		const byTab = countCols('\t');
		const byComma = countCols(',');
		const byPipe = countCols('|');
		const bySemicolon = countCols(';');
		let delimiter = ',';
		let maxCols = byComma;
		if (byTab > maxCols) { delimiter = '\t'; maxCols = byTab; }
		if (byPipe > maxCols) { delimiter = '|'; maxCols = byPipe; }
		if (bySemicolon > maxCols) { delimiter = ';'; maxCols = bySemicolon; }
		const delimNames = { '\t': 'TSV (tab)', ',': 'CSV (virgule)', '|': 'pipe', ';': 'point-virgule' };
		console.log(`📄 Délimiteur détecté: ${delimNames[delimiter]} (${maxCols} colonnes sur la 1ère ligne)`);
		
		const records = parse(text, { 
			columns: true, 
			skip_empty_lines: true, 
			bom: true, 
			trim: true,
			delimiter: delimiter,
			quote: '"',
			escape: '"',
			relax_quotes: true,
			relax_column_count: true
		});
		totalFetched = records.length;
		diagnostic.sampleColumns = records.length > 0 ? Object.keys(records[0]) : [];
		console.log(`📊 ${totalFetched} lignes parsées`);

		// B5 — plafond d'ingestion synchrone : au-delà, l'import dépasserait le
		// timeout Cloud Run (300 s) ou la mémoire (2 Gi). Plafond levé une fois
		// l'ingestion externalisée en background (cf. PLAN_REMEDIATION_BLOQUANTS.md).
		const MAX_INGEST_PRODUCTS = Number(process.env.MAX_INGEST_PRODUCTS || 5000);
		if (records.length > MAX_INGEST_PRODUCTS) {
			const err = new Error(`Catalogue trop volumineux pour l'import synchrone : ${records.length} produits (max ${MAX_INGEST_PRODUCTS}). Contactez-nous pour activer l'import par lots.`);
			err.statusCode = 413;
			err.code = 'INGEST_TOO_LARGE';
			throw err;
		}

		// Récupérer le mapping (peut être dans mappingJson ou mappingjson)
		// PostgreSQL peut retourner mappingjson comme string JSON ou comme objet
		let rawMapping = feed.mappingJson || feed.mappingjson || null;
		
		// Parser le mapping si c'est une chaîne JSON
		let mapping = {};
		if (rawMapping) {
			if (typeof rawMapping === 'string') {
				try {
					mapping = JSON.parse(rawMapping);
					console.log('✅ Mapping parsé depuis string JSON');
				} catch (e) {
					console.error('❌ Erreur parsing mapping JSON:', e.message);
					mapping = {};
				}
			} else if (typeof rawMapping === 'object') {
				mapping = rawMapping;
				console.log('✅ Mapping déjà un objet');
			}
		}
		
		diagnostic.mappingKeysCount = Object.keys(mapping).length;
		console.log('📋 Mapping utilisé:', JSON.stringify(mapping));
		console.log('📋 Nombre de champs dans le mapping:', diagnostic.mappingKeysCount);
		
		// Afficher les premières clés du premier row pour debug
		if (records.length > 0) {
			console.log('🔍 Premières clés du premier row:', Object.keys(records[0]).slice(0, 10).join(', '));
			console.log('🔍 Premier row (échantillon):', JSON.stringify(Object.fromEntries(Object.entries(records[0]).slice(0, 5))));
		}

		// Sprint 2 (B-PROPER) — fix N+1 : on précharge en UNE requête toutes les
		// lignes existantes de ce feed, indexées par originid. Avant, chaque
		// produit déclenchait un SELECT ... WHERE feedid AND originid LIMIT 1
		// (N requêtes). On remplace ces N SELECT par un lookup O(1) en mémoire.
		// Même approche que l'ingestion Shopify (existingRows préchargés).
		const existingByOriginId = new Map();
		try {
			const existingRows = await prisma.$queryRawUnsafe(
				`SELECT * FROM \"FeedItem\" WHERE feedid = $1::text`,
				feed.id
			);
			for (const row of existingRows || []) {
				if (row && row.originid != null) existingByOriginId.set(String(row.originid), row);
			}
			console.log(`📦 Préchargement: ${existingByOriginId.size} produit(s) existant(s) (1 requête, N+1 supprimé)`);
		} catch (preErr) {
			console.warn('⚠️ Préchargement existants échoué, fallback SELECT par produit:', preErr.message);
		}

		for (let i = 0; i < records.length; i++) {
			const row = records[i];
			// Row normalisé : toutes les clés en minuscules, sans BOM ni espaces, pour matcher mapping et replis
			const rowNorm = buildNormalizedRow(row);
			const item = mapRowToItem(rowNorm, mapping);
			
			// Debug pour les premiers produits : afficher ce qui a été mappé
			if (i < 3) {
				const mappedFields = Object.keys(item).filter(k => item[k] !== undefined && item[k] !== null && item[k] !== '');
				console.log(`📦 Produit ${i+1}: ${mappedFields.length} champs mappés:`, mappedFields.slice(0, 10).join(', '));
				console.log(`📦 Produit ${i+1} - Exemple de valeurs mappées:`, JSON.stringify(Object.fromEntries(Object.entries(item).filter(([k, v]) => v !== undefined && v !== null && v !== '').slice(0, 5))));
				console.log(`📦 Produit ${i+1} - Colonnes normalisées:`, Object.keys(rowNorm).slice(0, 10).join(', '));
			}
			
			// Compléter item depuis le row normalisé (insensible à la casse) pour supporter les CSV GMC (Title, ID, Link, etc.)
			if (!item.title) item.title = getRowValueCaseInsensitive(rowNorm, ['title', 'name', 'product_title', 'item_title', 'titre']);
			if (!item.url) item.url = getRowValueCaseInsensitive(rowNorm, ['link', 'url', 'product_url', 'item_link']);
			if (!item.sku) item.sku = getRowValueCaseInsensitive(rowNorm, ['id', 'sku', 'item_id', 'product_id', 'reference', 'ref']);
			if (!item.price) item.price = getRowValueCaseInsensitive(rowNorm, ['price', 'prix']);
			if (!item.imageUrl) item.imageUrl = getRowValueCaseInsensitive(rowNorm, ['image_link', 'image', 'image_url', 'imageurl', 'photo']);
			if (!item.brand) item.brand = getRowValueCaseInsensitive(rowNorm, ['brand', 'marque', 'vendor']);
			if (!item.description) item.description = getRowValueCaseInsensitive(rowNorm, ['description', 'desc', 'product_description']);

			if (!item.sku && item.id) item.sku = item.id;
			let originId = item.sku || item.url || item.title ||
				getRowValueCaseInsensitive(rowNorm, ['id', 'sku', 'link', 'url', 'title', 'name']);
			// Dernier recours : toute valeur non vide de la ligne (gère 1ère ligne vide ou colonnes décalées)
			if (!originId) originId = getFirstNonEmptyValue(rowNorm);
			if (!originId) {
				if (!diagnostic.skipReason) {
					diagnostic.skipReason = 'no_identifier';
					diagnostic.skipReasonMessage = 'Chaque ligne doit avoir au moins un identifiant (ID, SKU, Titre ou URL). Aucune de ces colonnes n\'a été trouvée ou n\'avait de valeur pour les lignes analysées.';
					// Échantillon première ligne (colonnes absentes = null, vides = "(vide)")
					const toSample = (v) => {
						if (v === undefined || v === null) return null;
						const s = String(v).trim();
						return s === '' ? '(vide)' : s.substring(0, 80);
					};
					diagnostic.firstRowSample = {
						id: toSample(rowNorm.id),
						title: toSample(rowNorm.title),
						link: toSample(rowNorm.link),
						url: toSample(rowNorm.url),
						sku: toSample(rowNorm.sku)
					};
					// Si toutes null, vérifier si les clés existent (rowNorm a-t-il id, title, link ?)
					if (Object.keys(rowNorm).length > 0 && !diagnostic.firstRowSample.id && !diagnostic.firstRowSample.title && !diagnostic.firstRowSample.link) {
						diagnostic.firstRowSample._keys = Object.keys(rowNorm).slice(0, 15).join(',');
					}
				}
				if (i < 3) {
					console.log(`⚠️  Produit ${i+1} ignoré (pas d'originId):`, JSON.stringify(item).substring(0, 300));
					console.log(`   Row normalisé (clés):`, Object.keys(rowNorm).slice(0, 15).join(', '));
					console.log(`   Row normalisé (id/title/link):`, rowNorm.id, rowNorm.title, rowNorm.link);
				}
				totalSkipped++;
				continue;
			}
			if (!item.gtin) item.gtin = getRowValueCaseInsensitive(rowNorm, ['gtin', 'barcode', 'ean', 'ean13', 'upc']);
			if (!item.mpn) item.mpn = getRowValueCaseInsensitive(rowNorm, ['mpn', 'manufacturer_part_number', 'manufacturer_partnumber']);
			if (!item.condition) item.condition = getRowValueCaseInsensitive(rowNorm, ['condition', 'item_condition', 'state', 'etat']);

			// Normaliser link -> url pour la colonne dédiée
			if (item.link && !item.url) {
				item.url = item.link;
			}
			if (item.image_link && !item.imageUrl) {
				item.imageUrl = item.image_link;
			}
			
			// Séparer les champs standards des champs personnalisés
			// Champs standards qui ont des colonnes dédiées dans FeedItem
			// Note: url stocke aussi 'link', imageUrl stocke aussi 'image_link'
			const standardFieldsWithColumns = ['title', 'description', 'descriptionHtml', 'descriptionText', 'url', 
				'imageUrl', 'brand', 'sku', 'price', 'currency', 'inventory', 
				'gtin', 'mpn', 'condition', 'publishedAt', 'updatedAt'];
			
			// Extraire TOUS les champs mappés dans customFields
			// On stocke TOUS les champs du mapping dans customFields pour faciliter l'accès
			const customFields = {};
			
			// D'abord, parcourir TOUS les champs du mapping et les ajouter à customFields
			// IMPORTANT: Stocker TOUS les champs mappés, même s'ils sont vides, pour que le frontend puisse les afficher
			for (const [targetField, sourceColumn] of Object.entries(mapping)) {
				if (sourceColumn) {
					// Vérifier si le champ existe dans item
					if (item[targetField] !== undefined) {
						// Toujours stocker le champ dans customFields, même si la valeur est vide/null
						// Cela permet au frontend de savoir quels champs sont mappés
						customFields[targetField] = item[targetField] !== null && item[targetField] !== '' ? item[targetField] : null;
						if ((item[targetField] === null || item[targetField] === '') && i < 3) {
							console.log(`⚠️  Produit ${i+1} - Champ "${targetField}" mappé depuis "${sourceColumn}" mais valeur vide/null (stocké comme null)`);
						}
					} else {
						// Si le champ n'existe pas dans item, le stocker comme null pour indiquer qu'il est mappé mais sans valeur
						customFields[targetField] = null;
						if (i < 3) {
							console.log(`⚠️  Produit ${i+1} - Champ "${targetField}" mappé depuis "${sourceColumn}" mais non trouvé dans item (stocké comme null)`);
						}
					}
				}
			}
			
			// Ensuite, ajouter aussi tous les autres champs de item qui ne sont pas dans les colonnes standards
			for (const [key, value] of Object.entries(item)) {
				// Inclure tous les champs qui ont une valeur et qui ne sont pas dans les colonnes standards
				if (value !== null && value !== undefined && value !== '' && !standardFieldsWithColumns.includes(key)) {
					// Si le champ n'est pas déjà dans customFields, l'ajouter
					if (!(key in customFields)) {
						customFields[key] = value;
					}
				}
			}
			
			// Toujours inclure link et image_link même s'ils sont aussi dans url/imageUrl
			if (item.link && !customFields.link) {
				customFields.link = item.link;
			}
			if (item.image_link && !customFields.image_link) {
				customFields.image_link = item.image_link;
			}
			
			// Debug pour les premiers produits : afficher les customFields
			if (i < 3) {
				console.log(`📋 Produit ${i+1} customFields (${Object.keys(customFields).length}):`, Object.keys(customFields).slice(0, 15).join(', '));
				console.log(`📋 Produit ${i+1} customFields sample:`, JSON.stringify(Object.fromEntries(Object.entries(customFields).slice(0, 5))));
				console.log(`📋 Produit ${i+1} - Tous les champs de item:`, Object.keys(item).slice(0, 15).join(', '));
			}

			const contentHash = computeHash(item);

			// upsert par (feedId, originId) — lookup O(1) sur le préchargement
			// (Sprint 2 : remplace le SELECT par produit). Fallback SELECT unitaire
			// uniquement si le préchargement a échoué (Map vide alors qu'il y a des items).
			let existing = existingByOriginId.get(String(originId)) || null;
			if (!existing && existingByOriginId.size === 0) {
				const existingResult = await prisma.$queryRawUnsafe(`
					SELECT * FROM "FeedItem" WHERE feedid = $1::text AND originid = $2::text LIMIT 1
				`, feed.id, originId).catch(() => []);
				existing = existingResult && existingResult.length > 0 ? existingResult[0] : null;
			}

			if (!existing) {
				const itemId = require('crypto').randomUUID();
				const itemNow = new Date().toISOString();
				
				// Convertir le prix en nombre si possible
				let priceValue = null;
				if (item.price) {
					const priceStr = String(item.price).replace(/[^\d.,]/g, '').replace(',', '.');
					priceValue = parseFloat(priceStr) || null;
				}
				
				const customFieldsJson = JSON.stringify(customFields);
				if (i < 3) {
					console.log(`💾 Produit ${i+1} INSERT customFields JSON (${customFieldsJson.length} chars):`, customFieldsJson.substring(0, 200));
				}
				
				// Enrichissement automatique : analyser et compléter les champs manquants
				let finalCustomFields = customFields;
				let enrichedFields = [];
				try {
					const itemForAnalysis = {
						...item,
						customFields: customFields,
						descriptionText: item.descriptionText,
						descriptionHtml: item.descriptionHtml
					};
					const analysis = analyzeProduct(itemForAnalysis);
					
					if (Object.keys(analysis.enrichments).length > 0) {
						const enriched = enrichProduct(itemForAnalysis, analysis.enrichments);
						finalCustomFields = enriched.customFields;
						enrichedFields = Object.keys(analysis.enrichments);
						
						if (i < 3) {
							console.log(`✨ Produit ${i+1} enrichi automatiquement:`, enrichedFields.join(', '));
						}
					}
				} catch (enrichError) {
					console.warn(`⚠️ Erreur enrichissement produit ${i+1}:`, enrichError.message);
					// Continuer avec les customFields originaux en cas d'erreur
				}
				
				const finalCustomFieldsJson = JSON.stringify(finalCustomFields);
				
				await prisma.$executeRawUnsafe(`
					INSERT INTO "FeedItem" (id, feedid, originid, url, title, descriptionhtml, descriptiontext, imageurl, brand, sku, gtin, mpn, condition, price, currency, inventory, publishedat, updatedat, contenthash, createdat, customfields)
					VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text, $9::text, $10::text, $11::text, $12::text, $13::text, $14::numeric, $15::text, $16::int, $17::timestamptz, $18::timestamptz, $19::text, $20::timestamptz, $21::jsonb)
				`, 
					itemId, feed.id, originId, item.url || null, item.title || originId, 
					item.descriptionHtml || null, item.descriptionText || null, item.imageUrl || null,
					item.brand || null, item.sku || null, item.gtin || null, item.mpn || null, item.condition || null,
					priceValue, item.currency || null,
					item.inventory ? Number(item.inventory) : null, item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
					itemNow, contentHash, itemNow, finalCustomFieldsJson
				);
				try {
					const snap = buildIngestionSnapshot(item, finalCustomFields, priceValue);
					snap.title = item.title || originId;
					await createRevision(prisma, itemId, snap, 'ingestion');
				} catch (revErr) {
					console.warn('⚠️ Révision ingestion (insert) non créée:', revErr.message);
				}
				totalInserted++;
			} else if (existing.contenthash !== contentHash) {
				const itemNow = new Date().toISOString();
				// Convertir le prix en nombre si possible
				let priceValue = null;
				if (item.price) {
					const priceStr = String(item.price).replace(/[^\d.,]/g, '').replace(',', '.');
					priceValue = parseFloat(priceStr) || null;
				}
				
				// Enrichissement automatique : analyser et compléter les champs manquants
				let finalCustomFields = customFields;
				let enrichedFields = [];
				try {
					const itemForAnalysis = {
						...item,
						customFields: customFields,
						descriptionText: item.descriptionText,
						descriptionHtml: item.descriptionHtml
					};
					const analysis = analyzeProduct(itemForAnalysis);
					
					if (Object.keys(analysis.enrichments).length > 0) {
						const enriched = enrichProduct(itemForAnalysis, analysis.enrichments);
						finalCustomFields = enriched.customFields;
						enrichedFields = Object.keys(analysis.enrichments);
						
						if (i < 3) {
							console.log(`✨ Produit ${i+1} mis à jour et enrichi:`, enrichedFields.join(', '));
						}
					}
				} catch (enrichError) {
					console.warn(`⚠️ Erreur enrichissement produit ${i+1}:`, enrichError.message);
					// Continuer avec les customFields originaux en cas d'erreur
				}
				
				await prisma.$executeRawUnsafe(`
					UPDATE "FeedItem" 
					SET url = $1::text, title = $2::text, descriptionhtml = $3::text, descriptiontext = $4::text, 
					    imageurl = $5::text, brand = $6::text, sku = $7::text, gtin = $8::text, mpn = $9::text, condition = $10::text,
					    price = $11::numeric, currency = $12::text,
					    inventory = $13::int, publishedat = $14::timestamptz, updatedat = $15::timestamptz, contenthash = $16::text,
					    customfields = $17::jsonb
					WHERE id = $18::text
				`, 
					item.url || null, item.title || originId, item.descriptionHtml || null, item.descriptionText || null,
					item.imageUrl || null, item.brand || null, item.sku || null, item.gtin || null, item.mpn || null, item.condition || null,
					priceValue, item.currency || null,
					item.inventory ? Number(item.inventory) : null, item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
					itemNow, contentHash, JSON.stringify(finalCustomFields), existing.id
				);
				try {
					const snap = buildIngestionSnapshot(item, finalCustomFields, priceValue);
					snap.title = item.title || originId;
					await createRevision(prisma, existing.id, snap, 'ingestion');
				} catch (revErr) {
					console.warn('⚠️ Révision ingestion (update) non créée:', revErr.message);
				}
				totalUpdated++;
			} else {
				// Même si le hash n'a pas changé, mettre à jour customfields si nécessaire
				// (pour s'assurer que les nouveaux champs mappés sont toujours stockés)
				const existingCustomFields = existing.customfields ? (typeof existing.customfields === 'string' ? JSON.parse(existing.customfields) : existing.customfields) : {};
				const customFieldsStr = JSON.stringify(customFields);
				const existingCustomFieldsStr = JSON.stringify(existingCustomFields);
				
				// Comparer le nombre de champs mappés pour détecter si le mapping a changé
				const mappingKeysCount = Object.keys(mapping).length;
				const existingCustomFieldsCount = Object.keys(existingCustomFields).length;
				
				// Forcer la mise à jour si :
				// 1. Les customFields sont différents
				// 2. Le nombre de champs mappés a augmenté (nouveau mapping avec plus de champs)
				// 3. Les customFields existants sont vides mais on a maintenant des champs mappés
				const shouldUpdate = customFieldsStr !== existingCustomFieldsStr || 
				                     mappingKeysCount > existingCustomFieldsCount ||
				                     (existingCustomFieldsCount === 0 && mappingKeysCount > 0);
				
				if (shouldUpdate) {
					const itemNow = new Date().toISOString();
					if (i < 3) {
						console.log(`💾 Produit ${i+1} UPDATE customFields:`, Object.keys(customFields).length, 'champs (existant:', existingCustomFieldsCount, ', mapping:', mappingKeysCount, ')');
					}
					await prisma.$executeRawUnsafe(`
						UPDATE "FeedItem" 
						SET customfields = $1::jsonb, updatedat = $2::timestamptz
						WHERE id = $3::text
					`, customFieldsStr, itemNow, existing.id);
					try {
						const snap = {
							title: existing.title,
							descriptionhtml: existing.descriptionhtml,
							descriptiontext: existing.descriptiontext,
							imageurl: existing.imageurl,
							brand: existing.brand,
							sku: existing.sku,
							price: existing.price != null ? Number(existing.price) : null,
							currency: existing.currency,
							inventory: existing.inventory,
							url: existing.url,
							gtin: existing.gtin,
							mpn: existing.mpn,
							condition: existing.condition,
							customfields: typeof customFields === 'object' ? customFields : {}
						};
						await createRevision(prisma, existing.id, snap, 'ingestion');
					} catch (revErr) {
						console.warn('⚠️ Révision ingestion (customFields) non créée:', revErr.message);
					}
					totalUpdated++;
				} else {
					if (i < 3) {
						console.log(`⏭️  Produit ${i+1} SKIP (customFields identiques, ${existingCustomFieldsCount} champs)`);
					}
					totalSkipped++;
				}
			}
		}

		const finishedAt = new Date().toISOString();
		await prisma.$executeRawUnsafe(`
			UPDATE "IngestionRun" 
			SET status = $1::text, finishedat = $2::timestamptz, totalfetched = $3::int, totalinserted = $4::int, totalupdated = $5::int, totalskipped = $6::int
			WHERE id = $7::text
		`, 'SUCCESS', finishedAt, totalFetched, totalInserted, totalUpdated, totalSkipped, run.id);
		
		// Mettre à jour lastRunAt de la source associée au feed
		try {
			await prisma.$executeRawUnsafe(`
				UPDATE "FeedSource" 
				SET lastrunat = $1::timestamptz
				WHERE id = (
					SELECT sourceid FROM "Feed" WHERE id = $2::text
				)
			`, finishedAt, feed.id);
			console.log(`✅ lastRunAt mis à jour pour la source du feed ${feed.id}`);
		} catch (updateError) {
			console.warn('⚠️  Erreur lors de la mise à jour de lastRunAt:', updateError.message);
			// Ne pas faire échouer l'ingestion si cette mise à jour échoue
		}

		// Recalculer les scores de qualité pour les items insérés/mis à jour (nouveau système avancé)
		try {
			const { updateAdvancedQualityScore } = require('../scoring/quality-advanced');
			const limit = Math.min(totalInserted + totalUpdated, 1000); // Limiter à 1000 pour éviter les timeouts
			const itemsToScore = await prisma.$queryRawUnsafe(`
				SELECT * FROM "FeedItem" WHERE feedid = $1::text ORDER BY updatedat DESC LIMIT $2::int
			`, feed.id, limit);
			
			let scoredCount = 0;
			for (const item of itemsToScore) {
				try {
					// Normaliser les noms de colonnes (PostgreSQL retourne en minuscules)
					const normalizedItem = {
						id: item.id,
						feedId: item.feedid,
						originId: item.originid,
						url: item.url,
						title: item.title,
						descriptionHtml: item.descriptionhtml,
						descriptionText: item.descriptiontext,
						description: item.descriptiontext || item.descriptionhtml,
						imageUrl: item.imageurl,
						brand: item.brand,
						sku: item.sku,
						gtin: item.gtin,
						mpn: item.mpn,
						condition: item.condition,
						price: item.price !== null && item.price !== undefined ? Number(item.price) : null,
						currency: item.currency,
						inventory: item.inventory !== null && item.inventory !== undefined ? Number(item.inventory) : null,
						availability: item.availability || 'in stock',
						publishedAt: item.publishedat,
						updatedAt: item.updatedat,
						contentHash: item.contenthash,
						createdAt: item.createdat,
						customFields: item.customfields || {}
					};
					
					await updateAdvancedQualityScore(prisma, item.id, normalizedItem, []);
					scoredCount++;
				} catch (scoreError) {
					console.warn(`⚠️  Erreur calcul score avancé pour item ${item.id}:`, scoreError.message);
				}
			}
			console.log(`✅ Scores de qualité avancés calculés pour ${scoredCount}/${itemsToScore.length} produits`);
		} catch (scoreError) {
			console.warn('⚠️  Erreur lors du calcul des scores avancés après ingestion:', scoreError.message);
			// Ne pas faire échouer l'ingestion si le calcul des scores échoue
		}

		// Enregistrer le score moyen du flux après run (pour graphique évolution dashboard)
		try {
			const avgResult = await prisma.$queryRawUnsafe(`
				SELECT ROUND(AVG(ps.qualityscore))::int as avgscore
				FROM "ProductScore" ps
				JOIN "FeedItem" fi ON fi.id = ps.itemid
				WHERE fi.feedid = $1::text
			`, feed.id);
			const avgScoreAfter = avgResult?.[0]?.avgscore ?? null;
			if (avgScoreAfter != null) {
				await prisma.$executeRawUnsafe(`
					UPDATE "IngestionRun" SET avg_score_after = $1::int WHERE id = $2::text
				`, avgScoreAfter, run.id);
			}
		} catch (avgErr) {
			// Colonne avg_score_after peut ne pas exister si migration 011 non appliquée
			console.warn('⚠️  avg_score_after non mis à jour:', avgErr.message?.substring(0, 80));
		}

		// Comparateur CSS : réconcilier les offres avec leur produit canonique (ProductGroup).
		// Gardé par compte « comparator » (env COMPARATOR_ACCOUNT_ID) → no-op pour l'ingestion client.
		try {
			const comparatorAccountId = process.env.COMPARATOR_ACCOUNT_ID;
			if (comparatorAccountId) {
				const metaRows = await prisma.$queryRawUnsafe(`
					SELECT f.accountid AS accountid, fs.approvalstatus AS approvalstatus, a.comparatoroptin AS optin
					FROM "Feed" f JOIN "FeedSource" fs ON fs.id = f.sourceid JOIN "Account" a ON a.id = f.accountid
					WHERE f.id = $1::text
				`, feed.id);
				const meta = metaRows?.[0];
					const isComparator = meta && meta.accountid === comparatorAccountId;
					const isOptedInClient = meta && meta.optin === true && !isComparator;
				if (isComparator || isOptedInClient) {
					if (isOptedInClient || (isComparator && meta.approvalstatus === 'approved')) {
						const { reconcileFeed } = require('../domains/comparator/matching');
						const res = await reconcileFeed(prisma, feed.id, comparatorAccountId);
						console.log(`🔗 Matching comparateur: ${res.matched}/${res.total} offres rattachées à un produit canonique`);
						// Classement taxonomie (catégorie principale) des produits touchés par ce flux.
						const { categorizeGroups } = require('../domains/comparator/categorization');
						const gidRows = await prisma.$queryRawUnsafe(`SELECT DISTINCT groupid FROM "FeedItem" WHERE feedid = $1::text AND groupid IS NOT NULL`, feed.id);
						const cat = await categorizeGroups(prisma, { groupIds: gidRows.map((r) => r.groupid) });
						console.log(`🏷️  Catégorisation comparateur: ${cat.classified}/${cat.total} produits classés`);
					} else {
						// Gating AWIN : source non approuvée (pending/rejected/revoked) → offres masquées.
						const { detachFeed } = require('../domains/comparator/matching');
						const det = await detachFeed(prisma, feed.id);
						console.log(`⛔ Source comparateur non approuvée (${meta.approvalstatus}) — ${det.detached} groupe(s) rafraîchi(s), offres masquées`);
					}

					// Historique de prix : fige le prix le plus bas par produit/pays pour aujourd'hui (UPSERT idempotent).
					const { snapshotGroupPrices } = require('../domains/comparator/price-history');
					const snap = await snapshotGroupPrices(prisma, comparatorAccountId);
					console.log(`📈 Historique prix comparateur: ${snap.rows} produits snapshotés (${snap.capturedOn})`);
				}
			}
		} catch (matchErr) {
			console.warn('⚠️  Matching comparateur après ingestion échoué:', matchErr.message);
			// Ne pas faire échouer l'ingestion si le matching échoue.
		}

		// Message explicite si tout a été ignoré
		if (totalInserted + totalUpdated === 0 && totalSkipped > 0 && !diagnostic.skipReasonMessage) {
			diagnostic.skipReason = 'all_skipped';
			diagnostic.skipReasonMessage = 'Toutes les lignes ont été ignorées (doublons ou règles métier). Vérifiez le mapping et qu\'au moins une colonne Titre, SKU ou URL est renseignée.';
		}
		if (totalFetched === 0) {
			diagnostic.skipReason = 'empty_or_invalid';
			diagnostic.skipReasonMessage = 'Le fichier est vide ou n\'a pas de ligne d\'en-têtes valide. Utilisez un CSV/TSV avec une première ligne contenant les noms des colonnes (ex: Title, ID, Link, Price).';
		}

		return { runId: run.id, totalFetched, totalInserted, totalUpdated, totalSkipped, diagnostic };
	} catch (e) {
		await prisma.$executeRawUnsafe(`
			UPDATE "IngestionRun" 
			SET status = $1::text, finishedat = $2::timestamptz, errormessage = $3::text
			WHERE id = $4::text
		`, 'FAILED', new Date().toISOString(), (e?.message || String(e)).substring(0, 1000), run.id);
		throw e;
	}
}
