/**
 * 🖼️ Module d'Optimisation des Images Produits
 * 
 * Optimise les images pour réduire le poids, améliorer la qualité et respecter
 * les standards des plateformes (Google Merchant Center, Meta, Amazon).
 * 
 * Features:
 * - Compression WebP/JPEG (économie 60-70% de poids)
 * - Resize multi-tailles par plateforme
 * - Validation fond blanc (requis GMC)
 * - Génération miniatures
 * - Upload automatique vers Cloud Storage
 */

const sharp = require('sharp');
const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');

const storage = new Storage();
const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'feedplug-uploads';

// Tailles recommandées par plateforme
const PLATFORM_SIZES = {
  GMC: {
    min: 100,
    recommended: 800,
    max: 64000,
    ratios: ['1:1', '4:3', '16:9'] // Ratios acceptés
  },
  META: {
    min: 500,
    recommended: 1200,
    max: 8000,
    ratios: ['1:1'] // Facebook préfère carré
  },
  AMAZON: {
    min: 500,
    recommended: 1000,
    max: 10000,
    ratios: ['1:1']
  },
  PINTEREST: {
    min: 600,
    recommended: 1000,
    max: 10000,
    ratios: ['2:3', '1:1'] // Pinterest préfère vertical
  }
};

// Générations de tailles multiples
const THUMBNAIL_SIZES = [100, 300, 800, 1200];

/**
 * Télécharge une image depuis une URL
 */
async function downloadImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    throw new Error(`Échec téléchargement image: ${error.message}`);
  }
}

/**
 * Optimise une image complète (compression + resize + validation)
 * 
 * @param {string} imageUrl - URL de l'image source
 * @param {Object} options - Options (platform, quality, format)
 * @returns {Promise<Object>} Résultat avec URLs optimisées et statistiques
 */
async function optimizeImage(imageUrl, options = {}) {
  const platform = options.platform || 'GMC';
  const quality = options.quality || 85;
  const targetFormat = options.format || 'webp'; // webp ou jpeg
  
  try {
    // 1. Télécharger l'image originale
    console.log(`📥 Téléchargement image: ${imageUrl}`);
    const originalBuffer = await downloadImage(imageUrl);
    
    // 2. Analyser l'image
    const metadata = await sharp(originalBuffer).metadata();
    const originalSize = originalBuffer.length;
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;
    
    console.log(`📊 Image originale: ${originalWidth}x${originalHeight}, ${(originalSize / 1024).toFixed(0)} KB, format: ${metadata.format}`);
    
    // 3. Valider le fond blanc (requis GMC)
    const hasWhiteBackground = await detectWhiteBackground(originalBuffer);
    
    // 4. Générer les versions optimisées
    const platformConfig = PLATFORM_SIZES[platform] || PLATFORM_SIZES.GMC;
    const optimized = {};
    
    // Version principale (recommandée pour la plateforme)
    const mainSize = platformConfig.recommended;
    const mainOptimized = await compressAndResize(
      originalBuffer,
      mainSize,
      mainSize,
      quality,
      targetFormat,
      hasWhiteBackground
    );
    
    // Upload vers Cloud Storage
    const mainFilename = `optimized-images/${crypto.randomUUID()}-${mainSize}.${targetFormat}`;
    const mainUrl = await uploadToGCS(mainOptimized.buffer, mainFilename, `image/${targetFormat}`);
    
    optimized.main = {
      url: mainUrl,
      width: mainOptimized.width,
      height: mainOptimized.height,
      size: mainOptimized.size,
      format: targetFormat,
      compression: ((1 - mainOptimized.size / originalSize) * 100).toFixed(1) + '%'
    };
    
    // 5. Générer les miniatures
    const thumbnails = {};
    for (const size of THUMBNAIL_SIZES) {
      if (size === mainSize) continue; // Déjà fait
      
      const thumbnail = await compressAndResize(
        originalBuffer,
        size,
        size,
        quality,
        targetFormat,
        hasWhiteBackground
      );
      
      const thumbFilename = `optimized-images/${crypto.randomUUID()}-${size}.${targetFormat}`;
      const thumbUrl = await uploadToGCS(thumbnail.buffer, thumbFilename, `image/${targetFormat}`);
      
      thumbnails[`${size}px`] = {
        url: thumbUrl,
        width: thumbnail.width,
        height: thumbnail.height,
        size: thumbnail.size
      };
    }
    
    // 6. Retourner le résultat complet
    return {
      success: true,
      original: {
        url: imageUrl,
        width: originalWidth,
        height: originalHeight,
        size: originalSize,
        format: metadata.format
      },
      optimized: optimized.main,
      thumbnails: thumbnails,
      validation: {
        hasWhiteBackground: hasWhiteBackground,
        gmcCompliant: hasWhiteBackground && originalWidth >= 100 && originalHeight >= 100,
        warnings: !hasWhiteBackground ? ['Fond non blanc détecté (requis GMC)'] : []
      },
      statistics: {
        originalSizeKB: (originalSize / 1024).toFixed(0),
        optimizedSizeKB: (optimized.main.size / 1024).toFixed(0),
        compressionRate: optimized.main.compression,
        thumbnailsGenerated: Object.keys(thumbnails).length
      }
    };
    
  } catch (error) {
    console.error('Erreur optimisation image:', error);
    return {
      success: false,
      error: error.message,
      original: { url: imageUrl }
    };
  }
}

/**
 * Compresse et resize une image
 */
async function compressAndResize(buffer, maxWidth, maxHeight, quality, format, ensureWhiteBackground) {
  let pipeline = sharp(buffer);
  
  // Resize en conservant le ratio
  pipeline = pipeline.resize(maxWidth, maxHeight, {
    fit: 'inside', // Conserver le ratio
    withoutEnlargement: true, // Ne pas agrandir si plus petit
    background: ensureWhiteBackground ? { r: 255, g: 255, b: 255, alpha: 1 } : undefined
  });
  
  // Si fond blanc requis et non détecté, ajouter un fond blanc
  if (ensureWhiteBackground === false) {
    pipeline = pipeline.flatten({ background: '#ffffff' });
  }
  
  // Compression selon le format
  if (format === 'webp') {
    pipeline = pipeline.webp({ quality: quality, effort: 4 });
  } else {
    pipeline = pipeline.jpeg({ quality: quality, progressive: true });
  }
  
  const optimizedBuffer = await pipeline.toBuffer();
  const optimizedMetadata = await sharp(optimizedBuffer).metadata();
  
  return {
    buffer: optimizedBuffer,
    width: optimizedMetadata.width,
    height: optimizedMetadata.height,
    size: optimizedBuffer.length,
    format: format
  };
}

/**
 * Détecte si une image a un fond blanc (ou très clair)
 */
async function detectWhiteBackground(buffer) {
  try {
    // Analyser les pixels du bord de l'image
    const { data, info } = await sharp(buffer)
      .resize(100, 100, { fit: 'fill' }) // Petite taille pour rapidité
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    const channels = info.channels;
    
    // Échantillonner les pixels du bord (10% du périmètre)
    const borderPixels = [];
    const sampleSize = Math.floor(width * 0.1);
    
    // Bord haut et bas
    for (let x = 0; x < width; x += 5) {
      for (let y = 0; y < sampleSize; y += 2) {
        const idx = (y * width + x) * channels;
        borderPixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
        
        const bottomIdx = ((height - 1 - y) * width + x) * channels;
        borderPixels.push({ r: data[bottomIdx], g: data[bottomIdx + 1], b: data[bottomIdx + 2] });
      }
    }
    
    // Calculer la moyenne des pixels du bord
    const avg = borderPixels.reduce((acc, pixel) => ({
      r: acc.r + pixel.r,
      g: acc.g + pixel.g,
      b: acc.b + pixel.b
    }), { r: 0, g: 0, b: 0 });
    
    avg.r /= borderPixels.length;
    avg.g /= borderPixels.length;
    avg.b /= borderPixels.length;
    
    // Fond blanc si RGB > 240 (tolérance pour légèrement grisé)
    const isWhite = avg.r > 240 && avg.g > 240 && avg.b > 240;
    
    return isWhite;
  } catch (error) {
    console.warn('Erreur détection fond blanc:', error.message);
    return null; // Inconnu
  }
}

/**
 * Upload vers Google Cloud Storage
 */
async function uploadToGCS(buffer, filename, contentType) {
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filename);
    
    await file.save(buffer, {
      metadata: {
        contentType: contentType,
        cacheControl: 'public, max-age=31536000', // 1 an
      },
    });
    
    // Rendre public
    await file.makePublic();
    
    // URL publique
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${filename}`;
    
    return publicUrl;
  } catch (error) {
    throw new Error(`Échec upload GCS: ${error.message}`);
  }
}

/**
 * Optimise plusieurs images en batch
 */
async function optimizeImagesBatch(imageUrls, options = {}) {
  const results = [];
  
  for (const url of imageUrls) {
    try {
      const result = await optimizeImage(url, options);
      results.push({
        originalUrl: url,
        ...result
      });
    } catch (error) {
      console.error(`Erreur optimisation ${url}:`, error);
      results.push({
        originalUrl: url,
        success: false,
        error: error.message
      });
    }
  }
  
  return {
    total: imageUrls.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    totalCompressionKB: results
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.original.size - r.optimized.size) / 1024, 0)
      .toFixed(0),
    results: results
  };
}

/**
 * Valide qu'une image respecte les standards GMC
 */
function validateImageForGMC(metadata) {
  const issues = [];
  const warnings = [];
  
  // Taille minimum
  if (metadata.width < 100 || metadata.height < 100) {
    issues.push('Image trop petite (minimum 100x100 px pour GMC)');
  }
  
  // Taille recommandée
  if (metadata.width < 800 || metadata.height < 800) {
    warnings.push('Image inférieure à 800x800 px (recommandé GMC)');
  }
  
  // Ratio
  const ratio = metadata.width / metadata.height;
  if (ratio > 3 || ratio < 0.33) {
    warnings.push('Ratio image non optimal (recommandé: entre 1:3 et 3:1)');
  }
  
  // Poids
  if (metadata.size > 16 * 1024 * 1024) {
    issues.push('Image trop lourde (maximum 16 MB pour GMC)');
  }
  
  return {
    valid: issues.length === 0,
    issues: issues,
    warnings: warnings
  };
}

module.exports = {
  optimizeImage,
  optimizeImagesBatch,
  detectWhiteBackground,
  validateImageForGMC,
  PLATFORM_SIZES
};
