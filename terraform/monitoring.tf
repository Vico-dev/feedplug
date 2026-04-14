# SLO 99,99 % — Uptime check et alerte sur l'API
# Voir docs/SLO_99_99_PREREQUIS_ET_ACTIONS.md
#
# Si l'API en prod est backend-marketing (déployée par Cloud Build), définir
# health_check_url dans terraform.tfvars, ex. :
#   health_check_url = "https://feedplug-backend-marketing-XXXX.run.app/api/v1/health"

locals {
  # Quand create_cloud_run_api = false (backend-marketing), health_check_url doit être défini dans terraform.tfvars
  health_url       = var.health_check_url != "" ? var.health_check_url : (var.create_cloud_run_api ? "${google_cloud_run_service.feedplug_api[0].status[0].url}/api/v1/health" : "")
  health_url_strip = replace(local.health_url, "https://", "")
  health_parts     = split("/", local.health_url_strip)
  health_host      = local.health_parts[0]
  health_path      = length(local.health_parts) > 1 ? "/${join("/", slice(local.health_parts, 1, length(local.health_parts)))}" : "/"
}

resource "google_monitoring_uptime_check_config" "api_health" {
  display_name = "FeedPlug API health (SLO 99.99%)"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path             = local.health_path
    port             = 443
    use_ssl          = true
    request_method   = "GET"
    validate_ssl      = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host        = local.health_host
    }
  }
}

# Alerte si le health check échoue (indisponibilité)
resource "google_monitoring_alert_policy" "api_down" {
  display_name = "FeedPlug API indisponible (health check)"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Uptime check en échec"

    condition_threshold {
      filter          = "resource.type = \"uptime_url\" AND resource.labels.host = \"${local.health_host}\" AND metric.type = \"monitoring.googleapis.com/uptime_check/check_passed\""
      duration        = "120s"
      comparison      = "COMPARISON_LT"
      threshold_value = 1

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_NEXT_OLDER"
      }
    }
  }

  documentation {
    content   = "Le health check GET ${local.health_path} sur ${local.health_host} a échoué (503 ou timeout). Suivre le runbook : docs/runbook-indisponibilite.md"
    mime_type = "text/markdown"
  }
}
