# Support par marché

**Objectif** : définir les langues, canaux et créneaux de support pour chaque région, dans le cadre de l’internationalisation.

## Principes

- **Langue(s)** : indiquer clairement quelles langues sont supportées (ex. FR, EN pour l’UE et le UK).
- **Canal** : email prioritaire (support@ ou billing@) ; chat ou téléphone selon maturité.
- **Créneaux** : heures de réponse (ex. jours ouvrés 9h–18h Paris) pour set les attentes.
- **Escalade** : processus interne si besoin (juridique, facturation).

## Template par marché

Pour chaque nouveau marché, remplir (ou adapter) :

| Élément | Valeur |
|---------|--------|
| **Marché** | ex. France, UK, Nordics |
| **Langues support** | ex. Français, English |
| **Email(s)** | support@feedplug.com, billing@feedplug.com |
| **Créneau de réponse** | ex. Lun–Ven 9h–18h (heure de Paris) |
| **Délai cible** | ex. sous 24h ouvrées |
| **Remarques** | ex. UK : répondre en anglais |

## Exemple (défaut actuel)

| Élément | Valeur |
|---------|--------|
| **Marché** | France, Union européenne |
| **Langues support** | Français, English |
| **Email(s)** | support@feedplug.com, billing@feedplug.com |
| **Créneau** | Jours ouvrés, heure France |
| **Délai cible** | À définir (ex. 24–48h) |

## À faire à l’ouverture d’un marché

1. Mettre à jour ce doc (ou la fiche marché) avec langue(s) et créneaux.
2. Indiquer sur le site (footer, page contact ou FAQ) les langues et créneaux.
3. Si besoin : numéro ou formulaire dédié (ex. UK) pour rassurer les clients.
4. S’assurer que les **emails transactionnels** sont dans la bonne langue (voir `backend-marketing/email/email-service.js`, paramètre `locale`).

## Référence

- Roadmap i18n : `docs/ROADMAP_INTERNATIONALISATION_SAAS.md`
- Checklist ouverture marché : `docs/CHECKLIST_OUVERTURE_MARCHE.md`
