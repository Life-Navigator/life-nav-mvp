# ===========================================================================
# External Secrets Operator Module
# ===========================================================================

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
}

# ===========================================================================
# Variables
# ===========================================================================

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "cluster_name" {
  description = "GKE cluster name"
  type        = string
}

variable "cluster_location" {
  description = "GKE cluster location"
  type        = string
}

variable "env" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "namespace" {
  description = "Namespace for External Secrets Operator"
  type        = string
  default     = "external-secrets-system"
}

variable "chart_version" {
  description = "External Secrets Operator Helm chart version"
  type        = string
  default     = "0.9.11"
}

variable "workload_identity_pool" {
  description = "Workload Identity pool"
  type        = string
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

# ===========================================================================
# Namespace for External Secrets Operator
# ===========================================================================

resource "kubernetes_namespace" "external_secrets" {
  metadata {
    name = var.namespace
    labels = merge(
      var.labels,
      {
        name        = var.namespace
        environment = var.env
        managed_by  = "terraform"
      }
    )
  }
}

# ===========================================================================
# GCP Service Account for External Secrets Operator
# ===========================================================================

resource "google_service_account" "external_secrets" {
  account_id   = "external-secrets-${var.env}"
  display_name = "External Secrets Operator (${var.env})"
  project      = var.project_id
  description  = "Service account for External Secrets Operator to access Secret Manager"
}

# Grant Secret Manager Secret Accessor role
resource "google_project_iam_member" "external_secrets_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.external_secrets.email}"
}

# Grant Secret Manager Viewer role (to list secrets)
resource "google_project_iam_member" "external_secrets_viewer" {
  project = var.project_id
  role    = "roles/secretmanager.viewer"
  member  = "serviceAccount:${google_service_account.external_secrets.email}"
}

# ===========================================================================
# Kubernetes Service Account
# ===========================================================================

resource "kubernetes_service_account" "external_secrets" {
  metadata {
    name      = "external-secrets-sa"
    namespace = kubernetes_namespace.external_secrets.metadata[0].name
    annotations = {
      "iam.gke.io/gcp-service-account" = google_service_account.external_secrets.email
    }
    labels = var.labels
  }

  depends_on = [kubernetes_namespace.external_secrets]
}

# ===========================================================================
# Workload Identity Binding
# ===========================================================================

resource "google_service_account_iam_member" "workload_identity_binding" {
  service_account_id = google_service_account.external_secrets.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.workload_identity_pool}[${kubernetes_namespace.external_secrets.metadata[0].name}/${kubernetes_service_account.external_secrets.metadata[0].name}]"
}

# ===========================================================================
# Install External Secrets Operator via Helm
# ===========================================================================

resource "helm_release" "external_secrets" {
  name       = "external-secrets"
  repository = "https://charts.external-secrets.io"
  chart      = "external-secrets"
  version    = var.chart_version
  namespace  = kubernetes_namespace.external_secrets.metadata[0].name

  values = [
    yamlencode({
      installCRDs = true

      # Service account
      serviceAccount = {
        create = false
        name   = kubernetes_service_account.external_secrets.metadata[0].name
      }

      # Security context
      securityContext = {
        runAsNonRoot = true
        runAsUser    = 1000
        fsGroup      = 1000
      }

      # Resources
      resources = {
        requests = {
          cpu    = "100m"
          memory = "128Mi"
        }
        limits = {
          cpu    = "500m"
          memory = "512Mi"
        }
      }

      # Replicas
      replicaCount = var.env == "prod" ? 3 : 2

      # Pod security
      podSecurityContext = {
        runAsNonRoot = true
        runAsUser    = 1000
        fsGroup      = 1000
        seccompProfile = {
          type = "RuntimeDefault"
        }
      }

      # Container security
      containerSecurityContext = {
        allowPrivilegeEscalation = false
        capabilities = {
          drop = ["ALL"]
        }
        readOnlyRootFilesystem = true
      }

      # Prometheus metrics
      metrics = {
        service = {
          enabled = true
          port    = 8080
        }
      }

      # Webhook
      webhook = {
        port = 9443
        replicaCount = var.env == "prod" ? 2 : 1

        resources = {
          requests = {
            cpu    = "100m"
            memory = "128Mi"
          }
          limits = {
            cpu    = "500m"
            memory = "512Mi"
          }
        }
      }

      # Cert controller
      certController = {
        replicaCount = var.env == "prod" ? 2 : 1

        resources = {
          requests = {
            cpu    = "100m"
            memory = "128Mi"
          }
          limits = {
            cpu    = "500m"
            memory = "512Mi"
          }
        }
      }
    })
  ]

  depends_on = [
    kubernetes_namespace.external_secrets,
    kubernetes_service_account.external_secrets,
    google_service_account_iam_member.workload_identity_binding
  ]
}

# ===========================================================================
# ClusterSecretStore for GCP Secret Manager
# ===========================================================================

resource "kubernetes_manifest" "cluster_secret_store" {
  manifest = {
    apiVersion = "external-secrets.io/v1beta1"
    kind       = "ClusterSecretStore"
    metadata = {
      name = "gcpsm-secret-store"
      labels = merge(
        var.labels,
        {
          environment = var.env
          managed_by  = "terraform"
        }
      )
    }
    spec = {
      provider = {
        gcpsm = {
          projectID = var.project_id
          auth = {
            workloadIdentity = {
              clusterLocation = var.cluster_location
              clusterName     = var.cluster_name
              serviceAccountRef = {
                name      = kubernetes_service_account.external_secrets.metadata[0].name
                namespace = kubernetes_namespace.external_secrets.metadata[0].name
              }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.external_secrets]
}

# ===========================================================================
# Outputs
# ===========================================================================

output "namespace" {
  description = "External Secrets Operator namespace"
  value       = kubernetes_namespace.external_secrets.metadata[0].name
}

output "service_account_name" {
  description = "Kubernetes service account name"
  value       = kubernetes_service_account.external_secrets.metadata[0].name
}

output "gcp_service_account_email" {
  description = "GCP service account email"
  value       = google_service_account.external_secrets.email
}

output "cluster_secret_store_name" {
  description = "ClusterSecretStore name"
  value       = kubernetes_manifest.cluster_secret_store.manifest.metadata.name
}

output "helm_release_status" {
  description = "Helm release status"
  value       = helm_release.external_secrets.status
}
