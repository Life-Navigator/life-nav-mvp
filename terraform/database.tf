# Random password for database
resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# PostgreSQL Flexible Server
resource "azurerm_postgresql_flexible_server" "main" {
  name                = "psql-${local.resource_prefix}-${local.unique_suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  
  # Version
  version = "14"
  
  # Authentication
  administrator_login    = "psqladmin"
  administrator_password = random_password.db_password.result
  
  # Compute and Storage
  sku_name   = var.environment == "prod" ? "GP_Standard_D2s_v3" : var.database_config.sku_name
  storage_mb = var.database_config.storage_mb
  
  # Backup Configuration
  backup_retention_days        = var.environment == "prod" ? 30 : var.database_config.backup_retention_days
  geo_redundant_backup_enabled = var.environment == "prod" ? true : var.database_config.geo_redundant_backup_enabled
  
  # High Availability (for production)
  dynamic "high_availability" {
    for_each = var.environment == "prod" ? [1] : []
    content {
      mode                      = "ZoneRedundant"
      standby_availability_zone = "2"
    }
  }
  
  # Networking
  delegated_subnet_id = azurerm_subnet.database.id
  private_dns_zone_id = azurerm_private_dns_zone.postgresql.id
  
  # Auto grow storage
  auto_grow_enabled = var.database_config.auto_grow_enabled
  
  # Maintenance Window (late night)
  maintenance_window {
    day_of_week  = 0  # Sunday
    start_hour   = 2
    start_minute = 0
  }
  
  tags = local.common_tags
  
  depends_on = [
    azurerm_private_dns_zone_virtual_network_link.postgresql
  ]
}

# Database
resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = var.project_name
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# PostgreSQL Extensions
resource "azurerm_postgresql_flexible_server_configuration" "extensions" {
  name      = "azure.extensions"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "CITEXT,HSTORE,PLPGSQL,PGCRYPTO,UUID-OSSP,PG_STAT_STATEMENTS,PG_TRGM"
}

# Connection Pooling Configuration
resource "azurerm_postgresql_flexible_server_configuration" "connection_pooling" {
  name      = "pgbouncer.enabled"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "true"
}

# Performance Tuning based on SKU
resource "azurerm_postgresql_flexible_server_configuration" "shared_buffers" {
  name      = "shared_buffers"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = var.environment == "prod" ? "131072" : "16384"  # 1GB for prod, 128MB for dev
}

resource "azurerm_postgresql_flexible_server_configuration" "work_mem" {
  name      = "work_mem"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = var.environment == "prod" ? "8192" : "4096"  # 8MB for prod, 4MB for dev
}

resource "azurerm_postgresql_flexible_server_configuration" "max_connections" {
  name      = "max_connections"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = var.environment == "prod" ? "200" : "50"
}

# Query Performance Insights
resource "azurerm_postgresql_flexible_server_configuration" "query_store_enabled" {
  name      = "pg_qs.query_capture_mode"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "ALL"
}

resource "azurerm_postgresql_flexible_server_configuration" "query_store_retention" {
  name      = "pg_qs.retention_period_in_days"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "7"
}

# Firewall Rules (if needed for debugging - remove in production)
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure_services" {
  count            = var.environment != "prod" ? 1 : 0
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# Alert for database storage
resource "azurerm_monitor_metric_alert" "database_storage" {
  count               = var.monitoring_config.enable_alerts ? 1 : 0
  name                = "alert-db-storage-${local.resource_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_postgresql_flexible_server.main.id]
  description         = "Alert when database storage is above 80%"
  
  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = "storage_percent"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }
  
  window_size        = "PT5M"
  frequency          = "PT5M"
  severity           = 2
  
  action {
    action_group_id = azurerm_monitor_action_group.main[0].id
  }
  
  tags = local.common_tags
}

# Alert for database CPU
resource "azurerm_monitor_metric_alert" "database_cpu" {
  count               = var.monitoring_config.enable_alerts ? 1 : 0
  name                = "alert-db-cpu-${local.resource_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_postgresql_flexible_server.main.id]
  description         = "Alert when database CPU is above 80%"
  
  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = "cpu_percent"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }
  
  window_size        = "PT5M"
  frequency          = "PT5M"
  severity           = 2
  
  action {
    action_group_id = azurerm_monitor_action_group.main[0].id
  }
  
  tags = local.common_tags
}