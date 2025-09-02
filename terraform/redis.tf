# Redis Cache (Optional - disabled by default to save cost)
resource "azurerm_redis_cache" "main" {
  count               = var.redis_config.enabled ? 1 : 0
  name                = "redis-${local.resource_prefix}-${local.unique_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  
  # Basic tier for cost savings (no SLA, no replication)
  # Standard tier adds ~$50/month but provides 99.9% SLA
  capacity            = var.redis_config.capacity
  family              = var.redis_config.family
  sku_name            = var.environment == "prod" ? "Standard" : var.redis_config.sku_name
  
  # Security
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"
  
  # Redis configuration
  redis_configuration {
    enable_authentication = true
    
    # Persistence (Standard/Premium only)
    rdb_backup_enabled            = var.environment == "prod" && var.redis_config.sku_name != "Basic"
    rdb_backup_frequency          = var.environment == "prod" ? 60 : null
    rdb_backup_max_snapshot_count = var.environment == "prod" ? 1 : null
    
    # Memory management
    maxmemory_reserved = var.redis_config.sku_name != "Basic" ? 10 : 2
    maxmemory_delta    = var.redis_config.sku_name != "Basic" ? 10 : 2
    maxmemory_policy   = "allkeys-lru"  # Remove least recently used keys
  }
  
  # Patch schedule (maintenance window)
  dynamic "patch_schedule" {
    for_each = var.redis_config.sku_name != "Basic" ? [1] : []
    content {
      day_of_week    = "Sunday"
      start_hour_utc = 2
    }
  }
  
  tags = local.common_tags
}

# Private Endpoint for Redis (Premium only, for future)
# resource "azurerm_private_endpoint" "redis" {
#   count               = var.redis_config.enabled && var.environment == "prod" ? 1 : 0
#   name                = "pe-redis-${local.resource_prefix}"
#   location            = azurerm_resource_group.main.location
#   resource_group_name = azurerm_resource_group.main.name
#   subnet_id           = azurerm_subnet.redis[0].id
#
#   private_service_connection {
#     name                           = "redis-connection"
#     private_connection_resource_id = azurerm_redis_cache.main[0].id
#     is_manual_connection          = false
#     subresource_names             = ["redisCache"]
#   }
#
#   tags = local.common_tags
# }