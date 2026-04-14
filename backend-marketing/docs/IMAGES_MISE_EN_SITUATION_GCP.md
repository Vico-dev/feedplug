# Images mise en situation : Fal vs GCP (Nano Banana / Imagen)

**Implémenté** : le backend supporte les deux providers. Par défaut en prod : **Vertex** (`LIFESTYLE_IMAGE_PROVIDER=vertex`). Aucune clé Fal nécessaire ; le compte de service Cloud Run doit avoir le rôle **Vertex AI User** sur le projet.

## Pourquoi passer par GCP ?

- **Un seul cloud** : projet `feedplug-prod`, facturation et IAM déjà en place.
- **Pas de clé externe** : plus besoin de `FAL_KEY` dans Secret Manager ; le backend Cloud Run utilise les **Application Default Credentials** (compte de service).
- **Images en GCS** : Vertex accepte `gcsUri` pour l’image produit → pas obligé d’exposer une URL publique, on peut mettre l’image dans ton bucket.

---

## Options GCP

### 1. Imagen « product recontext » (Vertex AI) – le plus proche de Bria

- **Usage** : même cas que Bria : image produit + prompt texte → image du produit dans une nouvelle scène.
- **API** : `POST .../publishers/google/models/imagen-product-recontext-preview-06-30:predict`
- **Entrée** : `productImages[]` avec **`bytesBase64Encoded`** ou **`gcsUri`** (image dans un bucket GCS) + `prompt` (ex. "in a modern living room, natural light").
- **Sortie** : images en base64 ou écrites dans un `storageUri` GCS.
- **Contrainte** : accès en **preview**, soumis au formulaire [Vertex AI - Generative Media for Marketing Access Request](https://docs.google.com/forms/d/e/1FAIpQLSdpvBKYIT2bplPuc4KJCOn6S8fHZmk7NuVo0FuVdfhTrooSYg/viewform).

**Résumé** : idéal fonctionnellement et 100 % GCP (auth + GCS), mais il faut obtenir l’accès.

---

### 2. Nano Banana / Gemini image (Vertex AI)

- **Modèles** : ex. `gemini-2.5-flash-image` (Nano Banana), ou `gemini-3-pro-image-preview` (Nano Banana Pro).
- **Usage** : génération d’images (texte → image) et **édition d’images** (image + instruction).
- **Auth** : Vertex AI = même projet GCP, pas de clé Fal.
- **Intérêt** : pas de formulaire d’accès spécifique comme pour Imagen product recontext ; si Vertex AI est déjà activé, tu peux appeler le modèle d’image depuis Node (SDK `@google-cloud/vertexai` ou API REST).

Pour un « produit dans une scène », il faudra utiliser le flux **image + prompt** (édition / récontextualisation) selon la doc Vertex « Edit images with Gemini ». À valider selon les caps exacts du modèle (entrée image + texte, sortie image).

---

### 3. Fal Bria (actuel)

- **Avantage** : opérationnel tout de suite, modèle dédié « product shot ».
- **Inconvénient** : clé externe (`FAL_KEY`), et l’**URL produit doit être publique** (sinon 422). Pas de `gcsUri` natif.

---

## Recommandation

1. **Court terme** : garder Fal pour la mise en situation tant que l’accès Imagen product recontext n’est pas validé.
2. **Dès que possible** :  
   - Remplir le formulaire d’accès **Imagen product recontext** (Vertex AI).  
   - Quand c’est accordé : ajouter un provider **Vertex Imagen (product recontext)** dans le backend, avec entrée `gcsUri` (ou base64) + prompt, auth via ADC.  
   - Optionnel : proposer un **choix de provider** (Fal vs Vertex) en config ou en env (ex. `LIFESTYLE_IMAGE_PROVIDER=vertex|fal`).
3. **Alternative sans formulaire** : si tu veux tout de suite du 100 % GCP sans attendre Imagen, explorer **Gemini image (Nano Banana)** sur Vertex pour un flux « image + prompt → image » et, si la qualité suffit, l’utiliser en parallèle ou en remplacement de Fal.

En résumé : **oui, c’est plus simple côté intégration de tout faire avec GCP** (Nano Banana / Imagen sur Vertex) : un seul cloud, pas de clé Fal, et possibilité d’utiliser des images en GCS. La solution la plus alignée avec Bria est **Imagen product recontext**, une fois l’accès obtenu ; sinon, **Nano Banana (Gemini image)** sur Vertex est la voie la plus directe sans formulaire.

---

## Modèles disponibles et évolution

- **Nano Banana** = **Gemini 2.5 Flash Image** (`gemini-2.5-flash-image`) : flux image + texte → image via `generateContent` (Vertex global). **Proposé par défaut dans le sélecteur** sous le nom « Nano Banana (Gemini 2.5 Flash Image) — Recommandé » pour un accès direct aux super perfs.
- **Nano Banana Preview** (`gemini-2.5-flash-preview-05-20`) : variante preview, même usage.
- **Imagen 3** (`imagen-3.0-capability-001`) : flux **remplacement de fond** (EDIT_MODE_BGSWAP) via l’API Predict Imagen. Préserve le produit et remplace l’arrière-plan selon la scène. Région recommandée : **us-central1** (variable `GOOGLE_CLOUD_LOCATION_IMAGE`).
- **Imagen 4 (remplacement de fond)** (`imagen-4.0-capability`) : pour l’instant routé vers le même moteur qu’Imagen 3 (capability edit). Un vrai modèle Imagen 4 edit sera branché quand disponible.
- **Gemini 2.0 Flash** : ne génère pas d’images avec notre API, non listé.
- **Enrichir le sélecteur** : ajouter une entrée dans `LIFESTYLE_GCP_MODELS` dans `frontend/src/components/catalog/product-drawer.tsx`. Le backend route selon l’id : Gemini → `generateContent`, id contenant `imagen-` et `capability` → Imagen edit (predict BGSWAP).

---

## Implémentation actuelle

- **Provider** : `LIFESTYLE_IMAGE_PROVIDER=vertex` (défaut).
- **Vertex Gemini** : modèle `gemini-2.5-flash-image`, endpoint **global** (`GOOGLE_CLOUD_LOCATION_IMAGE=global`). Image produit + prompt → image générée, upload GCS `lifestyle/*.png`.
- **Vertex Imagen** : modèle `imagen-3.0-capability-001`, endpoint **régional** (ex. `us-central1`). Requête Predict avec `EDIT_MODE_BGSWAP`, masque arrière-plan auto (`MASK_MODE_BACKGROUND`). Même upload GCS.
- **Droits** : le compte de service Cloud Run doit avoir le rôle **Vertex AI User** (`roles/aiplatform.user`) sur le projet. À faire dans GCP : IAM et administration → feedplug-prod → trouver le compte de service Cloud Run (ex. `...@feedplug-prod.iam.gserviceaccount.com`) → Ajouter un autre rôle → **Vertex AI User**. Activer l’**API Vertex AI** pour le projet si ce n’est pas déjà fait.
- **Si timeout / erreur** : consulter les logs Cloud Run (onglet Logs) pour le message exact (ex. 403 = permissions, 404 = modèle ou région).

### Accorder Vertex AI User au compte de service Cloud Run

```bash
# Récupérer l'email du compte de service Cloud Run (ex. 771607738477-compute@developer.gserviceaccount.com)
gcloud run services describe feedplug-backend-marketing --region=europe-west1 --project=feedplug-prod --format='value(spec.template.spec.serviceAccountName)'

# Si vide, le compte par défaut est PROJECT_NUMBER-compute@developer.gserviceaccount.com
# Puis ajouter le rôle Vertex AI User :
gcloud projects add-iam-policy-binding feedplug-prod \
  --member="serviceAccount:VOTRE_EMAIL_CI_DESSUS" \
  --role="roles/aiplatform.user"
```
