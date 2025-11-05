# Storage Account for static assets and documents
resource "azurerm_storage_account" "main" {
  name                     = "st${replace(local.resource_prefix, "-", "")}${local.unique_suffix}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = var.storage_config.account_tier
  account_replication_type = var.environment == "prod" ? "GRS" : var.storage_config.account_replication_type
  
  # Security
  min_tls_version               = "TLS1_2"
  enable_https_traffic_only     = true
  allow_nested_items_to_be_public = false
  
  # Managed identity
  identity {
    type = "SystemAssigned"
  }
  
  # Blob properties
  blob_properties {
    cors_rule {
      allowed_headers    = ["*"]
      allowed_methods    = ["GET", "HEAD", "OPTIONS"]
      allowed_origins    = ["https://${azurerm_linux_web_app.main.default_hostname}"]
      exposed_headers    = ["*"]
      max_age_in_seconds = 3600
    }
    
    delete_retention_policy {
      days = var.environment == "prod" ? 30 : 7
    }
    
    versioning_enabled = var.environment == "prod"
    
    container_delete_retention_policy {
      days = var.environment == "prod" ? 30 : 7
    }
  }
  
  # Network rules
  network_rules {
    default_action             = "Deny"
    bypass                     = ["AzureServices"]
    virtual_network_subnet_ids = [azurerm_subnet.app_service.id]
    ip_rules                   = []
  }
  
  tags = local.common_tags
}

# Storage containers
resource "azurerm_storage_container" "static" {
  name                  = "static"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "documents" {
  name                  = "documents"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "backups" {
  name                  = "backups"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

# CDN Profile
resource "azurerm_cdn_profile" "main" {
  name                = "cdn-${local.resource_prefix}"
  location            = "global"
  resource_group_name = azurerm_resource_group.main.name
  sku                 = var.storage_config.cdn_sku
  tags                = local.common_tags
}

# CDN Endpoint
resource "azurerm_cdn_endpoint" "main" {
  name                = "cdnep-${local.resource_prefix}-${local.unique_suffix}"
  profile_name        = azurerm_cdn_profile.main.name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  
  origin {
    name      = "storage"
    host_name = azurerm_storage_account.main.primary_blob_endpoint
  }
  
  origin {
    name      = "webapp"
    host_name = azurerm_linux_web_app.main.default_hostname
  }
  
  # Caching rules
  global_delivery_rule {
    cache_expiration_action {
      behavior = "Override"
      duration = "7.00:00:00"  # 7 days for static content
    }
    
    modify_response_header_action {
      action = "Append"
      name   = "Cache-Control"
      value  = "public, max-age=604800"
    }
  }
  
  # Compression
  content_types_to_compress = [
    "text/plain",
    "text/html",
    "text/css",
    "text/javascript",
    "application/javascript",
    "application/json",
    "application/xml",
    "image/svg+xml"
  ]
  
  is_compression_enabled = true
  is_http_allowed       = false
  is_https_allowed      = true
  querystring_caching_behaviour = "IgnoreQueryString"
  
  # Optimization type
  optimization_type = "GeneralWebDelivery"
  
  tags = local.common_tags
}

# CDN Custom Domain (if configured)
resource "azurerm_cdn_endpoint_custom_domain" "main" {
  count           = var.custom_domain.enabled ? 1 : 0
  name            = replace(var.custom_domain.domain_name, ".", "-")
  cdn_endpoint_id = azurerm_cdn_endpoint.main.id
  host_name       = var.custom_domain.domain_name
}