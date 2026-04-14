# Prochaines étapes — FeedPlug

**Référence principale** : **[docs/NEXT_STEPS.md](docs/NEXT_STEPS.md)** (opérationnel, i18n, roadmap).

---

## Après déploiement (vérifications rapides)

1. **Backend déployé**  
   Récupérer l’URL Cloud Run :
   ```bash
   gcloud run services describe feedplug-backend-marketing --region=europe-west1 --format='value(status.url)' --project=feedplug-prod
   ```
   Tester : `GET BASE_URL/api/v1/platforms/amazon/channels/available` (sans auth).  
   S’assurer que le frontend pointe vers cette URL (`NEXT_PUBLIC_API_URL`).

2. **Export GMC**  
   Depuis l’app : Flux → Télécharger CSV. Vérifier que l’export fonctionne.

3. **Optionnel**  
   - Amazon sur la page Flux : menu « Télécharger CSV » → Amazon FR / UK / … (voir `docs/NEXT_STEPS.md`).  
   - Sentry / logs : vérifier remontée des erreurs (`SENTRY_ALERTES.md`).

---

| Élément              | Statut |
|----------------------|--------|
| Migration 013         | OK     |
| Backend Cloud Run     | OK     |
| Export CSV GMC         | OK     |
| Export CSV Amazon API | OK     |
| UI Flux : Amazon      | À brancher (optionnel) |
