# Scénario mail — post-audit de flux

Statut : copie à valider avant implémentation. Cible : leads de l'audit de flux
qui ne convertissent pas.

## Segments

Le moteur de nurture détermine le segment via le statut de l'audit du lead :

| Segment | Condition | Objectif |
|---------|-----------|----------|
| **A** — audit non terminé | audit `pending_connection` (formulaire rempli, source jamais connectée) | Faire connecter la source → obtenir le score |
| **B** — audit vu, non converti | audit `ready` (score généré) + pas de compte | Passer de « j'ai vu le problème » à « je le corrige » |
| **C** — pas d'audit | lead sans audit (ex. formulaire early-access) | Séquence générique existante — **aucun mail d'audit** |

Règle : un lead `early-access` sans audit ne reçoit JAMAIS la copie A/B.

## Règles de sortie

- **Conversion** : à l'inscription, le lead passe `converted` / `completed` →
  séquence stoppée automatiquement (déjà en place).
- **Désinscription** : lien unsubscribe (déjà en place).

## Variables de personnalisation

`{{prenom}}` · `{{societe}}` · `{{score}}` · `{{scorePotentiel}}` ·
`{{blocage1}}` `{{blocage2}}` `{{blocage3}}` · `{{produitsRecuperables}}` ·
`{{gainVisibilite}}` · `{{cms}}` · `{{lienAudit}}` · `{{lienRdv}}`

CTA mixte : self-serve (`/register`) sur les 3 premiers mails du segment B,
prise de rendez-vous sur le dernier.

---

# FR

## Segment B — audit vu, non converti (4 mails)

Fil rouge : chaque mail part du **résultat de l'audit** (la douleur) puis montre
**ce que FeedPlug fait concrètement** pour le transformer en gain. Le prospect
ne doit pas seulement comprendre que son flux est faible — il doit comprendre
*pourquoi FeedPlug est la réponse*.

### B1 — J+1 — *« vous avez le diagnostic, voici le plan de travail »*
**Objet :** `{{score}}/100 : les 3 blocages qui plafonnent votre flux`
**Preview :** Votre audit {{societe}} est prêt — et voici quoi en faire.

> {{prenom}}, votre flux produit a obtenu **{{score}}/100**. À catalogue constant, le potentiel atteignable est de **{{scorePotentiel}}/100**.
>
> L'écart se concentre sur 3 points :
> - {{blocage1}}
> - {{blocage2}}
> - {{blocage3}}
>
> Un score, seul, ne fait rien avancer. Ce que FeedPlug ajoute : la **liste exacte des fiches à corriger**, classées par impact, avec le correctif proposé sur chacune. Vous ne cherchez plus où est le problème — vous avez un plan de travail priorisé, prêt à exécuter.
>
> **[Voir mes fiches à corriger]** → /register
>
> Votre audit reste accessible ici : {{lienAudit}}

### B2 — J+3 — *« le gain est réel, et atteignable sans le chantier manuel »*
**Objet :** `{{produitsRecuperables}} produits que vous n'exploitez pas`
**Preview :** Le diagnostic, c'est bien. Le récupérer, c'est mieux.

> Votre audit estime **{{produitsRecuperables}} produits** remettables en diffusion et un gain de visibilité potentiel de **+{{gainVisibilite}}%**.
>
> La façon habituelle d'aller chercher ce gain : reprendre les fiches une par une, ou confier ça à une agence. Lent, coûteux — et à refaire à chaque mise à jour du catalogue.
>
> FeedPlug fait ce travail autrement : des **règles d'enrichissement + de l'IA corrigent tout le catalogue d'un coup**, puis le flux corrigé est poussé et **maintenu à jour automatiquement** sur chacun de vos canaux. Le gain devient atteignable sans y passer vos semaines.
>
> **[Récupérer ces produits]** → /register

### B3 — J+7 — *« voici, concrètement, ce que fait FeedPlug »*
**Objet :** `De {{score}} à {{scorePotentiel}}/100 : comment FeedPlug s'y prend`
**Preview :** Le mécanisme, étape par étape — sur votre blocage n°1.

> Reprenons votre blocage principal — {{blocage1}}. Voici comment FeedPlug le traite, et le reste du catalogue avec :
>
> 1. **Vous connectez votre source une fois** (Shopify, CSV, PrestaShop…).
> 2. **FeedPlug optimise tout le catalogue** — titres, descriptions, attributs — *adaptés à chaque canal*, via règles + IA.
> 3. **Vous validez** les changements : l'avant/après est visible fiche par fiche.
> 4. **Le flux part vers Google, Amazon, Meta, marketplaces…** et reste synchronisé à chaque mise à jour produit.
>
> Le résultat n'est pas un fichier corrigé une fois. C'est un catalogue diffusable partout, qui **ne se redégrade pas** à la prochaine update.
>
> **[Voir FeedPlug sur mon catalogue]** → /register

### B4 — J+12 — bascule rendez-vous
**Objet :** `On regarde votre flux {{societe}} ensemble ?`
**Preview :** Dernière relance — et une proposition.

> {{prenom}}, votre audit a chiffré le potentiel : **{{scorePotentiel}}/100 atteignable**. FeedPlug existe précisément pour fermer cet écart — sans y passer vos semaines, et sans que le flux se redégrade ensuite.
>
> Si vous voulez, on prend 20 minutes : on regarde votre flux ensemble et on définit l'ordre des corrections à plus fort impact. Sans engagement.
>
> Et si vous préférez avancer seul, votre compte se crée en 2 minutes.
>
> **[Réserver 20 minutes]** → {{lienRdv}}
> *ou* **[Créer mon compte]** → /register

## Segment A — audit non terminé (2 mails)

### A1 — J+1
**Objet :** `Votre audit {{societe}} n'attend qu'une connexion`
**Preview :** Il manque une étape de 30 secondes pour votre score.

> {{prenom}}, vous avez lancé un audit de flux, mais la source n'a pas encore été connectée — donc pas encore de score.
>
> La connexion {{cms}} prend 30 secondes, en lecture seule. Vous obtenez aussitôt votre score réel et vos blocages prioritaires.
>
> **[Terminer mon audit]** → {{lienAudit}}

### A2 — J+4
**Objet :** `Votre score de flux, en 30 secondes`
**Preview :** Votre audit est toujours en attente de connexion.

> Petit rappel : votre audit {{societe}} est prêt, il attend juste la connexion de votre catalogue pour générer le diagnostic.
>
> Lecture seule, 30 secondes, aucune carte bancaire.
>
> **[Connecter et voir mon score]** → {{lienAudit}}

---

# EN

## Segment B — audit seen, not converted (4 emails)

Through-line: each email starts from the **audit result** (the pain), then shows
**what FeedPlug concretely does** to turn it into a gain. The prospect must not
only understand their feed is weak — they must understand *why FeedPlug is the
answer*.

### B1 — D+1 — *"you have the diagnosis, here's the worklist"*
**Subject:** `{{score}}/100: the 3 issues holding your feed back`
**Preview:** Your {{societe}} audit is ready — and here's what to do with it.

> {{prenom}}, your product feed scored **{{score}}/100**. With the same catalog, the reachable potential is **{{scorePotentiel}}/100**.
>
> The gap comes down to 3 points:
> - {{blocage1}}
> - {{blocage2}}
> - {{blocage3}}
>
> A score on its own moves nothing. What FeedPlug adds: the **exact list of products to fix**, ranked by impact, with the proposed fix on each. You stop hunting for the problem — you get a prioritized worklist, ready to run.
>
> **[See my products to fix]** → /register
>
> Your audit stays available here: {{lienAudit}}

### B2 — D+3 — *"the gain is real, and reachable without the manual grind"*
**Subject:** `{{produitsRecuperables}} products you're leaving on the table`
**Preview:** The diagnostic is one thing. Capturing it is better.

> Your audit estimates **{{produitsRecuperables}} products** that could be put back into circulation and a potential visibility gain of **+{{gainVisibilite}}%**.
>
> The usual way to chase that gain: rework products one by one, or hand it to an agency. Slow, costly — and to redo on every catalog update.
>
> FeedPlug does this work differently: **enrichment rules + AI fix the whole catalog at once**, then the corrected feed is pushed and **kept in sync automatically** across every channel. The gain becomes reachable without burning weeks on it.
>
> **[Recover these products]** → /register

### B3 — D+7 — *"here, concretely, is what FeedPlug does"*
**Subject:** `From {{score}} to {{scorePotentiel}}/100: how FeedPlug does it`
**Preview:** The mechanism, step by step — on your top issue.

> Let's take your main issue — {{blocage1}}. Here's how FeedPlug handles it, and the rest of the catalog with it:
>
> 1. **You connect your source once** (Shopify, CSV, PrestaShop…).
> 2. **FeedPlug optimizes the whole catalog** — titles, descriptions, attributes — *tailored to each channel*, via rules + AI.
> 3. **You review** the changes: the before/after is visible product by product.
> 4. **The feed goes out to Google, Amazon, Meta, marketplaces…** and stays in sync on every product update.
>
> The result isn't a file fixed once. It's a catalog that's distributable everywhere and **doesn't degrade again** on the next update.
>
> **[See FeedPlug on my catalog]** → /register

### B4 — D+12 (switch to a call)
**Subject:** `Want to look at your {{societe}} feed together?`
**Preview:** Last follow-up — and an offer.

> {{prenom}}, your audit put a number on the potential: **{{scorePotentiel}}/100 reachable**. FeedPlug exists precisely to close that gap — without burning weeks, and without the feed degrading afterward.
>
> If you'd like, let's take 20 minutes: we look at your feed together and set the order of the highest-impact fixes. No commitment.
>
> And if you'd rather move on your own, your account takes 2 minutes to create.
>
> **[Book 20 minutes]** → {{lienRdv}}
> *or* **[Create my account]** → /register

## Segment A — audit not completed (2 emails)

### A1 — D+1
**Subject:** `Your {{societe}} audit just needs a connection`
**Preview:** One 30-second step is missing for your score.

> {{prenom}}, you started a feed audit, but the source hasn't been connected yet — so there's no score yet.
>
> Connecting {{cms}} takes 30 seconds, read-only. You get your real score and priority issues right away.
>
> **[Finish my audit]** → {{lienAudit}}

### A2 — D+4
**Subject:** `Your feed score, in 30 seconds`
**Preview:** Your audit is still waiting on a connection.

> Quick reminder: your {{societe}} audit is ready — it just needs your catalog connected to generate the diagnostic.
>
> Read-only, 30 seconds, no credit card.
>
> **[Connect and see my score]** → {{lienAudit}}

---

# ES

## Segmento B — auditoría vista, sin conversión (4 correos)

Hilo conductor: cada correo parte del **resultado de la auditoría** (el dolor) y
luego muestra **lo que FeedPlug hace concretamente** para convertirlo en
ganancia. El prospecto no solo debe entender que su feed es débil — debe
entender *por qué FeedPlug es la respuesta*.

### B1 — D+1 — *«tienes el diagnóstico, aquí está el plan de trabajo»*
**Asunto:** `{{score}}/100: los 3 bloqueos que limitan tu feed`
**Preview:** Tu auditoría {{societe}} está lista — y esto es qué hacer con ella.

> {{prenom}}, tu feed de productos obtuvo **{{score}}/100**. Con el mismo catálogo, el potencial alcanzable es de **{{scorePotentiel}}/100**.
>
> La diferencia se concentra en 3 puntos:
> - {{blocage1}}
> - {{blocage2}}
> - {{blocage3}}
>
> Una puntuación, por sí sola, no hace avanzar nada. Lo que FeedPlug añade: la **lista exacta de fichas a corregir**, ordenadas por impacto, con la corrección propuesta en cada una. Dejas de buscar dónde está el problema — tienes un plan de trabajo priorizado, listo para ejecutar.
>
> **[Ver mis fichas a corregir]** → /register
>
> Tu auditoría sigue disponible aquí: {{lienAudit}}

### B2 — D+3 — *«la ganancia es real, y alcanzable sin el trabajo manual»*
**Asunto:** `{{produitsRecuperables}} productos que no estás aprovechando`
**Preview:** El diagnóstico está bien. Recuperarlo es mejor.

> Tu auditoría estima **{{produitsRecuperables}} productos** que podrían volver a difundirse y una ganancia de visibilidad potencial del **+{{gainVisibilite}}%**.
>
> La forma habitual de ir a buscar esa ganancia: rehacer las fichas una por una, o encargárselo a una agencia. Lento, costoso — y a repetir en cada actualización del catálogo.
>
> FeedPlug hace este trabajo de otra manera: **reglas de enriquecimiento + IA corrigen todo el catálogo de una vez**, y luego el feed corregido se publica y se **mantiene actualizado automáticamente** en cada uno de tus canales. La ganancia se vuelve alcanzable sin dedicarle semanas.
>
> **[Recuperar estos productos]** → /register

### B3 — D+7 — *«esto es, concretamente, lo que hace FeedPlug»*
**Asunto:** `De {{score}} a {{scorePotentiel}}/100: cómo lo hace FeedPlug`
**Preview:** El mecanismo, paso a paso — sobre tu bloqueo principal.

> Tomemos tu bloqueo principal — {{blocage1}}. Así es como FeedPlug lo trata, y el resto del catálogo con él:
>
> 1. **Conectas tu fuente una vez** (Shopify, CSV, PrestaShop…).
> 2. **FeedPlug optimiza todo el catálogo** — títulos, descripciones, atributos — *adaptados a cada canal*, mediante reglas + IA.
> 3. **Tú validas** los cambios: el antes/después es visible ficha por ficha.
> 4. **El feed sale hacia Google, Amazon, Meta, marketplaces…** y se mantiene sincronizado en cada actualización de producto.
>
> El resultado no es un archivo corregido una sola vez. Es un catálogo difundible en todas partes, que **no vuelve a degradarse** en la próxima actualización.
>
> **[Ver FeedPlug sobre mi catálogo]** → /register

### B4 — D+12 (cambio a llamada)
**Asunto:** `¿Revisamos juntos tu feed {{societe}}?`
**Preview:** Último recordatorio — y una propuesta.

> {{prenom}}, tu auditoría puso una cifra al potencial: **{{scorePotentiel}}/100 alcanzable**. FeedPlug existe precisamente para cerrar esa diferencia — sin dedicarle semanas, y sin que el feed se degrade después.
>
> Si quieres, dedicamos 20 minutos: revisamos tu feed juntos y definimos el orden de las correcciones de mayor impacto. Sin compromiso.
>
> Y si prefieres avanzar por tu cuenta, tu cuenta se crea en 2 minutos.
>
> **[Reservar 20 minutos]** → {{lienRdv}}
> *o* **[Crear mi cuenta]** → /register

## Segmento A — auditoría no terminada (2 correos)

### A1 — D+1
**Asunto:** `Tu auditoría {{societe}} solo necesita una conexión`
**Preview:** Falta un paso de 30 segundos para tu puntuación.

> {{prenom}}, iniciaste una auditoría de feed, pero la fuente aún no se ha conectado — así que todavía no hay puntuación.
>
> Conectar {{cms}} toma 30 segundos, en modo solo lectura. Obtienes tu puntuación real y tus bloqueos prioritarios al instante.
>
> **[Terminar mi auditoría]** → {{lienAudit}}

### A2 — D+4
**Asunto:** `Tu puntuación de feed, en 30 segundos`
**Preview:** Tu auditoría sigue esperando una conexión.

> Recordatorio rápido: tu auditoría {{societe}} está lista — solo necesita que conectes tu catálogo para generar el diagnóstico.
>
> Solo lectura, 30 segundos, sin tarjeta de crédito.
>
> **[Conectar y ver mi puntuación]** → {{lienAudit}}

---

# Implémentation (résumé)

- `MARKETING_SEQUENCE` (email-service.js) : ajouter les segments A/B en
  fr/en/es ; le segment C garde la séquence générique actuelle.
- `sendMarketingNurtureEmail` : accepter un objet `auditContext`
  (score, blocages, etc.) et interpoler les variables.
- Handler `nurture-runs` : joindre le lead à son `marketing_audits` le plus
  récent, déterminer le segment (A / B / C) et passer le contexte.
- `{{lienRdv}}` : `https://calendly.com/victorsoldet/30min`.
- Cadence : A = J+1, J+4 ; B = J+1, J+3, J+7, J+12.
