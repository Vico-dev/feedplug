# Guide pas à pas — SLO 99,99 % (uptime check + alertes)

Ce guide vous accompagne pour mettre en place le monitoring (uptime check + alerte) et recevoir les notifications en cas d’indisponibilité de l’API.

---

## Avant de commencer

- Vous devez avoir **Terraform** installé sur votre machine ([installer Terraform](https://developer.hashicorp.com/terraform/downloads)).
- Vous devez être connecté à **Google Cloud** (`gcloud auth application-default login` si besoin).
- Votre API en production est **backend-marketing** (déployée par Cloud Build). L’uptime check doit donc cibler l’URL de ce service.

---

## Étape 1 — Trouver l’URL de votre API (backend-marketing)

C’est l’URL utilisée par le frontend ou les clients pour appeler l’API.

1. Ouvrez la **Console GCP** : [https://console.cloud.google.com](https://console.cloud.google.com)
2. Sélectionnez le projet **feedplug-prod** (ou votre projet).
3. Menu **Cloud Run** (recherchez « Cloud Run » dans la barre de recherche).
4. Cliquez sur le service **feedplug-backend-marketing**.
5. En haut de la page, vous voyez l’**URL du service**, par ex. :  
   `https://feedplug-backend-marketing-xxxxx-ew.a.run.app`
6. L’URL du **health check** est cette URL + **`/api/v1/health`**  
   → ex. : `https://feedplug-backend-marketing-xxxxx-ew.a.run.app/api/v1/health`  
   **Copiez cette URL** pour l’étape 2.

---

## Étape 2 — Configurer Terraform pour cibler cette URL

On indique à Terraform quelle URL surveiller.

1. Allez dans le dossier du projet :
   ```bash
   cd /Users/victorsoldet/Desktop/Feedplug/terraform
   ```

2. Si vous n’avez **pas** encore de fichier `terraform.tfvars` :
   - Copiez l’exemple :  
     `cp terraform.tfvars.example terraform.tfvars`
   - Ouvrez `terraform.tfvars` et remplissez au minimum :  
     `project_id`, `region`, `environment`, et les secrets (ou laissez les secrets pour plus tard si vous ne faites que le monitoring).

3. Ouvrez **`terraform.tfvars`** (avec un éditeur de texte ou Cursor).

4. **Ajoutez une ligne** (en remplaçant par votre vraie URL trouvée à l’étape 1) :
   ```hcl
   health_check_url = "https://feedplug-backend-marketing-XXXXX-ew.a.run.app/api/v1/health"
   ```
   Remplacez `XXXXX` par la partie réelle de votre URL Cloud Run.

5. Sauvegardez le fichier.

---

## Étape 3 — Appliquer Terraform (créer l’uptime check et l’alerte)

Terraform va créer dans GCP :
- un **uptime check** (test du health toutes les 60 secondes) ;
- une **politique d’alerte** « FeedPlug API indisponible » (déclenchement après 2 min d’échec).

1. Toujours dans le dossier **`terraform/`** :
   ```bash
   cd /Users/victorsoldet/Desktop/Feedplug/terraform
   ```

2. Initialiser Terraform (une fois) :
   ```bash
   terraform init
   ```

3. Voir ce que Terraform va créer (sans rien modifier) :
   ```bash
   terraform plan
   ```
   Vous devez voir apparaître au moins :
   - `google_monitoring_uptime_check_config.api_health`
   - `google_monitoring_alert_policy.api_down`

4. Si tout semble correct, appliquer :
   ```bash
   terraform apply
   ```
   Terraform affichera la liste des ressources à créer. Tapez **`yes`** puis Entrée pour confirmer.

5. À la fin, vous devriez voir : **Apply complete!**  
   L’uptime check et l’alerte existent maintenant dans votre projet GCP.

---

## Étape 4 — Ajouter un canal de notification (email ou Slack)

Sans canal, l’alerte existe mais **personne n’est prévenu**. Il faut en ajouter un.

### 4.1 Ouvrir la politique d’alerte

1. Console GCP → **Monitoring** (ou cherchez « Monitoring » dans la barre de recherche).
2. Dans le menu de gauche : **Alerting** (Alertes).
3. Dans la liste des **Politiques d’alerte**, cliquez sur **« FeedPlug API indisponible (health check) »**.

### 4.2 Créer un canal (ex. email)

1. Dans la page de la politique, section **Notifications** (ou **Canaux de notification**).
2. Cliquez sur **« Gérer les canaux de notification »** (ou **« Gérer les canaux »**).
3. Onglet **Canaux** :
   - Pour un **email** : cliquez **« Ajouter un nouveau canal »** → choisir **Email** → saisir l’adresse → **Enregistrer**.
   - Pour **Slack** : même principe, choisir **Slack** et suivre les instructions (URL webhook).
4. Revenez à la politique **« FeedPlug API indisponible »**.
5. Dans **Notifications**, cliquez **« Ajouter des canaux »** (ou **Modifier**), sélectionnez le canal que vous venez de créer (ex. votre email), puis **Enregistrer**.

Désormais, quand le health check échoue pendant 2 minutes, une alerte sera envoyée à ce canal (email ou Slack).

---

## Récapitulatif

| Étape | Où | Action |
|-------|-----|--------|
| 1 | Console GCP → Cloud Run | Récupérer l’URL du service backend-marketing et noter `.../api/v1/health`. |
| 2 | Fichier `terraform/terraform.tfvars` | Ajouter `health_check_url = "https://.../api/v1/health"`. |
| 3 | Terminal dans `terraform/` | `terraform init` puis `terraform plan` puis `terraform apply`. |
| 4 | Console GCP → Monitoring → Alerting | Ouvrir la politique « FeedPlug API indisponible » et ajouter un canal (email ou Slack). |

---

## Dépannage

- **« Error 403 » ou « Permission denied »** lors de `terraform apply`  
  → Votre compte doit avoir le rôle **Monitoring Editor** (ou **Editor**) sur le projet. Un admin GCP peut l’ajouter dans IAM.

- **« resource already exists »**  
  → L’uptime check ou l’alerte a peut-être été créé à la main. Soit vous le supprimez dans la console et vous refaites `terraform apply`, soit vous importez la ressource dans Terraform (avancé).

- **Je n’utilise pas Terraform pour le reste de mon infra**  
  → Vous pouvez quand même utiliser uniquement ce Terraform pour le monitoring : `terraform plan` / `apply` ne créera que les ressources définies dans `main.tf` + `monitoring.tf`. Si votre projet ou votre base est géré ailleurs, attention aux doublons (ex. Cloud SQL dans `main.tf`). Si vous voulez **uniquement** l’uptime check + alerte sans Terraform, vous pouvez les créer à la main dans GCP : Monitoring → Uptime checks → Create check, puis Alerting → Create policy. Ce guide ne détaille pas cette option.

- **Tester que l’alerte fonctionne**  
  → En staging, vous pouvez utiliser le Chaos Monkey (voir `backend-marketing/CHAOS_MONKEY.md`) pour faire échouer le health une fois et vérifier que l’alerte se déclenche (si l’uptime check pointe vers staging).
