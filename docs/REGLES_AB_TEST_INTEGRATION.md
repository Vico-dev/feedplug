# Intégration A/B dans le moteur de règles

## Résumé

L’A/B testing est intégré directement dans l’onglet **Optimiser (Règles)**. On peut :
- Créer une règle et cocher **« Lancer en A/B »** : un test est créé (brouillon) lié à cette règle.
- **Témoin (control)** = on n’applique pas la règle ; **Variant** = on applique la règle.
- À l’export, les produits sont répartis selon le test actif (RUNNING) ; les tests « titres IA » restent gérés comme avant (overlay titre).

## Backend

- **Schéma** : `ABTest.ruleId` (optionnel) pointe vers une `Rule`. Si renseigné, le test compare « ne pas appliquer la règle » vs « appliquer la règle ».
- **Migration** : `backend-marketing/prisma/migrations/022_ab_test_rule_id.sql`
- **Création depuis une règle** : `POST /api/v1/ab-tests` avec `ruleId` (et `name`, `platform`, `controlPercent`, `variantPercent`). Les produits sont déduits automatiquement (portée + condition de la règle).
- **Export** : les règles dont un test A/B (RUNNING) est lié n’appliquent l’action que pour les items en bras VARIANT ; les items CONTROL gardent la valeur d’origine pour cette règle.
- **GET /rules** : chaque règle peut inclure `abTest: { id, status, name }` si un test est lié.

## Frontend

- **Modale règle** : section « Lancer en A/B » (toggle + nom du test, canal, % témoin/variant). À l’enregistrement, création de la règle puis du test si la case est cochée.
- **Liste des règles** : badge « A/B actif » / « brouillon » pour les règles avec test ; filtre **« Tests A/B »** pour n’afficher que ces règles.
- **Opérateurs** : opérateurs courants par défaut ; lien « Opérateurs avancés » pour le reste.

## Appliquer la migration

Depuis `backend-marketing` :

```bash
npm run prisma:generate
# Puis exécuter le SQL (selon votre process) ou :
npm run prisma:deploy
```

Si vous appliquez les migrations à la main, exécuter le contenu de `022_ab_test_rule_id.sql` sur la base.
