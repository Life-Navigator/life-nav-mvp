# Production Environment Configuration
environment = "prod"
location    = "East US"

# Scaling - Production ready
scaling_config = {
  min_instances  = 2    # Always have 2 instances minimum
  max_instances  = 10   # Scale up to 10 instances
  scale_up_cpu   = 70
  scale_down_cpu = 30
}

# Database - Production tier with HA
database_config = {
  sku_name                     = "GP_Standard_D2s_v3"  # 2 vCores, 8GB RAM (~$150/month)
  storage_mb                   = 131072                # 128 GB
  backup_retention_days        = 30
  geo_redundant_backup_enabled = true
  high_availability_enabled    = true
  auto_grow_enabled           = true
}

# App Service - Production tier
app_service_config = {
  sku_name              = "P1v2"  # Premium v2 (~$80/month per instance)
  always_on             = true
  ftps_state           = "Disabled"
  http2_enabled        = true
  minimum_tls_version  = "1.2"
  health_check_path    = "/api/health"
  health_check_interval = 30
}

# Storage - Geo-redundant
storage_config = {
  account_tier             = "Standard"
  account_replication_type = "GRS"  # Geo-redundant storage
  enable_cdn              = true
  cdn_sku                 = "Standard_Microsoft"
}

# Redis - Enabled for production
redis_config = {
  enabled  = true
  capacity = 1      # 1GB cache
  family   = "C"
  sku_name = "Standard"  # 99.9% SLA
}

# Monitoring - Full monitoring
monitoring_config = {
  enable_application_insights = true
  retention_days             = 90
  enable_alerts              = true
  alert_email               = "ops@lifenavigator.com"  # Update this
}

# Budget
monthly_budget          = 500
budget_alert_thresholds = [50, 80, 100, 120]

# Security - Restricted (update with your IPs)
allowed_ip_ranges = [
  "0.0.0.0/0"  # Update this to restrict access
]
enable_ddos_protection = false  # Enable if you expect DDoS attacks ($3K/month)

# Cost Optimization
cost_optimization_features = {
  use_spot_instances    = false
  use_burstable_compute = false  # Use dedicated compute
  enable_auto_shutdown  = false
  shutdown_time         = ""
  startup_time          = ""
}

# Custom Domain (configure after deployment)
custom_domain = {
  enabled     = false  # Set to true when ready
  domain_name = "app.lifenavigator.com"
  ssl_state   = "SniEnabled"
}

# Tags
tags = {
  Environment = "Production"
  CostCenter  = "Production"
  Compliance  = "HIPAA"
  SLA         = "99.9"
}