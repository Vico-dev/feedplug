/**
 * Gestionnaire de cache pour les résultats IA
 * Évite les appels API redondants en stockant les résultats
 */

const crypto = require('crypto');

/**
 * Génère un hash des inputs pour identifier les requêtes identiques
 */
function hashInputs(operation, inputs) {
  const inputString = JSON.stringify({ operation, ...inputs });
  return crypto.createHash('sha256').update(inputString).digest('hex');
}

/**
 * Vérifie si un résultat existe dans le cache
 * @param {Object} prisma - Instance Prisma
 * @param {string} providerId - ID du provider (ex: 'gemini')
 * @param {string} operation - Type d'opération (ex: 'title_optimization')
 * @param {Object} inputs - Inputs de la requête
 * @returns {Promise<Object|null>} - Résultat en cache ou null
 */
async function getCachedResult(prisma, providerId, operation, inputs) {
  try {
    const inputHash = hashInputs(operation, inputs);
    
    const cached = await prisma.aICache.findUnique({
      where: {
        providerId_operation_inputHash: {
          providerId,
          operation,
          inputHash,
        },
      },
    });

    // Vérifier si le cache n'est pas expiré
    if (cached && new Date(cached.expiresAt) > new Date()) {
      // Le résultat est stocké en JSONB, le retourner tel quel
      // (Prisma le désérialise automatiquement)
      return cached.result;
    }

    // Supprimer les entrées expirées
    if (cached) {
      await prisma.aICache.delete({
        where: { id: cached.id },
      });
    }

    return null;
  } catch (error) {
    console.error('Error getting cached result:', error);
    return null;
  }
}

/**
 * Stocke un résultat dans le cache
 * @param {Object} prisma - Instance Prisma
 * @param {string} providerId - ID du provider
 * @param {string} operation - Type d'opération
 * @param {Object} inputs - Inputs de la requête
 * @param {Object} result - Résultat à stocker
 * @param {number} ttlDays - Durée de vie en jours (défaut: 30)
 */
async function setCachedResult(prisma, providerId, operation, inputs, result, ttlDays = 30) {
  try {
    const inputHash = hashInputs(operation, inputs);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    // S'assurer que le résultat est sérialisable (string ou objet)
    const serializableResult = typeof result === 'string' ? result : result;
    
    await prisma.aICache.upsert({
      where: {
        providerId_operation_inputHash: {
          providerId,
          operation,
          inputHash,
        },
      },
      create: {
        providerId,
        operation,
        inputHash,
        result: serializableResult, // Prisma sérialise automatiquement en JSONB
        expiresAt,
      },
      update: {
        result: serializableResult,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Error setting cached result:', error);
    // Ne pas faire échouer la requête si le cache échoue
  }
}

/**
 * Nettoie les entrées de cache expirées
 * @param {Object} prisma - Instance Prisma
 */
async function cleanExpiredCache(prisma) {
  try {
    const deleted = await prisma.aICache.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    console.log(`🧹 Nettoyage cache: ${deleted.count} entrées supprimées`);
    return deleted.count;
  } catch (error) {
    console.error('Error cleaning expired cache:', error);
    return 0;
  }
}

module.exports = {
  hashInputs,
  getCachedResult,
  setCachedResult,
  cleanExpiredCache,
};

