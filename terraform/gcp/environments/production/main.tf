# ===========================================================================
# Life Navigator - Production Environment
# Compliance-Isolated Database Architecture
# ===========================================================================
#
# Architecture:
#   - Supabase: Primary DB (managed externally, not in Terraform)
#       Region: us-east-1 (North Virginia) - Supabase recommended
#       Compute: Small (2-core ARM, 4GB RAM) - scale up as needed
#   - CloudSQL HIPAA: Isolated health data (HIPAA compliant)
#       Region: us-central1 (Iowa)
#   - CloudSQL Financial: Isolated financial data (PCI-DSS/SOX compliant)
#       Region: us-central1 (Iowa)
#
# Note: Supabase us-east-1 to GCP us-central1 latency is ~25-35ms
# This is acceptable for the data routing pattern used.
#
# Estimated Cost: ~$700-1000/month (depending on scaling)
# ===========================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
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

  backend "gcs" {
    bucket = "life-navigator-terraform-state-prod"
    prefix = "production/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ===========================================================================
# VPC & Networking
# ===========================================================================

module "vpc" {
  source = "../../modules/vpc"

  project_id = var.project_id
  region     = var.region
  env        = "prod"

  vpc_name = "life-navigator-vpc-prod"
  subnets = [
    {
      name          = "private-subnet"
      ip_cidr_range = "10.0.0.0/24"
      region        = var.region
      secondary_ip_ranges = [
        {
          range_name    = "pods"
          ip_cidr_range = "10.1.0.0/16"
        },
        {
          range_name    = "services"
          ip_cidr_range = "10.2.0.0/16"
        }
      ]
    }
  ]
}

# ===========================================================================
# CloudSQL HIPAA Instance - Isolated Health Data
# ===========================================================================
# HIPAA Compliance Requirements:
#   - Regional HA (high availability)
#   - CMEK encryption (customer-managed encryption keys)
#   - 7-year backup retention
#   - Audit logging enabled
#   - Private IP only (no public access)
#   - SSL required
# ===========================================================================

module "cloud_sql_hipaa" {
  source = "../../modules/cloud-sql"

  project_id = var.project_id
  region     = var.region
  env        = "prod"

  instance_name           = "life-navigator-hipaa-prod"
  database_version        = "POSTGRES_15"
  tier                    = "db-custom-2-8192"  # 2 vCPU, 8GB RAM
  availability_type       = "REGIONAL"          # HA required for HIPAA
  db_password_secret_name = "life-navigator-hipaa-db-password"

  # No scheduling - production runs 24/7
  enable_schedule = false

  databases = [
    {
      name      = "lifenavigator_hipaa"
      charset   = "UTF8"
      collation = "en_US.UTF8"
    }
  ]

  # HIPAA-compliant backup configuration
  backup_configuration = {
    enabled                        = true
    start_time                     = "02:00"  # 2 AM UTC
    point_in_time_recovery_enabled = true     # Required for HIPAA
    transaction_log_retention_days = 7        # Max allowed
  }

  # Network configuration - private only
  private_network = module.vpc.network_id
  require_ssl     = true

  # pgvector not needed for HIPAA data
  enable_pgvector = false

  # Compliance labels
  labels = {
    environment    = "prod"
    managed_by     = "terraform"
    compliance     = "hipaa"
    data_class     = "phi"
    cost_center    = "production"
    backup_policy  = "7-year-retention"
  }
}

# ===========================================================================
# CloudSQL Financial Instance - Isolated Financial Data
# ===========================================================================
# PCI-DSS / SOX Compliance Requirements:
#   - Regional HA (high availability)
#   - CMEK encryption (customer-managed encryption keys)
#   - 7-year backup retention (SOX requirement)
#   - Full statement logging
#   - Private IP only (no public access)
#   - SSL required
# ===========================================================================

module "cloud_sql_financial" {
  source = "../../modules/cloud-sql"

  project_id = var.project_id
  region     = var.region
  env        = "prod"

  instance_name           = "life-navigator-financial-prod"
  database_version        = "POSTGRES_15"
  tier                    = "db-custom-2-8192"  # 2 vCPU, 8GB RAM
  availability_type       = "REGIONAL"          # HA required for compliance
  db_password_secret_name = "life-navigator-financial-db-password"

  # No scheduling - production runs 24/7
  enable_schedule = false

  databases = [
    {
      name      = "lifenavigator_financial"
      charset   = "UTF8"
      collation = "en_US.UTF8"
    }
  ]

  # PCI-DSS/SOX compliant backup configuration
  backup_configuration = {
    enabled                        = true
    start_time                     = "03:00"  # 3 AM UTC (offset from HIPAA)
    point_in_time_recovery_enabled = true     # Required for compliance
    transaction_log_retention_days = 7        # Max allowed
  }

  # Network configuration - private only
  private_network = module.vpc.network_id
  require_ssl     = true

  # pgvector not needed for financial data
  enable_pgvector = false

  # Compliance labels
  labels = {
    environment    = "prod"
    managed_by     = "terraform"
    compliance     = "pci-dss-sox"
    data_class     = "financial"
    cost_center    = "production"
    backup_policy  = "7-year-retention"
  }
}

# ===========================================================================
# Memorystore (Redis) - Production Configuration
# ===========================================================================

module "redis" {
  source = "../../modules/memorystore"

  project_id = var.project_id
  region     = var.region
  env        = "prod"

  instance_name  = "life-navigator-cache-prod"
  tier           = "STANDARD_HA"  # HA for production
  memory_size_gb = 4              # 4GB for production
  redis_version  = "REDIS_7_0"

  # Network configuration
  authorized_network = module.vpc.network_id
  reserved_ip_range  = "10.0.1.0/29"

  # Redis configuration
  redis_configs = {
    maxmemory-policy = "allkeys-lru"
    timeout          = "300"
  }

  # Labels
  labels = {
    environment = "prod"
    managed_by  = "terraform"
    cost_center = "production"
  }
}

# ===========================================================================
# Cloud Storage - Production Buckets
# ===========================================================================

module "storage" {
  source = "../../modules/storage"

  project_id = var.project_id
  region     = var.region
  env        = "prod"

  buckets = [
    {
      name          = "${var.project_id}-models-prod"
      location      = var.region
      storage_class = "STANDARD"
      versioning    = true

      lifecycle_rules = [
        {
          action = {
            type          = "SetStorageClass"
            storage_class = "NEARLINE"
          }
          condition = {
            age = 90  # Move to nearline after 90 days
          }
        }
      ]
    },
    {
      name          = "${var.project_id}-documents-prod"
      location      = var.region
      storage_class = "STANDARD"
      versioning    = true

      lifecycle_rules = []  # No auto-delete in production
    },
    {
      name          = "${var.project_id}-backups-prod"
      location      = var.region
      storage_class = "NEARLINE"
      versioning    = true

      lifecycle_rules = [
        {
          action = {
            type          = "SetStorageClass"
            storage_class = "COLDLINE"
          }
          condition = {
            age = 365  # Move to coldline after 1 year
          }
        },
        {
          action = {
            type = "Delete"
          }
          condition = {
            age = 2555  # Delete after 7 years (compliance)
          }
        }
      ]
    }
  ]

  # Labels
  labels = {
    environment = "prod"
    managed_by  = "terraform"
    cost_center = "production"
  }
}

# ===========================================================================
# Secret Manager - Production Secrets
# ===========================================================================

module "secrets" {
  source = "../../modules/secret-manager"

  project_id = var.project_id
  env        = "prod"

  secrets = [
    # Supabase secrets (primary database)
    {
      name = "life-navigator-supabase-url"
      replication = { automatic = true }
    },
    {
      name = "life-navigator-supabase-key"
      replication = { automatic = true }
    },
    {
      name = "life-navigator-supabase-service-key"
      replication = { automatic = true }
    },
    # Application secrets
    {
      name = "life-navigator-secret-key"
      replication = { automatic = true }
    },
    {
      name = "life-navigator-encryption-key"
      replication = { automatic = true }
    },
    # External service secrets
    {
      name = "neo4j-aura-connection-string"
      replication = { automatic = true }
    },
    {
      name = "qdrant-cloud-api-key"
      replication = { automatic = true }
    },
    {
      name = "openai-api-key"
      replication = { automatic = true }
    },
    {
      name = "sentry-dsn"
      replication = { automatic = true }
    },
    {
      name = "resend-api-key"
      replication = { automatic = true }
    },
    # Financial service secrets
    {
      name = "plaid-client-id"
      replication = { automatic = true }
    },
    {
      name = "plaid-secret"
      replication = { automatic = true }
    },
    {
      name = "stripe-api-key"
      replication = { automatic = true }
    },
    {
      name = "stripe-webhook-secret"
      replication = { automatic = true }
    }
  ]

  # Labels
  labels = {
    environment = "prod"
    managed_by  = "terraform"
  }
}

# ===========================================================================
# IAM - Service Accounts with Least Privilege
# ===========================================================================

module "iam" {
  source = "../../modules/iam"

  project_id = var.project_id
  env        = "prod"

  service_accounts = [
    # API Server - access to all databases
    {
      account_id   = "api-server-prod"
      display_name = "API Server (Production)"
      description  = "Service account for FastAPI backend - accesses all databases"

      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
        "roles/storage.objectViewer",
        "roles/redis.editor"
      ]
    },
    # HIPAA Data Service - HIPAA database only
    {
      account_id   = "hipaa-service-prod"
      display_name = "HIPAA Data Service (Production)"
      description  = "Service account for HIPAA-compliant health data operations"

      roles = [
        "roles/cloudsql.client",  # Access to HIPAA CloudSQL only (enforced by IAM conditions)
        "roles/secretmanager.secretAccessor"
      ]
    },
    # Financial Data Service - Financial database only
    {
      account_id   = "financial-service-prod"
      display_name = "Financial Data Service (Production)"
      description  = "Service account for PCI-DSS compliant financial operations"

      roles = [
        "roles/cloudsql.client",  # Access to Financial CloudSQL only (enforced by IAM conditions)
        "roles/secretmanager.secretAccessor"
      ]
    },
    # Data Pipeline
    {
      account_id   = "data-pipeline-prod"
      display_name = "Data Pipeline (Production)"
      description  = "Service account for data ingestion and ETL"

      roles = [
        "roles/storage.objectAdmin",
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor"
      ]
    }
  ]
}

# ===========================================================================
# Monitoring & Alerting - Production Grade
# ===========================================================================

module "monitoring" {
  source = "../../modules/monitoring"

  project_id = var.project_id
  env        = "prod"

  # Budget alert
  monthly_budget_usd = 2000  # Alert if production exceeds $2,000/month

  # All alerts enabled for production
  enable_cost_alerts    = true
  enable_error_alerts   = true
  enable_latency_alerts = true

  notification_channels = [
    {
      type         = "email"
      display_name = "Production Alerts"
      labels = {
        email_address = var.alert_email
      }
    }
  ]

  # Compliance log retention - 7 years
  log_retention_days = 2555

  # Labels
  labels = {
    environment = "prod"
    managed_by  = "terraform"
  }
}

# ===========================================================================
# GKE Cluster - Production
# ===========================================================================

module "gke_cluster" {
  source = "../../modules/gke-gpu-cluster"

  project_id = var.project_id
  region     = var.region
  env        = "prod"

  cluster_name = "life-navigator-prod"
  network      = module.vpc.network_name
  subnetwork   = module.vpc.subnet_names["private-subnet"]

  labels = {
    environment = "prod"
    managed_by  = "terraform"
    cost_center = "production"
  }
}

# ===========================================================================
# Kubernetes Provider Configuration
# ===========================================================================

data "google_client_config" "default" {}

data "google_container_cluster" "primary" {
  name     = module.gke_cluster.cluster_name
  location = module.gke_cluster.cluster_location
  project  = var.project_id

  depends_on = [module.gke_cluster]
}

provider "kubernetes" {
  host  = "https://${data.google_container_cluster.primary.endpoint}"
  token = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(
    data.google_container_cluster.primary.master_auth[0].cluster_ca_certificate
  )
}

provider "helm" {
  kubernetes {
    host  = "https://${data.google_container_cluster.primary.endpoint}"
    token = data.google_client_config.default.access_token
    cluster_ca_certificate = base64decode(
      data.google_container_cluster.primary.master_auth[0].cluster_ca_certificate
    )
  }
}

# ===========================================================================
# External Secrets Operator
# ===========================================================================

module "external_secrets_operator" {
  source = "../../modules/external-secrets-operator"

  project_id             = var.project_id
  cluster_name           = module.gke_cluster.cluster_name
  cluster_location       = module.gke_cluster.cluster_location
  workload_identity_pool = module.gke_cluster.workload_identity_pool
  env                    = "prod"

  labels = {
    environment = "prod"
    managed_by  = "terraform"
  }

  depends_on = [module.gke_cluster]
}

# ===========================================================================
# Outputs
# ===========================================================================

# HIPAA Database Outputs
output "hipaa_cloud_sql_connection_name" {
  description = "HIPAA Cloud SQL connection name"
  value       = module.cloud_sql_hipaa.connection_name
}

output "hipaa_cloud_sql_private_ip" {
  description = "HIPAA Cloud SQL private IP"
  value       = module.cloud_sql_hipaa.private_ip_address
  sensitive   = true
}

output "hipaa_cloud_sql_password_secret_id" {
  description = "HIPAA Cloud SQL password secret ID"
  value       = module.cloud_sql_hipaa.database_password_secret_id
  sensitive   = true
}

# Financial Database Outputs
output "financial_cloud_sql_connection_name" {
  description = "Financial Cloud SQL connection name"
  value       = module.cloud_sql_financial.connection_name
}

output "financial_cloud_sql_private_ip" {
  description = "Financial Cloud SQL private IP"
  value       = module.cloud_sql_financial.private_ip_address
  sensitive   = true
}

output "financial_cloud_sql_password_secret_id" {
  description = "Financial Cloud SQL password secret ID"
  value       = module.cloud_sql_financial.database_password_secret_id
  sensitive   = true
}

# Redis Output
output "redis_host" {
  description = "Redis host"
  value       = module.redis.host
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = module.redis.port
}

# Storage Outputs
output "model_bucket_name" {
  description = "Model storage bucket"
  value       = module.storage.bucket_names["models"]
}

output "documents_bucket_name" {
  description = "Documents storage bucket"
  value       = module.storage.bucket_names["documents"]
}

# Service Account Outputs
output "api_server_sa_email" {
  description = "API server service account email"
  value       = module.iam.service_account_emails["api-server-prod"]
}

output "hipaa_service_sa_email" {
  description = "HIPAA service account email"
  value       = module.iam.service_account_emails["hipaa-service-prod"]
}

output "financial_service_sa_email" {
  description = "Financial service account email"
  value       = module.iam.service_account_emails["financial-service-prod"]
}

# VPC Output
output "vpc_name" {
  description = "VPC network name"
  value       = module.vpc.network_name
}

# GKE Outputs
output "gke_cluster_name" {
  description = "GKE cluster name"
  value       = module.gke_cluster.cluster_name
}

output "gke_cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = module.gke_cluster.cluster_endpoint
  sensitive   = true
}
