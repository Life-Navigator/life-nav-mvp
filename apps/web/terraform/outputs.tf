# Resource Group
output "resource_group_name" {
  description = "The name of the resource group"
  value       = azurerm_resource_group.main.name
}

# App Service
output "app_service_url" {
  description = "The default URL of the App Service"
  value       = "https://${azurerm_linux_web_app.main.default_hostname}"
}

output "app_service_name" {
  description = "The name of the App Service"
  value       = azurerm_linux_web_app.main.name
}

output "app_service_principal_id" {
  description = "The principal ID of the App Service managed identity"
  value       = azurerm_user_assigned_identity.app.principal_id
}

# Database
output "database_server_name" {
  description = "The name of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.main.name
}

output "database_fqdn" {
  description = "The FQDN of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "database_connection_string" {
  description = "The connection string for the database"
  value       = local.database_connection_string
  sensitive   = true
}

# Storage
output "storage_account_name" {
  description = "The name of the storage account"
  value       = azurerm_storage_account.main.name
}

output "storage_primary_endpoint" {
  description = "The primary blob endpoint"
  value       = azurerm_storage_account.main.primary_blob_endpoint
}

# CDN
output "cdn_endpoint_url" {
  description = "The URL of the CDN endpoint"
  value       = "https://${azurerm_cdn_endpoint.main.name}.azureedge.net"
}

# Redis (if enabled)
output "redis_hostname" {
  description = "The hostname of the Redis cache"
  value       = var.redis_config.enabled ? azurerm_redis_cache.main[0].hostname : null
}

output "redis_connection_string" {
  description = "The connection string for Redis"
  value       = var.redis_config.enabled ? azurerm_redis_cache.main[0].primary_connection_string : null
  sensitive   = true
}

# Key Vault
output "key_vault_name" {
  description = "The name of the Key Vault"
  value       = azurerm_key_vault.main.name
}

output "key_vault_uri" {
  description = "The URI of the Key Vault"
  value       = azurerm_key_vault.main.vault_uri
}

# Application Insights (if enabled)
output "application_insights_instrumentation_key" {
  description = "The instrumentation key for Application Insights"
  value       = var.monitoring_config.enable_application_insights ? azurerm_application_insights.main[0].instrumentation_key : null
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "The connection string for Application Insights"
  value       = var.monitoring_config.enable_application_insights ? azurerm_application_insights.main[0].connection_string : null
  sensitive   = true
}

# Deployment Information
output "deployment_info" {
  description = "Deployment information summary"
  value = {
    environment         = var.environment
    project            = var.project_name
    location           = var.location
    resource_group     = azurerm_resource_group.main.name
    app_url            = "https://${azurerm_linux_web_app.main.default_hostname}"
    cdn_url            = "https://${azurerm_cdn_endpoint.main.name}.azureedge.net"
    monthly_budget     = var.monthly_budget
    scaling_enabled    = true
    min_instances      = var.scaling_config.min_instances
    max_instances      = var.scaling_config.max_instances
    redis_enabled      = var.redis_config.enabled
    monitoring_enabled = var.monitoring_config.enable_application_insights
  }
}

# GitHub Actions Secrets (for CI/CD setup)
output "github_actions_secrets" {
  description = "Secrets to configure in GitHub Actions"
  value = {
    AZURE_WEBAPP_NAME           = azurerm_linux_web_app.main.name
    DATABASE_URL                = local.database_connection_string
    AZURE_STORAGE_ACCOUNT_NAME  = azurerm_storage_account.main.name
    AZURE_KEY_VAULT_NAME        = azurerm_key_vault.main.name
    CDN_URL                     = "https://${azurerm_cdn_endpoint.main.name}.azureedge.net"
  }
  sensitive = true
}