variable "project_id" {
  description = "ID du projet GCP"
  type        = string
}

variable "region" {
  description = "Région GCP"
  type        = string
  default     = "europe-west1"
}

variable "environment" {
  description = "Environnement (staging, production)"
  type        = string
  default     = "staging"
}

variable "db_password" {
  description = "Mot de passe de la base de données"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Secret JWT"
  type        = string
  sensitive   = true
}

variable "pennylane_api_key" {
  description = "Clé API Pennylane"
  type        = string
  sensitive   = true
}

# Cloud SQL : tier de la machine (ex. db-custom-1-4096 = 1 vCPU / 4 GB → ~200 $/mois ZONAL).
# Défaut staging : db-f1-micro. Prod recommandée : db-custom-1-4096 (au lieu de db-custom-2-8192).
variable "db_tier" {
  description = "Tier Cloud SQL (ex. db-custom-1-4096, db-custom-2-8192, db-f1-micro)"
  type        = string
  default     = "db-f1-micro"
}

# Cloud SQL : disponibilité ZONAL (moins cher, 1 zone) ou REGIONAL (HA, failover auto, +50 %).
# Prod : ZONAL si pas besoin SLO 99,99 %, REGIONAL si besoin de HA.
variable "db_availability_type" {
  description = "Disponibilité Cloud SQL : ZONAL ou REGIONAL"
  type        = string
  default     = "ZONAL"
}

variable "cloud_sql_authorized_networks" {
  description = "Réseaux IPv4 autorisés à accéder à Cloud SQL. Laisser vide en production si Cloud Run utilise le connecteur Cloud SQL ou une IP privée."
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

# Cloud Run : créer le service feedplug-api (image gcr.io/.../feedplug-api:latest).
# Mettre false si l'API en prod est backend-marketing (déployée par Cloud Build).
variable "create_cloud_run_api" {
  description = "Créer le service Cloud Run feedplug-api (false si vous utilisez backend-marketing)"
  type        = bool
  default     = false
}

# SLO 99,99 % — monitoring
variable "health_check_url" {
  description = "URL complète du health check (ex. https://feedplug-backend-marketing-xxx.run.app/api/v1/health). Si vide, utilise l'URL Cloud Run gérée par Terraform."
  type        = string
  default     = ""
}
