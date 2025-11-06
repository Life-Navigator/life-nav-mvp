# ===========================================================================
# GraphRAG Service Module - Hybrid Knowledge Graph + Vector RAG
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
  default     = "services"
}

variable "service_name" {
  description = "Service name"
  type        = string
  default     = "graphrag"
}

variable "replicas" {
  description = "Number of replicas"
  type        = number
  default     = 2
}

variable "memory_request" {
  description = "Memory request (e.g., 2Gi)"
  type        = string
  default     = "2Gi"
}

variable "cpu_request" {
  description = "CPU request (e.g., 1)"
  type        = string
  default     = "1"
}

variable "neo4j_service" {
  description = "Neo4j service name"
  type        = string
}

variable "neo4j_namespace" {
  description = "Neo4j namespace"
  type        = string
  default     = "databases"
}

variable "neo4j_password_secret" {
  description = "Secret Manager secret name for Neo4j password"
  type        = string
}

variable "qdrant_url" {
  description = "Qdrant service URL"
  type        = string
}

variable "qdrant_api_key_secret" {
  description = "Secret Manager secret name for Qdrant API key"
  type        = string
}

variable "graphdb_service" {
  description = "GraphDB service name"
  type        = string
}

variable "graphdb_namespace" {
  description = "GraphDB namespace"
  type        = string
  default     = "databases"
}

variable "graphdb_repository" {
  description = "GraphDB repository ID"
  type        = string
  default     = "life-navigator"
}

variable "embeddings_service_url" {
  description = "Embeddings service URL (Maverick LLM)"
  type        = string
  default     = "http://maverick:8090"
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

# Service account for GraphRAG
resource "google_service_account" "graphrag" {
  account_id   = "graphrag-${var.env}"
  display_name = "GraphRAG Service (${var.env})"
  project      = var.project_id
}

# Grant access to Neo4j password secret
resource "google_secret_manager_secret_iam_member" "neo4j_password_access" {
  secret_id = var.neo4j_password_secret
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.graphrag.email}"
  project   = var.project_id
}

# Grant access to Qdrant API key secret
resource "google_secret_manager_secret_iam_member" "qdrant_api_key_access" {
  secret_id = var.qdrant_api_key_secret
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.graphrag.email}"
  project   = var.project_id
}

# Kubernetes service account
resource "kubernetes_service_account" "graphrag" {
  metadata {
    name      = "graphrag-${var.env}"
    namespace = var.namespace
    annotations = {
      "iam.gke.io/gcp-service-account" = google_service_account.graphrag.email
    }
    labels = var.labels
  }
}

# IAM binding for Workload Identity
resource "google_service_account_iam_member" "graphrag_workload_identity" {
  service_account_id = google_service_account.graphrag.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.namespace}/${kubernetes_service_account.graphrag.metadata[0].name}]"
}

# ConfigMap for GraphRAG configuration
resource "kubernetes_config_map" "graphrag_config" {
  metadata {
    name      = "graphrag-config-${var.env}"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    GRAPHRAG_SERVER__HOST              = "0.0.0.0"
    GRAPHRAG_SERVER__PORT              = "50051"
    GRAPHRAG_NEO4J__URI                = "bolt://${var.neo4j_service}.${var.neo4j_namespace}.svc.cluster.local:7687"
    GRAPHRAG_NEO4J__USER               = "neo4j"
    GRAPHRAG_NEO4J__DATABASE           = "neo4j"
    GRAPHRAG_NEO4J__MAX_CONNECTIONS    = "10"
    GRAPHRAG_QDRANT__URL               = var.qdrant_url
    GRAPHRAG_QDRANT__COLLECTION_NAME   = "life_navigator_${var.env}"
    GRAPHRAG_QDRANT__VECTOR_SIZE       = "384"
    GRAPHRAG_GRAPHDB__URL              = "http://${var.graphdb_service}.${var.graphdb_namespace}.svc.cluster.local:7200"
    GRAPHRAG_GRAPHDB__REPOSITORY       = var.graphdb_repository
    GRAPHRAG_EMBEDDINGS__SERVICE_URL   = var.embeddings_service_url
    GRAPHRAG_EMBEDDINGS__MODEL         = "all-MiniLM-L6-v2"
    GRAPHRAG_EMBEDDINGS__DIMENSION     = "384"
    GRAPHRAG_RAG__MAX_RESULTS          = "10"
    GRAPHRAG_RAG__MIN_SIMILARITY_SCORE = "0.5"
    GRAPHRAG_RAG__SEMANTIC_WEIGHT      = "0.6"
    GRAPHRAG_RAG__VECTOR_WEIGHT        = "0.4"
    RUST_LOG                           = var.env == "prod" ? "info" : "debug"
  }
}

# Secret for sensitive credentials
resource "kubernetes_secret" "graphrag_secrets" {
  metadata {
    name      = "graphrag-secrets-${var.env}"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    # These will be populated from GCP Secret Manager at runtime via External Secrets Operator
    # or injected directly from Secret Manager
    NEO4J_PASSWORD_SECRET = var.neo4j_password_secret
    QDRANT_API_KEY_SECRET = var.qdrant_api_key_secret
  }
}

# Deployment for GraphRAG service
resource "kubernetes_deployment" "graphrag" {
  metadata {
    name      = "graphrag-${var.env}"
    namespace = var.namespace
    labels = merge(
      var.labels,
      {
        app       = "graphrag"
        component = "rag-service"
      }
    )
  }

  spec {
    replicas = var.replicas

    selector {
      match_labels = {
        app = "graphrag"
        env = var.env
      }
    }

    template {
      metadata {
        labels = {
          app = "graphrag"
          env = var.env
        }
      }

      spec {
        service_account_name = kubernetes_service_account.graphrag.metadata[0].name

        container {
          name  = "graphrag"
          image = "gcr.io/${var.project_id}/graphrag-rs:${var.image_tag}"

          port {
            name           = "grpc"
            container_port = 50051
            protocol       = "TCP"
          }

          # Environment from ConfigMap
          env_from {
            config_map_ref {
              name = kubernetes_config_map.graphrag_config.metadata[0].name
            }
          }

          # Secret environment variables (from GCP Secret Manager)
          env {
            name = "GRAPHRAG_NEO4J__PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.graphrag_secrets.metadata[0].name
                key  = "NEO4J_PASSWORD_SECRET"
              }
            }
          }

          env {
            name = "GRAPHRAG_QDRANT__API_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.graphrag_secrets.metadata[0].name
                key  = "QDRANT_API_KEY_SECRET"
              }
            }
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
            grpc {
              port = 50051
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            grpc {
              port = 50051
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }

          startup_probe {
            grpc {
              port = 50051
            }
            initial_delay_seconds = 15
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 10
          }
        }
      }
    }
  }
}

# Service for GraphRAG
resource "kubernetes_service" "graphrag" {
  metadata {
    name      = "graphrag-${var.env}"
    namespace = var.namespace
    labels    = var.labels
    annotations = {
      "cloud.google.com/neg" = jsonencode({
        ingress = true
      })
    }
  }

  spec {
    selector = {
      app = "graphrag"
      env = var.env
    }

    port {
      name        = "grpc"
      port        = 50051
      target_port = 50051
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

# Horizontal Pod Autoscaler
resource "kubernetes_horizontal_pod_autoscaler_v2" "graphrag" {
  metadata {
    name      = "graphrag-${var.env}"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment.graphrag.metadata[0].name
    }

    min_replicas = var.replicas
    max_replicas = var.env == "prod" ? 10 : 5

    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = 70
        }
      }
    }

    metric {
      type = "Resource"
      resource {
        name = "memory"
        target {
          type                = "Utilization"
          average_utilization = 80
        }
      }
    }
  }
}

# PodDisruptionBudget for high availability
resource "kubernetes_pod_disruption_budget_v1" "graphrag" {
  count = var.env == "prod" ? 1 : 0

  metadata {
    name      = "graphrag-${var.env}"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    min_available = 1

    selector {
      match_labels = {
        app = "graphrag"
        env = var.env
      }
    }
  }
}

# Outputs
output "service_name" {
  description = "GraphRAG service name"
  value       = kubernetes_service.graphrag.metadata[0].name
}

output "grpc_endpoint" {
  description = "GraphRAG gRPC endpoint"
  value       = "${kubernetes_service.graphrag.metadata[0].name}.${var.namespace}.svc.cluster.local:50051"
}

output "service_account_email" {
  description = "GraphRAG service account email"
  value       = google_service_account.graphrag.email
}
