# Images secondaires « mise en situation » par IA

## Idée

À partir d’un **visuel produit sur fond blanc** (image principale), générer des **images secondaires** où le produit est placé en **mise en situation** (lifestyle) : intérieur, extérieur, avec modèle, contexte d’usage, etc.

**Pertinence :**
- **Conversion** : les visuels lifestyle améliorent souvent le taux de clic et la conversion (étude Google, Meta).
- **Qualité feed** : GMC et Amazon valorisent les fiches avec **plusieurs images** (dont contexte d’usage).
- **Différenciation** : beaucoup de catalogues n’ont que le produit sur fond blanc ; ajouter 1–2 mises en situation sans photo studio est un vrai plus.

---

## Coûts (ordre de grandeur 2024–2025)

| Solution | Type | Coût par image | Commentaire |
|----------|------|----------------|-------------|
| **Replicate** (SDXL, img2img) | Générique | **~$0.002 – 0.003** | Pas dédié produit ; prompt "place product in scene". Qualité variable. |
| **Nano Banana** (Gemini) | Générique | **~$0.02** | Génération image ; à utiliser en img2img / "product in scene" si exposé. |
| **Nano Banana Pro** | Générique | **~$0.10** | Idem, qualité supérieure. |
| **Fal.ai – Bria Product Shot** | **Dédié e‑commerce** | **$0.04** | Modèle entraîné pour **produit sur fond blanc → scène** ; préserve le produit, usage commercial. |
| **FLUX** (Schnell / Dev via APIs) | Générique | **$0.0015 – 0.02** | Selon modèle ; img2img possible, pas spécifique produit. |

**En résumé :**
- **Pas cher** : Replicate ou FLUX Schnell → **~$0.002–0.003/image** (il faudra bien maîtriser le prompt et accepter une qualité variable).
- **Bon rapport qualité/prix pour l’e‑commerce** : **Fal.ai Bria Product Shot à $0.04/image** – dédié « produit → mise en situation », intégrité du produit.
- **Nano Banana** : dans la fourchette **$0.02–0.10/image** selon le tier ; pertinent si tu utilises déjà l’écosystème Gemini pour d’autres usages.

Pour **1000 produits** avec 1 image lifestyle chacun :
- Replicate / FLUX bas coût : **~$2–3**.
- Bria Product Shot : **~$40**.
- Nano Banana : **~$20–100** selon option.

---

## Recommandation technique

1. **POC rapide** : Fal.ai **Bria Product Shot** (API simple, résultat prévisible pour produit sur fond blanc).
2. **Si budget serré** : Replicate (SDXL img2img) ou FLUX avec un prompt du type « product on white → same product in [context] » ; prévoir quelques essais pour stabiliser la qualité.
3. **Intégration FeedPlug** :
   - Soit dans **`optimization/image-optimizer.js`** (option `generateLifestyle: true`).
   - Soit module dédié **`optimization/lifestyle-image-generator.js`** qui :
     - prend une URL d’image produit (fond blanc),
     - appelle l’API choisie (Fal / Replicate / Nano Banana),
     - upload le résultat en Cloud Storage,
     - retourne l’URL de l’image secondaire à attacher au produit.

Scénario utilisateur côté front : depuis la fiche produit ou le catalogue, bouton **« Générer une image mise en situation »** (optionnel) → choix du contexte (ex. « intérieur maison », « extérieur », « avec modèle ») → génération puis ajout en image secondaire.

---

## Risques / points d’attention

- **Droits / CGU** : vérifier que le modèle et l’API autorisent un usage **commercial** pour des visuels produits (Bria est prévu pour ça).
- **Cohérence marque** : définir 1–2 contextes par type de produit pour éviter un rendu incohérent.
- **Coût à l’échelle** : au-delà de quelques milliers d’images/mois, négocier un forfait ou un volume avec le fournisseur (Fal, Replicate, etc.).

---

## Mise en place (Fal Bria Product Shot)

**Niveau de difficulté : faible.** L’API est une image in → image out avec un client officiel.

1. **Compte + clé** : créer un compte sur [fal.ai](https://fal.ai), récupérer une clé API. En prod : `FAL_KEY=xxx` dans les variables d’environnement (Cloud Run / .env).
2. **Backend** : installer `npm install @fal-ai/client`. Le module `optimization/lifestyle-image-generator.js` fait : entrée = URL image produit + texte de scène (ex. "in a modern living room, natural light") → appel Bria Product Shot → sortie = URL de l’image générée. Optionnel : upload du résultat vers GCS.
3. **Route API** : `POST /api/v1/enrichment/generate-lifestyle-image` avec body `{ imageUrl, sceneDescription }` (et auth), qui appelle le module et renvoie l’URL.
4. **Front** : bouton « Générer image mise en situation » (fiche produit ou catalogue), liste de scènes prédéfinies (`PRESET_SCENES`), appel à la route, affichage + ajout en image secondaire.

**Points d’attention :** image produit en **URL publique** (ou base64) ; prompts de scène **en anglais** côté Bria ; loading ~quelques secondes.

---

*Doc ajoutée le 18/02/2026 – à mettre à jour selon les tarifs réels au moment de l’implémentation.*
