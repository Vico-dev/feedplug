# Configuration Terraform pour Google Cloud Platform
# Ce fichier configure l'infrastructure de production pour FeedPlug

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Cloud SQL - Base de données PostgreSQL
resource "google_sql_database_instance" "feedplug_db" {
  name             = "feedplug-${var.environment}-db"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = var.db_tier
    availability_type = var.db_availability_type

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
    }

    ip_configuration {
      ipv4_enabled = true
      require_ssl  = true
      dynamic "authorized_networks" {
        for_each = var.cloud_sql_authorized_networks
        content {
          name  = authorized_networks.value.name
          value = authorized_networks.value.value
        }
      }
    }
  }

  deletion_protection = var.environment == "production"
}

resource "google_sql_database" "feedplug_database" {
  name     = "feedplug"
  instance = google_sql_database_instance.feedplug_db.name
}

resource "google_sql_user" "feedplug_user" {
  name     = "feedplug"
  instance = google_sql_database_instance.feedplug_db.name
  password = var.db_password
}

# Cloud Storage - Stockage des fichiers
resource "google_storage_bucket" "feedplug_storage" {
  name          = "feedplug-${var.environment}-storage"
  location      = var.region
  force_destroy = var.environment != "production"

  versioning {
    enabled = true
  }

  # Transition vers Nearline après 7 jours : 50 % moins cher, accès rare acceptable
  lifecycle_rule {
    condition {
      age        = 7
      with_state = "LIVE"
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  # Suppression des objets courants après 30 jours (exports, uploads temporaires)
  lifecycle_rule {
    condition {
      age        = 30
      with_state = "LIVE"
    }
    action {
      type = "Delete"
    }
  }

  # Suppression rapide des anciennes versions (versioning) : évite l'accumulation silencieuse
  lifecycle_rule {
    condition {
      age        = 3
      with_state = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }
}

# Pub/Sub - File d'attente pour les jobs
resource "google_pubsub_topic" "feedplug_jobs" {
  name = "feedplug-jobs-${var.environment}"
}

resource "google_pubsub_subscription" "feedplug_jobs_sub" {
  name  = "feedplug-jobs-sub-${var.environment}"
  topic = google_pubsub_topic.feedplug_jobs.name

  ack_deadline_seconds = 60
}

# Cloud Run - Service principal (optionnel : false si vous utilisez backend-marketing déployé par Cloud Build)
resource "google_cloud_run_service" "feedplug_api" {
  count    = var.create_cloud_run_api ? 1 : 0
  name     = "feedplug-api-${var.environment}"
  location = var.region

  template {
    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale"  = var.environment == "production" ? "100" : "10"
        "run.googleapis.com/cpu-throttling" = "false"
      }
    }

    spec {
      containers {
        image = "gcr.io/${var.project_id}/feedplug-api:latest"

        ports {
          container_port = 3000
        }

        env {
          name  = "NODE_ENV"
          value = var.environment
        }

        env {
          name  = "DATABASE_URL"
          value = "postgresql://${google_sql_user.feedplug_user.name}:${var.db_password}@${google_sql_database_instance.feedplug_db.private_ip_address}:5432/${google_sql_database.feedplug_database.name}?sslmode=require"
        }

        env {
          name  = "GOOGLE_CLOUD_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "GOOGLE_CLOUD_STORAGE_BUCKET"
          value = google_storage_bucket.feedplug_storage.name
        }

        env {
          name  = "GOOGLE_CLOUD_PUBSUB_TOPIC"
          value = google_pubsub_topic.feedplug_jobs.name
        }

        resources {
          limits = {
            cpu    = var.environment == "production" ? "2" : "1"
            memory = var.environment == "production" ? "4Gi" : "2Gi"
          }
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

# IAM - Permissions pour Cloud Run (si le service est créé)
resource "google_cloud_run_service_iam_member" "feedplug_api_public" {
  count    = var.create_cloud_run_api ? 1 : 0
  service  = google_cloud_run_service.feedplug_api[0].name
  location = google_cloud_run_service.feedplug_api[0].location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Secret Manager - Stockage des secrets
resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "feedplug-jwt-secret-${var.environment}"

  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret" "pennylane_api_key" {
  secret_id = "feedplug-pennylane-api-key-${var.environment}"

  replication {
    automatic = true
  }
}

# Outputs
output "cloud_run_url" {
  value = var.create_cloud_run_api ? google_cloud_run_service.feedplug_api[0].status[0].url : null
}

output "database_connection_name" {
  value = google_sql_database_instance.feedplug_db.connection_name
}

output "storage_bucket" {
  value = google_storage_bucket.feedplug_storage.name
}
