# 🎯 Stratégie d'Optimisation des Titres Produits

## Approche Recommandée : Hybride (Règles + IA)

### Pourquoi une approche hybride ?

1. **Coût** : Les APIs IA coûtent de l'argent par requête. Pour 10k produits, ça peut vite monter.
2. **Performance** : Les règles basiques sont instantanées, l'IA prend du temps.
3. **Qualité** : Pour 80% des cas, les règles suffisent. L'IA pour les 20% complexes.
4. **Flexibilité** : L'utilisateur choisit quand utiliser l'IA.

---

## 📋 Niveaux d'Optimisation

### Niveau 1 : Règles Basiques (Gratuit, Instantané) ✅ DÉJÀ IMPLÉMENTÉ

**Quand l'utiliser :**
- Produits avec données structurées (marque, couleur, taille, etc.)
- Cas standards (80% des produits)

**Comment ça marche :**
- Format : `[Marque] [Type] [Couleur] [Taille]`
- Extraction intelligente du type de produit
- Respect des règles GMC (150 caractères max, mots interdits, etc.)

**Avantages :**
- ✅ Gratuit
- ✅ Instantané
- ✅ Prévisible
- ✅ Conforme GMC

**Exemple :**
```
Input:  "T-shirt"
Output: "Nike – T-shirt – Bleu – M"
```

---

### Niveau 2 : IA Générative (Payant, ~1-2s par produit)

**Quand l'utiliser :**
- Produits complexes sans données structurées
- Titres existants de mauvaise qualité
- Optimisation SEO avancée
- Quand l'utilisateur demande explicitement

**APIs à considérer :**

#### Option A : Google Gemini (Recommandé) ⭐
- **Pourquoi** : Google = GMC, donc alignement naturel
- **Coût** : ~$0.0001-0.001 par requête (Gemini Pro)
- **Avantages** : 
  - Compréhension native des règles GMC
  - Support français excellent
  - API simple
- **Inconvénients** : Dépendance Google

#### Option B : OpenAI GPT-4o Mini
- **Pourquoi** : Très performant, bon marché
- **Coût** : ~$0.00015 par requête (GPT-4o Mini)
- **Avantages** :
  - Très bon en français
  - Flexible
- **Inconvénients** : Pas spécifiquement optimisé pour GMC

#### Option C : Mistral AI
- **Pourquoi** : Français, open-source friendly
- **Coût** : ~$0.0001-0.0002 par requête
- **Avantages** :
  - Made in France
  - Bon rapport qualité/prix
- **Inconvénients** : Moins mature que GPT/Gemini

#### Option D : Claude (Anthropic)
- **Pourquoi** : Excellent en compréhension contextuelle
- **Coût** : ~$0.0003-0.001 par requête
- **Avantages** :
  - Très bon en français
  - Compréhension contextuelle
- **Inconvénients** : Plus cher

---

## 🎯 Recommandation Finale

### Phase 1 : MVP (Maintenant)
✅ **Règles basiques uniquement** (déjà implémenté)
- Fonctionne pour 80% des cas
- Gratuit et instantané
- Permet de valider le concept

### Phase 2 : Amélioration (Semaine prochaine)
🔧 **Ajouter Gemini API** comme option premium
- Option "Optimiser avec IA" dans l'interface
- Utilisation optionnelle (pas automatique)
- Facturation séparée pour l'IA

### Phase 3 : Optimisation (Plus tard)
🚀 **Fine-tuning ou modèle propre**
- Si volume très élevé (>100k produits/mois)
- Si coûts IA deviennent prohibitifs
- Si besoin de règles très spécifiques

---

## 💡 Implémentation Recommandée

### Structure du Code

```javascript
// optimization/title-gmc.js (déjà fait)
function generateOptimizedTitle(productData) {
  // Règles basiques - toujours disponible
}

async function optimizeTitleWithAI(title, productData, apiKey) {
  // Appel API IA - optionnel
  // Par défaut: Gemini
  // Fallback: GPT-4o Mini si Gemini échoue
}
```

### Interface Utilisateur

1. **Dans le catalogue** :
   - Bouton "Optimiser les titres" (règles basiques)
   - Option "Optimiser avec IA" (payant, checkbox)

2. **Dans les détails produit** :
   - Section "Optimisation titre"
   - Aperçu avant/après
   - Score d'amélioration
   - Option IA disponible

3. **En masse** :
   - Sélection multiple
   - Choix : Règles basiques OU IA
   - Prévisualisation avant application

---

## 💰 Modèle de Facturation

### Option 1 : Inclus dans le plan
- Starter : Règles basiques uniquement
- Pro : 1000 optimisations IA/mois incluses
- Enterprise : Illimité

### Option 2 : Pay-per-use
- Règles basiques : Gratuit
- IA : $0.01 par optimisation
- Pack de 100 : $0.50 (50% de réduction)

---

## 📐 Conformité Google Merchant Center

Les titres et descriptions générés par l’IA sont alignés sur les [guidelines GMC](https://support.google.com/merchants/answer/7052112) via :

- **`optimization/gmc-guidelines.js`** : règles injectées dans les prompts (titres et descriptions) + post-traitement.
- **Titres** : infos importantes en début de titre, pas de contenu promotionnel, max 150 caractères ; après génération, suppression des résidus promo et normalisation des majuscules.
- **Descriptions** : contenu factuel (caractéristiques, specs, attributs visuels), pas de claims non vérifiables ni de promo ; léger nettoyage post-génération.

---

## 🔧 Prochaines Étapes

1. ✅ Implémenter les règles basiques (FAIT)
2. ⏳ Ajouter support Gemini API
3. ⏳ Interface pour choisir règles vs IA
4. ⏳ Prévisualisation avant/après
5. ⏳ Application en masse
6. ⏳ Tracking des optimisations IA (facturation)

---

## 📊 Métriques à Suivre

- Taux d'amélioration moyen (score avant/après)
- Taux d'adoption IA vs règles
- Coût par optimisation IA
- Satisfaction utilisateur
- Impact sur les performances GMC (si données disponibles)






