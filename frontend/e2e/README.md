# Tests E2E (Playwright)

## Lancer les tests

```bash
cd frontend
npm run test:e2e
```

En local, le config démarre le serveur de dev (`npm run dev`) si besoin. Pour utiliser une URL déjà en marche :

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
```

## Premier lancement

Installer les navigateurs Playwright une fois :

```bash
npx playwright install
```

## Fichiers

- `catalogue-product.spec.ts` : page catalogue (titre, recherche), fiche produit (onglets Résumé / Qualité / Champs / Enrichissement).

Les tests s’appuient sur une session connectée (catalogue et fiche accessibles). S’ils arrivent sur `/login`, ils sont ignorés (`test.skip()`).
