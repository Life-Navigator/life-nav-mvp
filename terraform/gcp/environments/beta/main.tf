# ===========================================================================
# Life Navigator - Beta Environment (Cloud Run Scale-to-Zero)
# ===========================================================================
# Cost-Optimized Configuration: ~$50-100/month when idle
# - Cloud Run services scale to 0 when not in use
# - Only Cloud SQL is always-on (~$50-70/month for db-f1-micro)
# - Redis on-demand (BASIC tier)
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
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "gcs" {
    bucket = "lifenav-prod-terraform-state"
    prefix = "beta/state"
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

locals {
  env = "beta"
  common_labels = {
    environment = "beta"
    managed_by  = "terraform"
    project     = "life-navigator"
    cost_center = "beta-launch"
    architecture = "cloud-run"
  }

  # Image registry path
  image_registry = "${var.region}-docker.pkg.dev/${var.project_id}/life-navigator"

  # DGX-Spark configuration
  dgx_spark_url = var.dgx_spark_url
}

# ===========================================================================
# VPC & Networking
# ===========================================================================

module "vpc" {
  source = "../../modules/vpc"

  project_id = var.project_id
  region     = var.region
  env        = local.env

  vpc_name = "life-navigator-vpc-beta"
  subnets = [
    {
      name          = "private-subnet"
      ip_cidr_range = "10.10.0.0/24"
      region        = var.region
      secondary_ip_ranges = []
    }
  ]
}

# ===========================================================================
# VPC Connector for Cloud Run
# ===========================================================================

module "vpc_connector" {
  source = "../../modules/vpc-connector"

  project_id = var.project_id
  region     = var.region
  env        = local.env

  connector_name = "ln-vpc-connector-beta"
  network        = module.vpc.network_name
  ip_cidr_range  = "10.10.2.0/28"

  machine_type   = "e2-micro"
  min_instances  = 2
  max_instances  = 3
  min_throughput = 200
  max_throughput = 300

  depends_on = [module.vpc]
}

# ===========================================================================
# Artifact Registry
# ===========================================================================

module "artifact_registry" {
  source = "../../modules/artifact-registry"

  project_id    = var.project_id
  region        = var.region
  env           = local.env
  repository_id = "life-navigator"
  description   = "Life Navigator container images"

  labels = local.common_labels
}

# ===========================================================================
# Cloud SQL (PostgreSQL) - Cost Optimized
# ===========================================================================

module "cloud_sql" {
  source = "../../modules/cloud-sql"

  project_id = var.project_id
  region     = var.region
  env        = local.env

  instance_name     = "life-navigator-db-beta"
  database_version  = "POSTGRES_15"
  tier              = "db-f1-micro"  # Smallest instance for cost savings
  availability_type = "ZONAL"

  enable_schedule = false

  databases = [
    {
      name      = "lifenavigator_beta"
      charset   = "UTF8"
      collation = "en_US.UTF8"
    }
  ]

  backup_configuration = {
    enabled                        = true
    start_time                     = "03:00"
    point_in_time_recovery_enabled = false  # Disabled for cost savings
    transaction_log_retention_days = 3
  }

  private_network = module.vpc.network_id
  require_ssl     = true
  enable_pgvector = false

  labels = local.common_labels

  depends_on = [module.vpc]
}

# ===========================================================================
# Memorystore (Redis) - Cost Optimized
# ===========================================================================

module "redis" {
  source = "../../modules/memorystore"

  project_id = var.project_id
  region     = var.region
  env        = local.env

  instance_name  = "life-navigator-cache-beta"
  tier           = "BASIC"
  memory_size_gb = 1
  redis_version  = "REDIS_7_0"

  authorized_network = module.vpc.network_id
  reserved_ip_range  = "10.10.1.0/29"

  redis_configs = {
    maxmemory-policy = "allkeys-lru"
    timeout          = "300"
  }

  labels = local.common_labels

  depends_on = [module.vpc]
}

# ===========================================================================
# Secret Manager
# ===========================================================================

module "secrets" {
  source = "../../modules/secret-manager"

  project_id = var.project_id
  env        = local.env

  secrets = [
    { name = "database-password", replication = { automatic = true } },
    { name = "database-url", replication = { automatic = true } },
    { name = "jwt-secret", replication = { automatic = true } },
    { name = "nextauth-secret", replication = { automatic = true } },
    { name = "dgx-spark-api-key", replication = { automatic = true } }
  ]

  labels = local.common_labels
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = module.secrets.secret_ids["jwt-secret"]
  secret_data = random_password.jwt_secret.result
}

# ===========================================================================
# Cloud Storage
# ===========================================================================

module "storage" {
  source = "../../modules/storage"

  project_id = var.project_id
  region     = var.region
  env        = local.env

  buckets = [
    {
      name          = "${var.project_id}-documents-beta"
      location      = var.region
      storage_class = "STANDARD"
      versioning    = true
      lifecycle_rules = []
    }
  ]

  labels = local.common_labels
}

# ===========================================================================
# IAM - Service Accounts for Cloud Run
# ===========================================================================

module "iam" {
  source = "../../modules/iam"

  project_id = var.project_id
  env        = local.env

  service_accounts = [
    {
      account_id   = "ln-api-gateway-beta"
      display_name = "API Gateway Service (Beta)"
      description  = "Service account for API Gateway Cloud Run service"
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
        "roles/storage.objectViewer",
        "roles/redis.editor",
        "roles/run.invoker"
      ]
    },
    {
      account_id   = "ln-orchestrator-beta"
      display_name = "Agent Orchestrator Service (Beta)"
      description  = "Service account for Agent Orchestrator Cloud Run service"
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
        "roles/storage.objectViewer",
        "roles/redis.editor",
        "roles/run.invoker"
      ]
    },
    {
      account_id   = "ln-graphrag-beta"
      display_name = "GraphRAG API Service (Beta)"
      description  = "Service account for GraphRAG Cloud Run service"
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
        "roles/storage.objectViewer"
      ]
    },
    {
      account_id   = "ln-compliance-beta"
      display_name = "Compliance Checker Service (Beta)"
      description  = "Service account for Compliance Checker Cloud Run service"
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
        "roles/storage.objectViewer"
      ]
    },
    {
      account_id   = "ln-jobs-beta"
      display_name = "Cloud Run Jobs (Beta)"
      description  = "Service account for Cloud Run Jobs"
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
        "roles/storage.objectAdmin",
        "roles/redis.editor",
        "roles/run.invoker",
        "roles/cloudscheduler.jobRunner"
      ]
    },
    {
      account_id   = "ln-web-frontend-beta"
      display_name = "Web Frontend Service (Beta)"
      description  = "Service account for Next.js Web Frontend Cloud Run service"
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
        "roles/run.invoker"
      ]
    }
  ]
}

# ===========================================================================
# Cloud Run Services - Scale to Zero
# ===========================================================================

# API Gateway Service
module "api_gateway" {
  source = "../../modules/cloud-run"

  project_id   = var.project_id
  region       = var.region
  env          = local.env
  service_name = "ln-api-gateway"

  image = "${local.image_registry}/api-gateway:beta"
  port  = 8080
  cpu   = "1"
  memory = "512Mi"

  min_instances   = 0  # Scale to zero!
  max_instances   = 5
  timeout_seconds = 300
  concurrency     = 80

  vpc_connector = module.vpc_connector.connector_id
  vpc_egress    = "PRIVATE_RANGES_ONLY"

  service_account       = module.iam.service_account_emails["ln-api-gateway-beta"]
  allow_unauthenticated = true

  env_vars = {
    ENVIRONMENT          = "beta"
    LOG_LEVEL            = "INFO"
    REDIS_HOST           = module.redis.host
    REDIS_PORT           = "6379"
    ORCHESTRATOR_URL     = "https://ln-agent-orchestrator-${var.cloud_run_suffix}.run.app"
    GRAPHRAG_URL         = "https://ln-graphrag-api-${var.cloud_run_suffix}.run.app"
    COMPLIANCE_URL       = "https://ln-compliance-checker-${var.cloud_run_suffix}.run.app"
    DGX_SPARK_URL        = local.dgx_spark_url
  }

  secret_env_vars = [
    {
      name        = "DATABASE_URL"
      secret_name = "projects/${var.project_id}/secrets/database-password-beta"
      version     = "latest"
    },
    {
      name        = "JWT_SECRET"
      secret_name = "projects/${var.project_id}/secrets/jwt-secret-beta"
      version     = "latest"
    }
  ]

  startup_probe = {
    path              = "/health"
    initial_delay     = 5
    period            = 10
    failure_threshold = 3
    timeout           = 5
  }

  labels = local.common_labels

  depends_on = [module.vpc_connector, module.artifact_registry]
}

# Agent Orchestrator Service
module "agent_orchestrator" {
  source = "../../modules/cloud-run"

  project_id   = var.project_id
  region       = var.region
  env          = local.env
  service_name = "ln-agent-orchestrator"

  image  = "${local.image_registry}/agent-orchestrator:beta"
  port   = 8080
  cpu    = "2"
  memory = "1Gi"

  min_instances   = 0  # Scale to zero!
  max_instances   = 3
  timeout_seconds = 600
  concurrency     = 20

  vpc_connector = module.vpc_connector.connector_id
  vpc_egress    = "PRIVATE_RANGES_ONLY"

  service_account       = module.iam.service_account_emails["ln-orchestrator-beta"]
  allow_unauthenticated = false

  env_vars = {
    ENVIRONMENT   = "beta"
    LOG_LEVEL     = "INFO"
    REDIS_HOST    = module.redis.host
    REDIS_PORT    = "6379"
    DGX_SPARK_URL = local.dgx_spark_url
    GRAPHRAG_URL  = "https://ln-graphrag-api-${var.cloud_run_suffix}.run.app"
  }

  secret_env_vars = [
    {
      name        = "DATABASE_URL"
      secret_name = "projects/${var.project_id}/secrets/database-password-beta"
      version     = "latest"
    },
    {
      name        = "DGX_SPARK_API_KEY"
      secret_name = "projects/${var.project_id}/secrets/dgx-spark-api-key-beta"
      version     = "latest"
    }
  ]

  startup_probe = {
    path              = "/health"
    initial_delay     = 10
    period            = 15
    failure_threshold = 3
    timeout           = 10
  }

  labels = local.common_labels

  depends_on = [module.vpc_connector, module.artifact_registry]
}

# GraphRAG API Service
module "graphrag_api" {
  source = "../../modules/cloud-run"

  project_id   = var.project_id
  region       = var.region
  env          = local.env
  service_name = "ln-graphrag-api"

  image  = "${local.image_registry}/graphrag-api:beta"
  port   = 8080
  cpu    = "1"
  memory = "1Gi"

  min_instances   = 0  # Scale to zero!
  max_instances   = 3
  timeout_seconds = 300
  concurrency     = 40

  vpc_connector = module.vpc_connector.connector_id
  vpc_egress    = "PRIVATE_RANGES_ONLY"

  service_account       = module.iam.service_account_emails["ln-graphrag-beta"]
  allow_unauthenticated = false

  env_vars = {
    ENVIRONMENT   = "beta"
    LOG_LEVEL     = "INFO"
    DGX_SPARK_URL = local.dgx_spark_url
  }

  secret_env_vars = [
    {
      name        = "DATABASE_URL"
      secret_name = "projects/${var.project_id}/secrets/database-password-beta"
      version     = "latest"
    }
  ]

  startup_probe = {
    path              = "/health"
    initial_delay     = 5
    period            = 10
    failure_threshold = 3
    timeout           = 5
  }

  labels = local.common_labels

  depends_on = [module.vpc_connector, module.artifact_registry]
}

# Compliance Checker Service
module "compliance_checker" {
  source = "../../modules/cloud-run"

  project_id   = var.project_id
  region       = var.region
  env          = local.env
  service_name = "ln-compliance-checker"

  image  = "${local.image_registry}/compliance-checker:beta"
  port   = 8080
  cpu    = "1"
  memory = "512Mi"

  min_instances   = 0  # Scale to zero!
  max_instances   = 2
  timeout_seconds = 300
  concurrency     = 40

  vpc_connector = module.vpc_connector.connector_id
  vpc_egress    = "PRIVATE_RANGES_ONLY"

  service_account       = module.iam.service_account_emails["ln-compliance-beta"]
  allow_unauthenticated = false

  env_vars = {
    ENVIRONMENT = "beta"
    LOG_LEVEL   = "INFO"
  }

  secret_env_vars = [
    {
      name        = "DATABASE_URL"
      secret_name = "projects/${var.project_id}/secrets/database-password-beta"
      version     = "latest"
    }
  ]

  startup_probe = {
    path              = "/health"
    initial_delay     = 5
    period            = 10
    failure_threshold = 3
    timeout           = 5
  }

  labels = local.common_labels

  depends_on = [module.vpc_connector, module.artifact_registry]
}

# ===========================================================================
# Web Frontend Service (Next.js) - HIPAA Compliant
# ===========================================================================

module "web_frontend" {
  source = "../../modules/cloud-run"

  project_id   = var.project_id
  region       = var.region
  env          = local.env
  service_name = "ln-web-frontend"

  image  = "${local.image_registry}/web-frontend:beta"
  port   = 3000
  cpu    = "1"
  memory = "512Mi"

  min_instances   = 0  # Scale to zero when idle
  max_instances   = 10
  timeout_seconds = 60
  concurrency     = 100

  vpc_connector = module.vpc_connector.connector_id
  vpc_egress    = "PRIVATE_RANGES_ONLY"

  service_account       = module.iam.service_account_emails["ln-web-frontend-beta"]
  allow_unauthenticated = true  # Public frontend (auth handled by app)

  env_vars = {
    NODE_ENV                = "production"
    NEXT_PUBLIC_APP_URL     = "https://app.lifenavigator.tech"
    NEXT_PUBLIC_API_URL     = module.api_gateway.service_uri
    NEXTAUTH_URL            = "https://app.lifenavigator.tech"
  }

  secret_env_vars = [
    {
      name        = "NEXTAUTH_SECRET"
      secret_name = "projects/${var.project_id}/secrets/nextauth-secret-beta"
      version     = "latest"
    },
    {
      name        = "DATABASE_URL"
      secret_name = "projects/${var.project_id}/secrets/database-url-beta"
      version     = "latest"
    }
  ]

  startup_probe = {
    path              = "/api/health"
    initial_delay     = 10
    period            = 10
    failure_threshold = 3
    timeout           = 5
  }

  labels = local.common_labels

  depends_on = [module.vpc_connector, module.artifact_registry, module.api_gateway]
}

# ===========================================================================
# Cloud Run Jobs - Batch Processing
# ===========================================================================

# Proactive Scan Job
module "proactive_scan_job" {
  source = "../../modules/cloud-run-job"

  project_id = var.project_id
  region     = var.region
  env        = local.env
  job_name   = "ln-proactive-scan"

  image   = "${local.image_registry}/proactive-engine:beta"
  cpu     = "2"
  memory  = "2Gi"

  task_count      = 1
  max_retries     = 2
  timeout_seconds = 1800  # 30 minutes

  vpc_connector = module.vpc_connector.connector_id
  vpc_egress    = "PRIVATE_RANGES_ONLY"

  service_account = module.iam.service_account_emails["ln-jobs-beta"]

  schedule          = "0 */6 * * *"  # Every 6 hours
  schedule_timezone = "America/New_York"

  env_vars = {
    ENVIRONMENT   = "beta"
    LOG_LEVEL     = "INFO"
    REDIS_HOST    = module.redis.host
    REDIS_PORT    = "6379"
    DGX_SPARK_URL = local.dgx_spark_url
    JOB_TYPE      = "proactive_scan"
  }

  secret_env_vars = [
    {
      name        = "DATABASE_URL"
      secret_name = "projects/${var.project_id}/secrets/database-password-beta"
      version     = "latest"
    },
    {
      name        = "DGX_SPARK_API_KEY"
      secret_name = "projects/${var.project_id}/secrets/dgx-spark-api-key-beta"
      version     = "latest"
    }
  ]

  labels = local.common_labels

  depends_on = [module.vpc_connector, module.artifact_registry]
}

# Document Ingestion Job
module "ingestion_job" {
  source = "../../modules/cloud-run-job"

  project_id = var.project_id
  region     = var.region
  env        = local.env
  job_name   = "ln-ingestion-job"

  image   = "${local.image_registry}/ingestion-worker:beta"
  cpu     = "2"
  memory  = "4Gi"

  task_count      = 1
  max_retries     = 3
  timeout_seconds = 3600  # 1 hour

  vpc_connector = module.vpc_connector.connector_id
  vpc_egress    = "PRIVATE_RANGES_ONLY"

  service_account = module.iam.service_account_emails["ln-jobs-beta"]

  # No schedule - triggered on-demand
  schedule = null

  env_vars = {
    ENVIRONMENT   = "beta"
    LOG_LEVEL     = "INFO"
    REDIS_HOST    = module.redis.host
    REDIS_PORT    = "6379"
    DGX_SPARK_URL = local.dgx_spark_url
    JOB_TYPE      = "document_ingestion"
  }

  secret_env_vars = [
    {
      name        = "DATABASE_URL"
      secret_name = "projects/${var.project_id}/secrets/database-password-beta"
      version     = "latest"
    }
  ]

  labels = local.common_labels

  depends_on = [module.vpc_connector, module.artifact_registry]
}

# ===========================================================================
# Outputs
# ===========================================================================

output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "vpc_network" {
  value = module.vpc.network_name
}

output "vpc_connector" {
  value = module.vpc_connector.connector_name
}

output "artifact_registry_url" {
  value = module.artifact_registry.repository_url
}

output "cloud_sql_connection" {
  value     = module.cloud_sql.connection_name
  sensitive = true
}

output "cloud_sql_private_ip" {
  value     = module.cloud_sql.private_ip_address
  sensitive = true
}

output "redis_host" {
  value     = module.redis.host
  sensitive = true
}

output "database_password" {
  value     = module.cloud_sql.database_password
  sensitive = true
}

output "jwt_secret" {
  value     = random_password.jwt_secret.result
  sensitive = true
}

# Cloud Run Service URLs
output "api_gateway_url" {
  value = module.api_gateway.service_uri
}

output "orchestrator_url" {
  value = module.agent_orchestrator.service_uri
}

output "graphrag_url" {
  value = module.graphrag_api.service_uri
}

output "compliance_url" {
  value = module.compliance_checker.service_uri
}

output "web_frontend_url" {
  value       = module.web_frontend.service_uri
  description = "Web Frontend Cloud Run service URL"
}

# Service Account Emails
output "service_accounts" {
  value = {
    api_gateway        = module.iam.service_account_emails["ln-api-gateway-beta"]
    orchestrator       = module.iam.service_account_emails["ln-orchestrator-beta"]
    graphrag           = module.iam.service_account_emails["ln-graphrag-beta"]
    compliance_checker = module.iam.service_account_emails["ln-compliance-beta"]
    jobs               = module.iam.service_account_emails["ln-jobs-beta"]
    web_frontend       = module.iam.service_account_emails["ln-web-frontend-beta"]
  }
}
