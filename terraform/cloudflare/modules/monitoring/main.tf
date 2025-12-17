# ===========================================================================
# Cloudflare Monitoring Module
# ===========================================================================

variable "account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "zone_id" {
  description = "Cloudflare zone ID"
  type        = string
}

variable "alert_email" {
  description = "Email address for alerts"
  type        = string
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for alerts"
  type        = string
  default     = ""
}

variable "gcs_log_bucket" {
  description = "GCS bucket for log storage"
  type        = string
}

variable "gcp_project_id" {
  description = "GCP project ID for logpush"
  type        = string
}

# Notification Policy - High Error Rate
resource "cloudflare_notification_policy" "high_error_rate" {
  account_id  = var.account_id
  name        = "High 5xx Error Rate Alert"
  description = "Alert when 5xx error rate exceeds threshold"
  enabled     = true
  alert_type  = "http_alert_edge_error"

  filters {
    zones = [var.zone_id]
  }

  email_integration {
    id   = ""
    name = var.alert_email
  }
}

# Notification Policy - DDoS Attack
resource "cloudflare_notification_policy" "ddos_alert" {
  account_id  = var.account_id
  name        = "DDoS Attack Detection"
  description = "Alert on DDoS attack detection"
  enabled     = true
  alert_type  = "advanced_ddos_attack_l7_alert"

  filters {
    zones = [var.zone_id]
  }

  email_integration {
    id   = ""
    name = var.alert_email
  }
}

# Notification Policy - Origin Error
resource "cloudflare_notification_policy" "origin_error" {
  account_id  = var.account_id
  name        = "Origin Server Error"
  description = "Alert on origin server errors"
  enabled     = true
  alert_type  = "http_alert_origin_error"

  filters {
    zones = [var.zone_id]
  }

  email_integration {
    id   = ""
    name = var.alert_email
  }
}

# Logpush for analytics (to GCS)
resource "cloudflare_logpush_job" "gcs" {
  enabled          = true
  zone_id          = var.zone_id
  name             = "life-navigator-logs"
  destination_conf = "gs://${var.gcs_log_bucket}?project=${var.gcp_project_id}"
  dataset          = "http_requests"
  frequency        = "high"

  filter = jsonencode({
    where = {
      and = [
        {
          key      = "ClientRequestPath"
          operator = "contains"
          value    = "/api"
        }
      ]
    }
  })

  output_options {
    field_names = [
      "ClientIP",
      "ClientRequestHost",
      "ClientRequestMethod",
      "ClientRequestPath",
      "ClientRequestURI",
      "EdgeResponseStatus",
      "EdgeServerIP",
      "EdgeStartTimestamp",
      "RayID",
      "WAFAction",
      "WAFFlags",
      "CacheCacheStatus",
      "CacheResponseBytes",
      "OriginResponseTime"
    ]
    timestamp_format = "rfc3339"
  }
}

# Outputs
output "logpush_job_id" {
  description = "Logpush job ID"
  value       = cloudflare_logpush_job.gcs.id
}
