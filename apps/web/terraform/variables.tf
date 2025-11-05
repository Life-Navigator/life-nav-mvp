# Core Variables
variable "project_name" {
  description = "Project name"
  type        = string
  default     = "lifenavigator"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "East US"
}

variable "location_short" {
  description = "Short location code"
  type        = string
  default     = "eus"
}

# Scaling Configuration
variable "scaling_config" {
  description = "Application scaling configuration"
  type = object({
    min_instances = number
    max_instances = number
    scale_up_cpu  = number
    scale_down_cpu = number
  })
  default = {
    min_instances  = 1    # Start with 1 to minimize cost
    max_instances  = 5    # Scale up to 5 instances
    scale_up_cpu   = 70   # Scale up at 70% CPU
    scale_down_cpu = 30   # Scale down at 30% CPU
  }
}

# Database Configuration
variable "database_config" {
  description = "Database configuration"
  type = object({
    sku_name                     = string
    storage_mb                   = number
    backup_retention_days        = number
    geo_redundant_backup_enabled = bool
    high_availability_enabled    = bool
    auto_grow_enabled           = bool
  })
  default = {
    sku_name                     = "B_Standard_B2s"  # Burstable for cost savings
    storage_mb                   = 32768             # 32 GB
    backup_retention_days        = 7                 # 7 days for dev/staging, 30 for prod
    geo_redundant_backup_enabled = false            # Enable for prod
    high_availability_enabled    = false            # Enable for prod
    auto_grow_enabled           = true
  }
}

# App Service Configuration  
variable "app_service_config" {
  description = "App Service configuration"
  type = object({
    sku_name                  = string
    always_on                 = bool
    ftps_state               = string
    http2_enabled            = bool
    minimum_tls_version      = string
    health_check_path        = string
    health_check_interval    = number
  })
  default = {
    sku_name              = "B2"           # Burstable B2 for cost efficiency
    always_on             = false          # Set to true for prod
    ftps_state           = "Disabled"
    http2_enabled        = true
    minimum_tls_version  = "1.2"
    health_check_path    = "/api/health"
    health_check_interval = 60
  }
}

# Storage Configuration
variable "storage_config" {
  description = "Storage configuration"
  type = object({
    account_tier             = string
    account_replication_type = string
    enable_cdn              = bool
    cdn_sku                 = string
  })
  default = {
    account_tier             = "Standard"
    account_replication_type = "LRS"  # Locally redundant (cheapest)
    enable_cdn              = true
    cdn_sku                 = "Standard_Microsoft"
  }
}

# Redis Cache Configuration
variable "redis_config" {
  description = "Redis cache configuration"
  type = object({
    enabled      = bool
    capacity     = number
    family       = string
    sku_name     = string
  })
  default = {
    enabled  = false  # Start without Redis to save cost
    capacity = 0      # 250MB for Basic
    family   = "C"    # Basic/Standard
    sku_name = "Basic"
  }
}

# Monitoring Configuration
variable "monitoring_config" {
  description = "Monitoring and alerting configuration"
  type = object({
    enable_application_insights = bool
    retention_days             = number
    enable_alerts              = bool
    alert_email               = string
  })
  default = {
    enable_application_insights = true
    retention_days             = 30  # 30 days retention (free tier)
    enable_alerts              = true
    alert_email               = ""
  }
}

# Cost Management
variable "monthly_budget" {
  description = "Monthly budget in USD"
  type        = number
  default     = 500
}

variable "budget_alert_thresholds" {
  description = "Budget alert thresholds as percentages"
  type        = list(number)
  default     = [50, 80, 100, 120]
}

# Security Configuration
variable "allowed_ip_ranges" {
  description = "IP ranges allowed to access the application"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Open to all, restrict for production
}

variable "enable_ddos_protection" {
  description = "Enable DDoS protection (adds cost)"
  type        = bool
  default     = false
}

# Tags
variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}

# Application Configuration
variable "app_settings" {
  description = "Application settings"
  type        = map(string)
  sensitive   = true
  default     = {}
}

# Domain Configuration
variable "custom_domain" {
  description = "Custom domain configuration"
  type = object({
    enabled     = bool
    domain_name = string
    ssl_state   = string
  })
  default = {
    enabled     = false
    domain_name = ""
    ssl_state   = "Disabled"
  }
}

# Feature Flags for Cost Control
variable "cost_optimization_features" {
  description = "Features to enable/disable for cost optimization"
  type = object({
    use_spot_instances      = bool
    use_burstable_compute  = bool
    enable_auto_shutdown   = bool
    shutdown_time          = string
    startup_time           = string
  })
  default = {
    use_spot_instances    = false  # Consider for non-critical workloads
    use_burstable_compute = true   # Use B-series VMs
    enable_auto_shutdown  = false  # Enable for dev/staging
    shutdown_time         = "19:00"
    startup_time          = "07:00"
  }
}

# Migration Readiness
variable "k8s_migration_ready" {
  description = "Configuration for future K8s migration"
  type = object({
    create_container_registry = bool
    containerize_app         = bool
    use_managed_identity     = bool
  })
  default = {
    create_container_registry = false  # Enable when ready for containers
    containerize_app         = false  # Start with App Service
    use_managed_identity     = true   # Best practice
  }
}