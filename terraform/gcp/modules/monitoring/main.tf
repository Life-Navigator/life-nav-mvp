# ===========================================================================
# Monitoring Module - Monitoring, logging, and alerts
# ===========================================================================

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "env" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "monthly_budget_usd" {
  description = "Monthly budget in USD"
  type        = number
}

variable "enable_cost_alerts" {
  description = "Enable cost alerts"
  type        = bool
  default     = true
}

variable "enable_error_alerts" {
  description = "Enable error rate alerts"
  type        = bool
  default     = true
}

variable "enable_latency_alerts" {
  description = "Enable latency alerts"
  type        = bool
  default     = true
}

variable "notification_channels" {
  description = "Notification channels for alerts"
  type = list(object({
    type         = string
    display_name = string
    labels       = map(string)
  }))
}

variable "log_retention_days" {
  description = "Log retention period in days"
  type        = number
  default     = 30
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

# Notification Channels
resource "google_monitoring_notification_channel" "channels" {
  count = length(var.notification_channels)

  display_name = var.notification_channels[count.index].display_name
  type         = var.notification_channels[count.index].type
  labels       = var.notification_channels[count.index].labels
  project      = var.project_id

  enabled = true
}

# Budget Alert
resource "google_billing_budget" "budget" {
  count = var.enable_cost_alerts ? 1 : 0

  billing_account = data.google_project.project.billing_account
  display_name    = "life-navigator-${var.env}-budget"

  budget_filter {
    projects = ["projects/${data.google_project.project.number}"]
    labels = {
      environment = var.env
    }
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.monthly_budget_usd)
    }
  }

  # Alert at 50%, 80%, 100%
  threshold_rules {
    threshold_percent = 0.5
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 0.8
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  all_updates_rule {
    monitoring_notification_channels = [
      for channel in google_monitoring_notification_channel.channels : channel.id
    ]
  }
}

# Error Rate Alert Policy
resource "google_monitoring_alert_policy" "error_rate" {
  count = var.enable_error_alerts ? 1 : 0

  display_name = "life-navigator-${var.env}-error-rate"
  combiner     = "OR"
  project      = var.project_id

  conditions {
    display_name = "Error rate above threshold"

    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 10

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = [
    for channel in google_monitoring_notification_channel.channels : channel.id
  ]

  alert_strategy {
    auto_close = "1800s"
  }
}

# Latency Alert Policy
resource "google_monitoring_alert_policy" "latency" {
  count = var.enable_latency_alerts ? 1 : 0

  display_name = "life-navigator-${var.env}-latency"
  combiner     = "OR"
  project      = var.project_id

  conditions {
    display_name = "Request latency above threshold"

    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_latencies\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5000  # 5 seconds

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_PERCENTILE_95"
        group_by_fields      = ["resource.service_name"]
      }
    }
  }

  notification_channels = [
    for channel in google_monitoring_notification_channel.channels : channel.id
  ]

  alert_strategy {
    auto_close = "1800s"
  }
}

# Cloud SQL Monitoring Dashboard
resource "google_monitoring_dashboard" "cloudsql" {
  dashboard_json = jsonencode({
    displayName = "Life Navigator - Cloud SQL (${var.env})"
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width  = 6
          height = 4
          widget = {
            title = "CPU Utilization"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_MEAN"
                    }
                  }
                }
              }]
            }
          }
        },
        {
          width  = 6
          height = 4
          xPos   = 6
          widget = {
            title = "Memory Utilization"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/memory/utilization\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_MEAN"
                    }
                  }
                }
              }]
            }
          }
        },
        {
          width  = 6
          height = 4
          yPos   = 4
          widget = {
            title = "Active Connections"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_MEAN"
                    }
                  }
                }
              }]
            }
          }
        },
        {
          width  = 6
          height = 4
          xPos   = 6
          yPos   = 4
          widget = {
            title = "Query Latency (p95)"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/postgresql/insights/aggregate/latencies\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_DELTA"
                      crossSeriesReducer = "REDUCE_PERCENTILE_95"
                    }
                  }
                }
              }]
            }
          }
        }
      ]
    }
  })
  project = var.project_id
}

# Redis Monitoring Dashboard
resource "google_monitoring_dashboard" "redis" {
  dashboard_json = jsonencode({
    displayName = "Life Navigator - Redis (${var.env})"
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width  = 6
          height = 4
          widget = {
            title = "Memory Usage"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"redis_instance\" AND metric.type=\"redis.googleapis.com/stats/memory/usage_ratio\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_MEAN"
                    }
                  }
                }
              }]
            }
          }
        },
        {
          width  = 6
          height = 4
          xPos   = 6
          widget = {
            title = "Operations/sec"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"redis_instance\" AND metric.type=\"redis.googleapis.com/stats/operations\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_RATE"
                    }
                  }
                }
              }]
            }
          }
        },
        {
          width  = 6
          height = 4
          yPos   = 4
          widget = {
            title = "Hit Ratio"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"redis_instance\" AND metric.type=\"redis.googleapis.com/stats/cache_hit_ratio\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_MEAN"
                    }
                  }
                }
              }]
            }
          }
        },
        {
          width  = 6
          height = 4
          xPos   = 6
          yPos   = 4
          widget = {
            title = "Connected Clients"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type=\"redis_instance\" AND metric.type=\"redis.googleapis.com/clients/connected\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_MEAN"
                    }
                  }
                }
              }]
            }
          }
        }
      ]
    }
  })
  project = var.project_id
}

# Log sink for long-term storage
resource "google_logging_project_sink" "storage_sink" {
  name        = "life-navigator-${var.env}-logs"
  destination = "storage.googleapis.com/${google_storage_bucket.logs.name}"
  project     = var.project_id

  filter = <<-EOT
    resource.type="cloud_run_revision" OR
    resource.type="cloudsql_database" OR
    resource.type="redis_instance"
  EOT

  unique_writer_identity = true
}

# Log storage bucket
resource "google_storage_bucket" "logs" {
  name          = "${var.project_id}-logs-${var.env}"
  location      = "US"
  storage_class = "NEARLINE"
  project       = var.project_id

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = var.log_retention_days
    }
  }

  uniform_bucket_level_access = true
  force_destroy               = var.env != "prod"

  labels = var.labels
}

# Grant log sink permission to write to bucket
resource "google_storage_bucket_iam_member" "logs_writer" {
  bucket = google_storage_bucket.logs.name
  role   = "roles/storage.objectCreator"
  member = google_logging_project_sink.storage_sink.writer_identity
}

# Data source for project
data "google_project" "project" {
  project_id = var.project_id
}

# Outputs
output "notification_channel_ids" {
  description = "Notification channel IDs"
  value       = [for channel in google_monitoring_notification_channel.channels : channel.id]
}

output "dashboard_ids" {
  description = "Dashboard IDs"
  value = {
    cloudsql = google_monitoring_dashboard.cloudsql.id
    redis    = google_monitoring_dashboard.redis.id
  }
}

output "log_bucket_name" {
  description = "Log storage bucket name"
  value       = google_storage_bucket.logs.name
}
