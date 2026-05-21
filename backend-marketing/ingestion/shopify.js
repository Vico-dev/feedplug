const crypto = require('crypto');
const { createRevision } = require('../lib/revisions');

function computeHash(obj) {
	const s = JSON.stringify(obj);
	return crypto.createHash('sha256').update(s).digest('hex');
}

// Récupérer tous les produits Shopify via GraphQL (avec pagination)
async function fetchAllShopifyProducts({ shop, accessToken, limit = 250, maxItems = null }) {
	const allProducts = [];
	let cursor = null;
	let hasNextPage = true;

	while (hasNextPage) {
		const query = `
			query getProducts($first: Int!, $after: String) {
				products(first: $first, after: $after) {
					pageInfo {
						hasNextPage
						endCursor
					}
					edges {
						node {
							id
							title
							handle
							description
							descriptionHtml
							vendor
							productType
							tags
							status
							createdAt
							updatedAt
							variants(first: 100) {
								edges {
									node {
										id
										title
										sku
										price
										compareAtPrice
										inventoryQuantity
										availableForSale
									}
								}
							}
							images(first: 10) {
								edges {
									node {
										id
										url
										altText
									}
								}
							}
						}
					}
				}
			}
		`;

		const variables = { first: limit };
		if (cursor) variables.after = cursor;

		// SSRF guard : on n'autorise que les hôtes *.myshopify.com pour ce
		// connecteur. `shop` peut venir indirectement de saisies utilisateur.
		if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(String(shop || ''))) {
			throw new Error(`Domaine Shopify invalide: ${shop}`);
		}
		const response = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Shopify-Access-Token': accessToken,
			},
			body: JSON.stringify({ query, variables }),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Shopify API error: ${response.status} - ${text}`);
		}

		const data = await response.json();
		if (data.errors) {
			throw new Error(`Shopify GraphQL errors: ${JSON.stringify(data.errors)}`);
		}

		const products = data.data?.products;
		if (!products) {
			throw new Error('No products data in Shopify response');
		}

		// Transformer les produits Shopify en items
		for (const edge of products.edges) {
			const product = edge.node;
			const variants = product.variants.edges || [];
			const images = product.images.edges || [];

			// Si pas de variants, créer un item par produit
			if (variants.length === 0) {
				allProducts.push({
					productId: product.id,
					title: product.title,
					handle: product.handle,
					description: product.description || product.descriptionHtml,
					descriptionHtml: product.descriptionHtml,
					vendor: product.vendor,
					productType: product.productType,
					tags: product.tags,
					status: product.status,
					createdAt: product.createdAt,
					updatedAt: product.updatedAt,
					sku: null,
					price: null,
					currency: null,
					inventory: null,
					variantId: null,
					variantTitle: null,
					imageUrl: images[0]?.node?.url || null,
				});
			} else {
				// Créer un item par variant
				for (const variantEdge of variants) {
					const variant = variantEdge.node;
					allProducts.push({
						productId: product.id,
						variantId: variant.id,
						title: product.title,
						variantTitle: variant.title !== 'Default Title' ? variant.title : null,
						handle: product.handle,
						description: product.description || product.descriptionHtml,
						descriptionHtml: product.descriptionHtml,
						vendor: product.vendor,
						productType: product.productType,
						tags: product.tags,
						status: product.status,
						createdAt: product.createdAt,
						updatedAt: product.updatedAt,
						sku: variant.sku,
						price: parseFloat(variant.price) || null,
						currency: 'EUR', // La devise est définie au niveau du shop, pas du variant
						inventory: variant.inventoryQuantity || 0,
						imageUrl: images[0]?.node?.url || null,
					});
				}
			}

			if (maxItems && allProducts.length >= maxItems) {
				return allProducts.slice(0, maxItems);
			}
		}

		hasNextPage = products.pageInfo?.hasNextPage || false;
		cursor = products.pageInfo?.endCursor || null;
	}

	return allProducts;
}

// Transformer un produit Shopify en FeedItem
function shopifyProductToFeedItem(product, shop) {
	const domain = shop.replace(/\.myshopify\.com$/, '');
	const url = `https://${domain}.myshopify.com/products/${product.handle}`;
	
	const title = product.variantTitle 
		? `${product.title} - ${product.variantTitle}`
		: product.title;

	const originId = product.variantId || product.productId;
	const contentHash = computeHash({
		title,
		sku: product.sku,
		price: product.price,
		description: product.description,
		imageUrl: product.imageUrl,
		updatedAt: product.updatedAt,
	});

	return {
		originId: originId.replace(/^gid:\/\/shopify\//, ''),
		url,
		title,
		descriptionHtml: product.descriptionHtml || null,
		descriptionText: product.description || null,
		imageUrl: product.imageUrl || null,
		brand: product.vendor || null,
		sku: product.sku || null,
		price: product.price,
		currency: product.currency || 'EUR',
		inventory: product.inventory !== null ? parseInt(product.inventory) : null,
		publishedAt: product.status === 'ACTIVE' ? new Date(product.updatedAt) : null,
		updatedAt: new Date(product.updatedAt),
		contentHash,
	};
}

// Ingestion principale Shopify
async function ingestShopifyFromApi({ prisma, feed, shop, accessToken }) {
	console.log(`🛍️  Début ingestion Shopify: ${shop}`);
	
	// Créer un run d'ingestion via SQL brut pour rester compatible
	// avec les bases où IngestionRun.status est un TEXT + CHECK.
	const runId = crypto.randomUUID();
	const startedAtIso = new Date().toISOString();
	await prisma.$executeRawUnsafe(`
		INSERT INTO "IngestionRun" (id, feedid, status, startedat)
		VALUES ($1::text, $2::text, $3::text, $4::timestamptz)
	`, runId, feed.id, 'RUNNING', startedAtIso);
	const run = { id: runId };

	try {
		// Récupérer tous les produits
		const shopifyProducts = await fetchAllShopifyProducts({ shop, accessToken });
		console.log(`📦 ${shopifyProducts.length} produits/variants récupérés de Shopify`);

		let totalInserted = 0;
		let totalUpdated = 0;
		let totalSkipped = 0;

		// Créer ou mettre à jour les FeedItems
		for (const sp of shopifyProducts) {
			try {
				const item = shopifyProductToFeedItem(sp, shop);
				
				// Chercher un item existant par originId
				const existing = await prisma.feedItem.findUnique({
					where: {
						feedId_originId: {
							feedId: feed.id,
							originId: item.originId,
						},
					},
				});

				if (existing) {
					// Mettre à jour si le hash a changé
					if (existing.contentHash !== item.contentHash) {
						await prisma.feedItem.update({
							where: { id: existing.id },
							data: {
								...item,
								updatedAt: new Date(),
							},
						});
						try {
							const snap = {
								title: item.title || null,
								descriptionhtml: item.descriptionHtml || null,
								descriptiontext: item.descriptionText || null,
								imageurl: item.imageUrl || null,
								brand: item.brand || null,
								sku: item.sku || null,
								price: item.price != null ? Number(item.price) : null,
								currency: item.currency || null,
								inventory: item.inventory != null ? Number(item.inventory) : null,
								url: item.url || null,
								gtin: null,
								mpn: null,
								condition: null,
								customfields: {}
							};
							await createRevision(prisma, existing.id, snap, 'ingestion');
						} catch (revErr) {
							console.warn('⚠️ Révision ingestion (update) non créée:', revErr.message);
						}
						totalUpdated++;
					} else {
						totalSkipped++;
					}
				} else {
					// Créer nouveau
					const created = await prisma.feedItem.create({
						data: {
							feedId: feed.id,
							...item,
							createdAt: new Date(),
						},
					});
					try {
						const snap = {
							title: item.title || null,
							descriptionhtml: item.descriptionHtml || null,
							descriptiontext: item.descriptionText || null,
							imageurl: item.imageUrl || null,
							brand: item.brand || null,
							sku: item.sku || null,
							price: item.price != null ? Number(item.price) : null,
							currency: item.currency || null,
							inventory: item.inventory != null ? Number(item.inventory) : null,
							url: item.url || null,
							gtin: null,
							mpn: null,
							condition: null,
							customfields: {}
						};
						await createRevision(prisma, created.id, snap, 'ingestion');
					} catch (revErr) {
						console.warn('⚠️ Révision ingestion (insert) non créée:', revErr.message);
					}
					totalInserted++;
				}
			} catch (err) {
				console.error(`❌ Erreur traitement produit Shopify ${sp.productId}:`, err.message);
				totalSkipped++;
			}
		}

		// Recalculer les scores de qualité après l'ingestion
		try {
			const { updateQualityScore } = require('../scoring/quality');
			// customColumns non lié dans le schema Prisma, on passe [] pour le scoring
			const customColumns = [];

			// Récupérer les items du feed pour recalculer leurs scores
			const items = await prisma.feedItem.findMany({
				where: { feedId: feed.id },
			});

			for (const item of items) {
				try {
					await updateQualityScore(prisma, item.id, item, customColumns);
				} catch (scoreError) {
					console.error(`Error updating score for item ${item.id}:`, scoreError);
				}
			}
		} catch (scoreError) {
			console.error('Error updating scores after Shopify ingestion:', scoreError);
			// Ne pas faire échouer l'ingestion si le score échoue
		}

		// Mettre à jour le run avec succès
		const finishedAt = new Date();
		await prisma.$executeRawUnsafe(`
			UPDATE "IngestionRun"
			SET status = $1::text,
				finishedat = $2::timestamptz,
				totalfetched = $3::int,
				totalinserted = $4::int,
				totalupdated = $5::int,
				totalskipped = $6::int
			WHERE id = $7::text
		`, 'SUCCESS', finishedAt.toISOString(), shopifyProducts.length, totalInserted, totalUpdated, totalSkipped, run.id);

		// Mettre à jour lastRunAt de la source
		await prisma.feedSource.update({
			where: { id: feed.sourceId },
			data: { lastRunAt: finishedAt }
		});

		console.log(`✅ Ingestion Shopify terminée: ${totalInserted} insérés, ${totalUpdated} mis à jour, ${totalSkipped} ignorés`);

		return {
			runId: run.id,
			totalFetched: shopifyProducts.length,
			totalInserted,
			totalUpdated,
			totalSkipped,
		};
	} catch (e) {
		// Mettre à jour le run avec erreur
		await prisma.$executeRawUnsafe(`
			UPDATE "IngestionRun"
			SET status = $1::text,
				finishedat = $2::timestamptz,
				errormessage = $3::text
			WHERE id = $4::text
		`, 'FAILED', new Date().toISOString(), e?.message || String(e), run.id);
		throw e;
	}
}

module.exports = {
	fetchAllShopifyProducts,
	ingestShopifyFromApi,
};
