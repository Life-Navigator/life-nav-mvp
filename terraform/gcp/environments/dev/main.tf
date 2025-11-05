# Life Navigator - Development Environment
# Cost-Optimized Configuration: ~$950/month

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
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
    }
  ]
}

# ===========================================================================
# Cloud SQL (PostgreSQL) - Small tier for dev
# ===========================================================================

module "cloud_sql" {
  source = "../../modules/cloud-sql"

  project_id = var.project_id
  region     = var.region
  env        = "dev"

  instance_name     = "life-navigator-db-dev"
  database_version  = "POSTGRES_15"
  tier              = "db-custom-2-7680"  # 2 vCPU, 7.5GB RAM
  availability_type = "ZONAL"             # Single zone for dev

  # Scheduled start/stop for cost savings
  enable_schedule = true
  schedule_start  = "0 7 * * 1-5"  # 7 AM weekdays
  schedule_end    = "0 19 * * 1-5" # 7 PM weekdays

  databases = [
    {
      name      = "graphrag"
      charset   = "UTF8"
      collation = "en_US.UTF8"
    },
    {
      name      = "auth"
      charset   = "UTF8"
      collation = "en_US.UTF8"
    }
  ]

  # Backup configuration
  backup_configuration = {
    enabled                        = true
    start_time                     = "03:00"
    point_in_time_recovery_enabled = false  # Disabled for dev
    transaction_log_retention_days = 3
  }

  # Network configuration
  private_network = module.vpc.network_id
  require_ssl     = true

  # Tags
  labels = {
    environment = "dev"
    managed_by  = "terraform"
    cost_center = "development"
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
    }
  ]

  # Labels
  labels = {
    environment = "dev"
    managed_by  = "terraform"
  }
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
# Outputs
# ===========================================================================

output "cloud_sql_connection_name" {
  description = "Cloud SQL connection name"
  value       = module.cloud_sql.connection_name
}

output "cloud_sql_private_ip" {
  description = "Cloud SQL private IP"
  value       = module.cloud_sql.private_ip_address
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
