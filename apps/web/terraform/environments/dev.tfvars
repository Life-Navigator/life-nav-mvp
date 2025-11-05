# Development Environment Configuration
environment = "dev"
location    = "East US"

# Scaling - Minimal for development
scaling_config = {
  min_instances  = 1
  max_instances  = 2
  scale_up_cpu   = 80
  scale_down_cpu = 20
}

# Database - Smallest tier
database_config = {
  sku_name                     = "B_Standard_B1ms"  # 1 vCore, 2GB RAM (~$15/month)
  storage_mb                   = 32768              # 32 GB
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false
  high_availability_enabled    = false
  auto_grow_enabled           = true
}

# App Service - Basic tier
app_service_config = {
  sku_name              = "B1"  # Basic tier (~$13/month)
  always_on             = false
  ftps_state           = "Disabled"
  http2_enabled        = true
  minimum_tls_version  = "1.2"
  health_check_path    = "/api/health"
  health_check_interval = 60
}

# Storage - Minimal redundancy
storage_config = {
  account_tier             = "Standard"
  account_replication_type = "LRS"  # Locally redundant only
  enable_cdn              = false   # No CDN for dev
  cdn_sku                 = "Standard_Microsoft"
}

# Redis - Disabled for dev
redis_config = {
  enabled  = false
  capacity = 0
  family   = "C"
  sku_name = "Basic"
}

# Monitoring - Basic
monitoring_config = {
  enable_application_insights = true
  retention_days             = 7    # Minimum retention
  enable_alerts              = false # No alerts for dev
  alert_email               = ""
}

# Budget
monthly_budget          = 100
budget_alert_thresholds = [80, 100]

# Security - Open for development
allowed_ip_ranges       = ["0.0.0.0/0"]
enable_ddos_protection  = false

# Cost Optimization
cost_optimization_features = {
  use_spot_instances    = false
  use_burstable_compute = true
  enable_auto_shutdown  = true  # Shutdown at night
  shutdown_time         = "19:00"
  startup_time          = "07:00"
}

# Tags
tags = {
  Environment = "Development"
  CostCenter  = "Development"
  AutoShutdown = "true"
}