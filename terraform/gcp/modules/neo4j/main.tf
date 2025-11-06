# ===========================================================================
# Neo4j on GKE Module - Knowledge Graph Database
# ===========================================================================

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "env" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "cluster_name" {
  description = "GKE cluster name"
  type        = string
}

variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "databases"
}

variable "neo4j_version" {
  description = "Neo4j version"
  type        = string
  default     = "5.15.0-enterprise"
}

variable "disk_size_gb" {
  description = "Persistent disk size in GB"
  type        = number
  default     = 100
}

variable "memory_request" {
  description = "Memory request (e.g., 4Gi)"
  type        = string
  default     = "4Gi"
}

variable "cpu_request" {
  description = "CPU request (e.g., 2)"
  type        = string
  default     = "2"
}

variable "enable_plugins" {
  description = "Enable Neo4j plugins (APOC, GDS, n10s)"
  type        = bool
  default     = true
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

# Persistent Volume Claim for Neo4j data
resource "kubernetes_persistent_volume_claim" "neo4j_data" {
  metadata {
    name      = "neo4j-data-${var.env}"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "${var.disk_size_gb}Gi"
      }
    }
    storage_class_name = "standard-rwo"
  }
}

# ConfigMap for Neo4j configuration
resource "kubernetes_config_map" "neo4j_config" {
  metadata {
    name      = "neo4j-config-${var.env}"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    "neo4j.conf" = <<-EOT
      # Server configuration
      server.default_listen_address=0.0.0.0
      server.bolt.listen_address=:7687
      server.http.listen_address=:7474

      # Memory settings
      server.memory.heap.initial_size=2G
      server.memory.heap.max_size=4G
      server.memory.pagecache.size=2G

      # Security
      dbms.security.auth_enabled=true
      dbms.security.procedures.unrestricted=apoc.*,gds.*

      # Plugins
      ${var.enable_plugins ? "dbms.security.procedures.allowlist=apoc.*,gds.*,n10s.*" : ""}

      # Performance
      dbms.transaction.concurrent.maximum=1000
      dbms.connector.bolt.thread_pool_min_size=5
      dbms.connector.bolt.thread_pool_max_size=400

      # Logging
      dbms.logs.debug.level=INFO
      dbms.logs.query.enabled=true
      dbms.logs.query.threshold=1s

      # Cluster (for future HA setup)
      dbms.mode=SINGLE
    EOT
  }
}

# Secret for Neo4j password
resource "random_password" "neo4j_password" {
  length  = 32
  special = true
}

resource "kubernetes_secret" "neo4j_auth" {
  metadata {
    name      = "neo4j-auth-${var.env}"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    NEO4J_AUTH = "neo4j/${random_password.neo4j_password.result}"
  }
}

# Store password in Secret Manager
resource "google_secret_manager_secret" "neo4j_password" {
  secret_id = "neo4j-password-${var.env}"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = var.labels
}

resource "google_secret_manager_secret_version" "neo4j_password" {
  secret = google_secret_manager_secret.neo4j_password.id

  secret_data = random_password.neo4j_password.result
}

# Neo4j StatefulSet
resource "kubernetes_stateful_set" "neo4j" {
  metadata {
    name      = "neo4j-${var.env}"
    namespace = var.namespace
    labels = merge(
      var.labels,
      {
        app       = "neo4j"
        component = "database"
      }
    )
  }

  spec {
    service_name = "neo4j"
    replicas     = 1

    selector {
      match_labels = {
        app = "neo4j"
        env = var.env
      }
    }

    template {
      metadata {
        labels = {
          app = "neo4j"
          env = var.env
        }
      }

      spec {
        container {
          name  = "neo4j"
          image = "neo4j:${var.neo4j_version}"

          env {
            name = "NEO4J_AUTH"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.neo4j_auth.metadata[0].name
                key  = "NEO4J_AUTH"
              }
            }
          }

          env {
            name  = "NEO4J_ACCEPT_LICENSE_AGREEMENT"
            value = "yes"
          }

          # Enable plugins
          dynamic "env" {
            for_each = var.enable_plugins ? [1] : []
            content {
              name  = "NEO4J_PLUGINS"
              value = "[\"apoc\",\"graph-data-science\",\"n10s\"]"
            }
          }

          port {
            name           = "http"
            container_port = 7474
            protocol       = "TCP"
          }

          port {
            name           = "bolt"
            container_port = 7687
            protocol       = "TCP"
          }

          volume_mount {
            name       = "data"
            mount_path = "/data"
          }

          volume_mount {
            name       = "config"
            mount_path = "/var/lib/neo4j/conf"
          }

          resources {
            requests = {
              cpu    = var.cpu_request
              memory = var.memory_request
            }
            limits = {
              cpu    = "${tonumber(var.cpu_request) * 2}"
              memory = var.memory_request
            }
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 7474
            }
            initial_delay_seconds = 60
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/"
              port = 7474
            }
            initial_delay_seconds = 30
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }
        }

        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.neo4j_data.metadata[0].name
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.neo4j_config.metadata[0].name
          }
        }
      }
    }
  }
}

# Service for Neo4j
resource "kubernetes_service" "neo4j" {
  metadata {
    name      = "neo4j-${var.env}"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = {
      app = "neo4j"
      env = var.env
    }

    port {
      name        = "http"
      port        = 7474
      target_port = 7474
      protocol    = "TCP"
    }

    port {
      name        = "bolt"
      port        = 7687
      target_port = 7687
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

# Headless service for StatefulSet
resource "kubernetes_service" "neo4j_headless" {
  metadata {
    name      = "neo4j"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = {
      app = "neo4j"
      env = var.env
    }

    port {
      name        = "http"
      port        = 7474
      target_port = 7474
    }

    port {
      name        = "bolt"
      port        = 7687
      target_port = 7687
    }

    cluster_ip = "None"
  }
}

# Outputs
output "service_name" {
  description = "Neo4j service name"
  value       = kubernetes_service.neo4j.metadata[0].name
}

output "bolt_uri" {
  description = "Neo4j Bolt URI"
  value       = "bolt://${kubernetes_service.neo4j.metadata[0].name}.${var.namespace}.svc.cluster.local:7687"
}

output "http_uri" {
  description = "Neo4j HTTP URI"
  value       = "http://${kubernetes_service.neo4j.metadata[0].name}.${var.namespace}.svc.cluster.local:7474"
}

output "password_secret" {
  description = "Secret Manager secret name for Neo4j password"
  value       = google_secret_manager_secret.neo4j_password.secret_id
}
