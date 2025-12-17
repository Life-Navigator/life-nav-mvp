# Life Navigator - Development Environment
# Cost-Optimized Configuration: ~$950/month

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
    bucket = "life-navigator-terraform-state-dev"
    prefix = "dev/state"
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
  env        = "dev"

  vpc_name = "life-navigator-vpc-dev"
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
# Cloud SQL (PostgreSQL) - Isolated Instances for Dev
# ===========================================================================

module "cloud_sql_hipaa" {
  source = "../../modules/cloud-sql"

  project_id = var.project_id
  region     = var.region
  env        = "dev"

  instance_name           = "life-navigator-hipaa-dev"
  database_version        = "POSTGRES_15"
  tier                    = "db-g1-small" # Smaller tier for dev
  availability_type       = "ZONAL"
  db_password_secret_name = "life-navigator-hipaa-db-password-dev"

  databases = [{
    name      = "lifenavigator_hipaa"
    charset   = "UTF8"
    collation = "en_US.UTF8"
  }]

  backup_configuration = {
    enabled                        = true
    start_time                     = "03:00"
    point_in_time_recovery_enabled = false
    transaction_log_retention_days = 3
  }

  private_network = module.vpc.network_id
  require_ssl     = true

  labels = {
    environment = "dev"
    managed_by  = "terraform"
    cost_center = "development"
    data_class  = "hipaa"
  }
}

module "cloud_sql_financial" {
  source = "../../modules/cloud-sql"

  project_id = var.project_id
  region     = var.region
  env        = "dev"

  instance_name           = "life-navigator-financial-dev"
  database_version        = "POSTGRES_15"
  tier                    = "db-g1-small" # Smaller tier for dev
  availability_type       = "ZONAL"
  db_password_secret_name = "life-navigator-financial-db-password-dev"

  databases = [{
    name      = "lifenavigator_financial"
    charset   = "UTF8"
    collation = "en_US.UTF8"
  }]

  backup_configuration = {
    enabled                        = true
    start_time                     = "03:30"
    point_in_time_recovery_enabled = false
    transaction_log_retention_days = 3
  }

  private_network = module.vpc.network_id
  require_ssl     = true

  labels = {
    environment = "dev"
    managed_by  = "terraform"
    cost_center = "development"
    data_class  = "financial"
  }
}

# ===========================================================================
# Memorystore (Redis) - Minimal size for dev
# ===========================================================================

module "redis" {
  source = "../../modules/memorystore"

  project_id = var.project_id
  region     = var.region
  env        = "dev"

  instance_name  = "life-navigator-cache-dev"
  tier           = "BASIC"  # No HA for dev
  memory_size_gb = 1        # Minimum size
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
    environment = "dev"
    managed_by  = "terraform"
    cost_center = "development"
  }
}

# ===========================================================================
# Cloud Storage - Model & document storage
# ===========================================================================

module "storage" {
  source = "../../modules/storage"

  project_id = var.project_id
  region     = var.region
  env        = "dev"

  buckets = [
    {
      name          = "${var.project_id}-models-dev"
      location      = var.region
      storage_class = "STANDARD"
      versioning    = true

      lifecycle_rules = [
        {
          action = {
            type = "SetStorageClass"
            storage_class = "NEARLINE"
          }
          condition = {
            age = 30  # Move to nearline after 30 days
          }
        }
      ]
    },
    {
      name          = "${var.project_id}-documents-dev"
      location      = var.region
      storage_class = "STANDARD"
      versioning    = true

      lifecycle_rules = [
        {
          action = {
            type = "Delete"
          }
          condition = {
            age = 90  # Delete after 90 days
          }
        }
      ]
    },
    {
      name          = "${var.project_id}-backups-dev"
      location      = var.region
      storage_class = "NEARLINE"
      versioning    = true

      lifecycle_rules = [
        {
          action = {
            type = "Delete"
          }
          condition = {
            age = 180  # Delete backups after 6 months
          }
        }
      ]
    }
  ]

  # Labels
  labels = {
    environment = "dev"
    managed_by  = "terraform"
    cost_center = "development"
  }
}

# ===========================================================================
# Secret Manager - Credentials & API keys
# ===========================================================================

module "secrets" {
  source = "../../modules/secret-manager"

  project_id = var.project_id
  env        = "dev"

  secrets = [
    {
      name = "life-navigator-hipaa-db-url"
      replication = {
        automatic = true
      }
    },
    {
      name = "life-navigator-financial-db-url"
      replication = {
        automatic = true
      }
    },
    {
      name = "neo4j-aura-connection-string"
      replication = {
        automatic = true
      }
    },
    {
      name = "qdrant-cloud-api-key"
      replication = {
        automatic = true
      }
    },
    {
      name = "maverick-api-key"
      replication = {
        automatic = true
      }
    },
    {
      name = "jwt-secret-key"
      replication = {
        automatic = true
      }
    },
    {
      name = "life-navigator-supabase-url"
      replication = {
        automatic = true
      }
    },
    {
      name = "life-navigator-supabase-service-key"
      replication = {
        automatic = true
      }
    },
    {
      name = "life-navigator-supabase-key"
      replication = {
        automatic = true
      }
    }
  ]

  # Labels
  labels = {
    environment = "dev"
    managed_by  = "terraform"
  }
}

resource "google_secret_manager_secret_version" "hipaa_db_url" {
  project     = var.project_id
  secret      = "life-navigator-hipaa-db-url"
  secret_data = "postgresql+asyncpg://${module.cloud_sql_hipaa.database_user}:${module.cloud_sql_hipaa.database_password}@${module.cloud_sql_hipaa.private_ip_address}/lifenavigator_hipaa"
  depends_on = [
    module.cloud_sql_hipaa
  ]
}

resource "google_secret_manager_secret_version" "financial_db_url" {
  project     = var.project_id
  secret      = "life-navigator-financial-db-url"
  secret_data = "postgresql+asyncpg://${module.cloud_sql_financial.database_user}:${module.cloud_sql_financial.database_password}@${module.cloud_sql_financial.private_ip_address}/lifenavigator_financial"
  depends_on = [
    module.cloud_sql_financial
  ]
}

# ===========================================================================
# IAM - Service accounts & permissions
# ===========================================================================

module "iam" {
  source = "../../modules/iam"

  project_id = var.project_id
  env        = "dev"

  service_accounts = [
    {
      account_id   = "api-server-dev"
      display_name = "API Server (Dev)"
      description  = "Service account for FastAPI backend"

      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
        "roles/storage.objectViewer",
        "roles/redis.editor"
      ]
    },
    {
      account_id   = "data-pipeline-dev"
      display_name = "Data Pipeline (Dev)"
      description  = "Service account for data ingestion"

      roles = [
        "roles/storage.objectAdmin",
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor"
      ]
    },
    {
      account_id   = "mcp-server-dev"
      display_name = "MCP Server (Dev)"
      description  = "Service account for MCP server"

      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
        "roles/storage.objectViewer"
      ]
    }
  ]
}

# ===========================================================================
# Monitoring & Logging
# ===========================================================================

module "monitoring" {
  source = "../../modules/monitoring"

  project_id = var.project_id
  env        = "dev"

  # Budget alert
  monthly_budget_usd = 1500  # Alert if dev exceeds $1,500/month

  # Alert policies
  enable_cost_alerts = true
  enable_error_alerts = true
  enable_latency_alerts = true

  notification_channels = [
    {
      type         = "email"
      display_name = "Dev Team"
      labels = {
        email_address = var.alert_email
      }
    }
  ]

  # Log retention
  log_retention_days = 30  # Keep logs for 30 days in dev

  # Labels
  labels = {
    environment = "dev"
    managed_by  = "terraform"
  }
}

# ===========================================================================
# GKE Cluster
# ===========================================================================

module "gke_cluster" {
  source = "../../modules/gke-gpu-cluster"

  project_id = var.project_id
  region     = var.region
  env        = "dev"

  cluster_name = "life-navigator-gpu"
  network      = module.vpc.network_name
  subnetwork   = module.vpc.subnet_names["private-subnet"]

  labels = {
    environment = "dev"
    managed_by  = "terraform"
    cost_center = "development"
  }
}

# ===========================================================================
# Kubernetes Provider Configuration
# ===========================================================================

# Get GKE cluster credentials
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
  env                    = "dev"

  labels = {
    environment = "dev"
    managed_by  = "terraform"
  }

  depends_on = [module.gke_cluster]
}

# ===========================================================================
# Neo4j Module (if using self-hosted)
# ===========================================================================

# Uncomment if deploying Neo4j to GKE instead of using Aura
# module "neo4j" {
#   source = "../../modules/neo4j"
#
#   project_id   = var.project_id
#   cluster_name = module.gke_cluster.cluster_name
#   env          = "dev"
#
#   depends_on = [module.gke_cluster]
# }

# ===========================================================================
# Qdrant Module (if using self-hosted)
# ===========================================================================

# Uncomment if deploying Qdrant to GKE instead of using Qdrant Cloud
# module "qdrant" {
#   source = "../../modules/qdrant"
#
#   project_id   = var.project_id
#   cluster_name = module.gke_cluster.cluster_name
#   env          = "dev"
#
#   depends_on = [module.gke_cluster]
# }

# ===========================================================================
# GraphDB Module (if using self-hosted)
# ===========================================================================

# Uncomment if deploying GraphDB to GKE
# module "graphdb" {
#   source = "../../modules/graphdb"
#
#   project_id   = var.project_id
#   cluster_name = module.gke_cluster.cluster_name
#   env          = "dev"
#
#   depends_on = [module.gke_cluster]
# }

# ===========================================================================
# GraphRAG Service
# ===========================================================================

# Note: GraphRAG is deployed via its own Terraform module
# See terraform/gcp/modules/graphrag-service/main.tf
# Uncomment and configure when ready to deploy

# module "graphrag_service" {
#   source = "../../modules/graphrag-service"
#
#   project_id   = var.project_id
#   region       = var.region
#   env          = "dev"
#   cluster_name = module.gke_cluster.cluster_name
#
#   # Neo4j configuration (using Aura)
#   neo4j_service            = "neo4j-dev"
#   neo4j_namespace          = "databases"
#   neo4j_password_secret    = "neo4j-aura-password"
#
#   # Qdrant configuration (using Cloud)
#   qdrant_url              = "https://your-qdrant-cloud-url"
#   qdrant_api_key_secret   = "qdrant-cloud-api-key"
#
#   # GraphDB configuration
#   graphdb_service         = "graphdb-dev"
#   graphdb_namespace       = "databases"
#   graphdb_repository      = "life-navigator-dev"
#
#   # Embeddings service (Maverick)
#   embeddings_service_url  = "http://maverick:8090"
#
#   image_tag = "dev-latest"
#
#   labels = {
#     environment = "dev"
#     managed_by  = "terraform"
#   }
#
#   depends_on = [
#     module.gke_cluster,
#     module.external_secrets_operator
#   ]
# }

# ===========================================================================
# Outputs
# ===========================================================================

output "cloud_sql_hipaa_connection_name" {
  description = "Cloud SQL HIPAA connection name"
  value       = module.cloud_sql_hipaa.connection_name
}

output "cloud_sql_financial_connection_name" {
  description = "Cloud SQL Financial connection name"
  value       = module.cloud_sql_financial.connection_name
}

output "cloud_sql_hipaa_password_secret_id" {
  description = "Cloud SQL HIPAA password secret ID"
  value       = module.cloud_sql_hipaa.database_password_secret_id
  sensitive   = true
}

output "cloud_sql_financial_password_secret_id" {
  description = "Cloud SQL Financial password secret ID"
  value       = module.cloud_sql_financial.database_password_secret_id
  sensitive   = true
}

output "redis_host" {
  description = "Redis host"
  value       = module.redis.host
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = module.redis.port
}

output "model_bucket_name" {
  description = "Model storage bucket"
  value       = module.storage.bucket_names["models"]
}

output "documents_bucket_name" {
  description = "Documents storage bucket"
  value       = module.storage.bucket_names["documents"]
}

output "api_server_sa_email" {
  description = "API server service account email"
  value       = module.iam.service_account_emails["api-server-dev"]
}

output "vpc_name" {
  description = "VPC network name"
  value       = module.vpc.network_name
}

# GKE outputs
output "gke_cluster_name" {
  description = "GKE cluster name"
  value       = module.gke_cluster.cluster_name
}

output "gke_cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = module.gke_cluster.cluster_endpoint
  sensitive   = true
}

output "gke_cluster_ca_certificate" {
  description = "GKE cluster CA certificate"
  value       = module.gke_cluster.cluster_ca_certificate
  sensitive   = true
}

output "gke_workload_identity_pool" {
  description = "GKE Workload Identity pool"
  value       = module.gke_cluster.workload_identity_pool
}

# External Secrets Operator outputs
output "eso_namespace" {
  description = "External Secrets Operator namespace"
  value       = module.external_secrets_operator.namespace
}

output "eso_cluster_secret_store" {
  description = "ClusterSecretStore name"
  value       = module.external_secrets_operator.cluster_secret_store_name
}

output "eso_gcp_sa_email" {
  description = "External Secrets Operator GCP service account"
  value       = module.external_secrets_operator.gcp_service_account_email
}
