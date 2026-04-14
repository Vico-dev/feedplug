/**
 * 🖼️ Génération d'images "mise en situation" (lifestyle)
 *
 * Supports :
 * - vertex + Gemini : Vertex AI Gemini 2.5 Flash Image (image + texte → image)
 * - vertex + Imagen : Vertex AI Imagen 3 edit (remplacement de fond, EDIT_MODE_BGSWAP)
 * - fal : Fal.ai Bria Product Shot (clé FAL_KEY)
 *
 * Variable d'environnement : LIFESTYLE_IMAGE_PROVIDER=vertex|fal (défaut: vertex)
 */

const crypto = require('crypto');
const { Storage } = require('@google-cloud/storage');

/** Ids des modèles Imagen (edit = remplacement de fond). Génération texte→image = autre API. */
const IMAGEN_EDIT_MODEL = 'imagen-3.0-capability-001';

const storage = new Storage();
const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'feedplug-uploads';

/** Scènes prédéfinies (prompts en anglais) */
const PRESET_SCENES = {
  living_room: 'a real modern living room with daylight from a window, believable scale, subtle styling, editorial ecommerce photography',
  outdoor: 'a real outdoor terrace or garden in soft daylight, believable perspective, natural shadows, premium ecommerce photography',
  kitchen: 'a real home kitchen countertop with daylight, product placed where it would naturally be used, subtle props only if relevant',
  bathroom: 'a bright modern bathroom with realistic materials, clean styling, natural reflections and soft daylight',
  desk: 'a real desk setup with natural perspective, soft daylight, restrained props, premium ecommerce hero shot',
  neutral: 'a premium studio background with realistic contact shadows, soft gradients and clean product photography lighting',
  studio_shadow: 'a premium editorial photo studio with soft controlled shadows, realistic light falloff, elegant background gradients and luxury ecommerce styling',
  on_model_studio: 'a clean fashion studio shot with a model wearing the product naturally, realistic fabric drape, correct garment proportions, premium ecommerce photography',
  flat_lay_editorial: 'a top-down flat lay editorial composition on a refined neutral surface, realistic scale, soft light, minimal styling and premium product focus',
  folded_stack: 'a clean folded textile stack or neatly presented garment arrangement on a premium studio surface, realistic folds, soft shadows and catalogue-ready styling',
  technical_clean: 'a clean technical catalogue shot on a neutral background, front-facing, highly legible, realistic materials, no decorative props, suitable for industrial or utility products',
  in_hand_macro: 'a realistic close-up product shot held naturally in hand, sharp details, controlled studio light, premium macro ecommerce photography',
};

// ---------- Fal (Bria) ----------
let falClient = null;

function getFal() {
  if (falClient) return falClient;
  try {
    const client = require('@fal-ai/client');
    const fal = client.fal || client;
    if (process.env.FAL_KEY) {
      fal.config({ credentials: process.env.FAL_KEY });
    }
    falClient = fal;
    return falClient;
  } catch (e) {
    throw new Error('@fal-ai/client non installé. Exécuter: npm install @fal-ai/client');
  }
}

async function generateLifestyleImageFal(productImageUrl, sceneDescription, options = {}) {
  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY manquant. Utilisez Vertex (LIFESTYLE_IMAGE_PROVIDER=vertex) ou définissez FAL_KEY.');
  }
  const fal = getFal();
  const placement = options.placement || 'bottom_center';
  const numResults = options.numResults ?? 1;

  const result = await fal.subscribe('fal-ai/bria/product-shot', {
    input: {
      image_url: productImageUrl,
      scene_description: sceneDescription,
      placement_type: 'manual_placement',
      manual_placement_selection: placement,
      num_results: numResults,
      fast: options.fast !== false,
      shot_size: [1000, 1000],
    },
    logs: false,
  });

  const images = result.data?.images;
  if (!images?.length) {
    throw new Error('Aucune image retournée par Bria Product Shot');
  }
  const first = images[0];
  return { url: first.url, contentType: first.content_type };
}

// ---------- Vertex (Gemini / Nano Banana) ----------
let vertexClient = null;

function getVertexClient() {
  if (vertexClient) return vertexClient;
  try {
    const { GoogleGenAI } = require('@google/genai');
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'feedplug-prod';
    // Pour la génération d'images (Nano Banana), la doc Vertex recommande "global" ou us-central1
    const location = process.env.GOOGLE_CLOUD_LOCATION_IMAGE || process.env.GOOGLE_CLOUD_LOCATION || 'global';
    vertexClient = new GoogleGenAI({
      vertexai: true,
      project: projectId,
      location,
    });
    return vertexClient;
  } catch (e) {
    throw new Error('@google/genai non installé ou Vertex AI non configuré: ' + e.message);
  }
}

/**
 * Télécharge une image depuis une URL avec en-têtes anti-403 (Referer, User-Agent).
 * Utilisable partout où on doit récupérer une image produit (lifestyle, proxy, etc.).
 * @param {string} url - URL de l'image
 * @param {{ refererOrigin?: string }} options - refererOrigin = origine de la page produit (ex. https://www.boutique.fr) pour contourner l'anti-hotlink
 */
async function downloadImageAsBase64(url, options = {}) {
  let referer = options.refererOrigin;
  if (!referer) {
    try {
      referer = new URL(url).origin;
    } catch {
      referer = null;
    }
  }
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    'Sec-Fetch-Dest': 'image',
    'Sec-Fetch-Site': referer ? 'same-site' : 'cross-site',
  };
  if (referer) {
    headers['Referer'] = referer.endsWith('/') ? referer : referer + '/';
    headers['Origin'] = referer.endsWith('/') ? referer.slice(0, -1) : referer;
  }
  const response = await fetch(url, {
    headers,
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Image inaccessible (${response.status}). Vérifiez que l'URL est publique ou que le serveur autorise les téléchargements.`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const base64 = buffer.toString('base64');
  return { base64, mimeType: contentType.split(';')[0].trim() };
}

async function uploadGeneratedImageToGCS(imageBuffer, mimeType = 'image/png') {
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const name = `lifestyle/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(name);
  await file.save(imageBuffer, {
    metadata: { contentType: mimeType },
    resumable: false,
  });
  return `https://storage.googleapis.com/${bucketName}/${name}`;
}

/**
 * Résout l'image produit : soit téléchargement depuis URL (avec Referer si fourni), soit base64 fourni.
 * @param {string} [productImageUrl] - URL de l'image (ignoré si imageData fourni)
 * @param {{ base64: string, mimeType: string }} [imageData] - Image déjà en base64 (contourne les 403 CDN)
 * @param {{ refererOrigin?: string }} [fetchOptions] - refererOrigin = origine page produit pour contourner anti-hotlink
 */
async function resolveProductImage(productImageUrl, imageData, fetchOptions = {}) {
  if (imageData?.base64) {
    return { base64: imageData.base64, mimeType: imageData.mimeType || 'image/jpeg' };
  }
  if (!productImageUrl) {
    throw new Error('imageUrl ou imageBase64 requis');
  }
  return downloadImageAsBase64(productImageUrl, fetchOptions);
}

function buildProductContextBlock(productContext, productDescription) {
  if (!productContext && !productDescription) return '';
  const parts = [];
  if (productContext) parts.push(`Product identity (keep this exact on the pack): ${productContext}.`);
  if (productDescription) parts.push(`Context (helps you understand the product; do not alter the pack): ${productDescription}`);
  return parts.length ? `\n\n${parts.join(' ')}\n` : '';
}

function buildRealismRules(sceneDescription) {
  return `Scene to generate: ${sceneDescription}.

Realism rules:
- Show one single physical product hero shot, not multiple copies.
- Do not add packaging, boxes, manuals, accessories or extra products unless they are clearly part of the original item.
- Keep the product proportions, materials, colors and finishes realistic.
- Place the product on a believable surface with natural contact shadows.
- Match perspective, scale and lighting consistently with the environment.
- Avoid CGI look, surreal styling, floating objects, melted details or exaggerated blur.
- Keep the final result suitable for a premium ecommerce PDP image.`;
}

async function generateLifestyleImageVertex(productImageUrl, sceneDescription, imageData, fetchOptions = {}, vertexOptions = {}) {
  const { Modality } = require('@google/genai');
  const client = getVertexClient();
  const { base64, mimeType } = await resolveProductImage(productImageUrl, imageData, fetchOptions);

  const productBlock = buildProductContextBlock(vertexOptions.productContext, vertexOptions.productDescription);
  const prompt = `You are a product photography assistant. I am providing an image of a product on a plain background. Generate a single new image that shows this exact same product placed in the following scene.
${productBlock}
Critical: Keep the product identical in every way: same shape, colors, and all details. Preserve any text, labels, logos, or branding on the product exactly as they appear in the source image—do not blur, distort, redraw, or alter any text or graphics on the product. Only the background and context around the product should change.
${buildRealismRules(sceneDescription)}

Output one image only, photorealistic, high quality.`;

  let response;
  const modelId = vertexOptions.model || process.env.LIFESTYLE_VERTEX_MODEL || 'gemini-2.5-flash-image';
  try {
    response = await client.models.generateContent({
      model: modelId,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
        candidateCount: 1,
      },
    });
  } catch (vertexErr) {
    const msg = vertexErr?.message || String(vertexErr);
    console.error('Vertex AI generateContent error:', msg, vertexErr?.status, vertexErr?.code);
    if (msg.includes('404') || msg.includes('NOT_FOUND')) {
      throw new Error('Modèle Gemini image non disponible dans cette région. Vérifiez Vertex AI et la région (europe-west1).');
    }
    if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
      throw new Error('Accès Vertex AI refusé. Vérifiez les permissions du compte de service Cloud Run.');
    }
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('Quota Vertex AI dépassé. Réessayez plus tard.');
    }
    throw new Error(`Vertex AI : ${msg}`);
  }

  const parts = response?.candidates?.[0]?.content?.parts;
  if (!parts || !parts.length) {
    const blockReason = response?.candidates?.[0]?.finishReason || response?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Vertex a bloqué la génération (${blockReason}). Essayez une autre scène ou une image plus simple.`);
    }
    throw new Error('Vertex n\'a pas retourné d\'image. Réessayez ou utilisez un autre type de scène.');
  }

  let imageBuffer = null;
  let outMime = 'image/png';
  for (const part of parts) {
    if (part.inlineData && part.inlineData.data) {
      imageBuffer = Buffer.from(part.inlineData.data, 'base64');
      outMime = part.inlineData.mimeType || 'image/png';
      break;
    }
  }
  if (!imageBuffer) {
    throw new Error('Aucune image dans la réponse Vertex.');
  }

  const url = await uploadGeneratedImageToGCS(imageBuffer, outMime);
  return { url, contentType: outMime };
}

// ---------- Vertex Imagen (edit : remplacement de fond) ----------
/**
 * Appel à l'API Vertex AI Predict pour Imagen 3 edit (EDIT_MODE_BGSWAP).
 * Préserve le premier plan (produit) et remplace l'arrière-plan selon le prompt.
 */
async function getVertexAccessToken() {
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error('Impossible d\'obtenir un token Vertex AI');
  return tokenResponse.token;
}

async function generateLifestyleImageImagen(productImageUrl, sceneDescription, imageData, fetchOptions = {}, imagenOptions = {}) {
  const { base64, mimeType } = await resolveProductImage(productImageUrl, imageData, fetchOptions);
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'feedplug-prod';
  const location = process.env.GOOGLE_CLOUD_LOCATION_IMAGE || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const modelId = imagenOptions.model || IMAGEN_EDIT_MODEL;
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;
  const productBlock = buildProductContextBlock(imagenOptions.productContext, imagenOptions.productDescription);

  // BGSWAP : deux références (base + masque). MASK_MODE_BACKGROUND = masque auto (arrière-plan à remplacer).
  const body = {
    instances: [
      {
        prompt: `Replace the background around this product while keeping the product unchanged.
${productBlock}
${buildRealismRules(sceneDescription)}
Photorealistic, high quality.`,
        referenceImages: [
          {
            referenceType: 'REFERENCE_TYPE_RAW',
            referenceId: 1,
            referenceImage: { bytesBase64Encoded: base64 },
          },
          {
            referenceType: 'REFERENCE_TYPE_MASK',
            referenceId: 2,
            referenceImage: { bytesBase64Encoded: base64 },
            maskImageConfig: {
              maskMode: 'MASK_MODE_BACKGROUND',
              dilation: 0,
            },
          },
        ],
      },
    ],
    parameters: {
      editMode: 'EDIT_MODE_BGSWAP',
      sampleCount: 1,
      addWatermark: false,
    },
  };

  const token = await getVertexAccessToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMsg = `Imagen API: ${res.status} ${res.statusText}`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error?.message) errMsg = errJson.error.message;
    } catch (_) {}
    if (res.status === 404) errMsg = 'Modèle Imagen non disponible dans cette région. Essayez us-central1.';
    if (res.status === 403) errMsg = 'Accès Vertex AI refusé. Vérifiez les permissions (Vertex AI User).';
    if (res.status === 429) errMsg = 'Quota Imagen dépassé. Réessayez plus tard.';
    throw new Error(errMsg);
  }

  const data = await res.json();
  const predictions = data.predictions;
  if (!predictions?.length || !predictions[0].bytesBase64Encoded) {
    throw new Error('Imagen n\'a pas retourné d\'image.');
  }
  const outB64 = predictions[0].bytesBase64Encoded;
  const outMime = predictions[0].mimeType || 'image/png';
  const imageBuffer = Buffer.from(outB64, 'base64');
  const uploadedUrl = await uploadGeneratedImageToGCS(imageBuffer, outMime);
  return { url: uploadedUrl, contentType: outMime };
}

// ---------- Dispatcher ----------
/**
 * Génère une image lifestyle à partir d'une image produit.
 * Utilise Vertex (GCP) si LIFESTYLE_IMAGE_PROVIDER=vertex, sinon Fal (Bria).
 *
 * @param {string} [productImageUrl] - URL de l'image produit (optionnel si options.imageBase64 fourni)
 * @param {string} sceneDescription - Description de la scène (anglais)
 * @param {Object} options - Options : imageBase64, imageMimeType (contournent le téléchargement), placement, numResults pour Fal
 * @returns {Promise<{ url: string, contentType?: string }>}
 */
async function generateLifestyleImage(productImageUrl, sceneDescription, options = {}) {
  if (!sceneDescription) {
    throw new Error('sceneDescription est requis');
  }
  const imageData = options.imageBase64
    ? { base64: options.imageBase64, mimeType: options.imageMimeType || 'image/jpeg' }
    : null;
  if (!productImageUrl && !imageData?.base64) {
    throw new Error('imageUrl ou imageBase64 (dans options) requis');
  }

  const fetchOptions = options.refererOrigin ? { refererOrigin: options.refererOrigin } : {};
  const vertexOptions = {};
  if (options.productContext) vertexOptions.productContext = options.productContext;
  if (options.productDescription) vertexOptions.productDescription = options.productDescription;
  if (options.model) vertexOptions.model = options.model;
  const defaultProvider = (process.env.LIFESTYLE_IMAGE_PROVIDER || 'vertex').toLowerCase();
  const provider = (options.provider && String(options.provider).toLowerCase()) || defaultProvider;
  const modelId = (options.model || process.env.LIFESTYLE_VERTEX_MODEL || 'gemini-2.5-flash-image').toLowerCase();
  // Imagen 3 edit (capability) ou tout id "imagen-*-capability*" → flux Imagen (remplacement de fond)
  const useImagen = modelId === IMAGEN_EDIT_MODEL || (modelId.startsWith('imagen-') && modelId.includes('capability'));
  if (provider === 'vertex') {
    if (useImagen) {
      return generateLifestyleImageImagen(productImageUrl, sceneDescription, imageData, fetchOptions, vertexOptions);
    }
    return generateLifestyleImageVertex(productImageUrl, sceneDescription, imageData, fetchOptions, vertexOptions);
  }
  // Fal (désactivé si on utilise uniquement la suite Google)
  if (imageData?.base64) {
    const buffer = Buffer.from(imageData.base64, 'base64');
    const tempUrl = await uploadGeneratedImageToGCS(buffer, imageData.mimeType);
    return generateLifestyleImageFal(tempUrl, sceneDescription, options);
  }
  return generateLifestyleImageFal(productImageUrl, sceneDescription, options);
}

module.exports = {
  generateLifestyleImage,
  generateLifestyleImageFal,
  generateLifestyleImageVertex,
  generateLifestyleImageImagen,
  downloadImageAsBase64,
  PRESET_SCENES,
  IMAGEN_EDIT_MODEL,
};
