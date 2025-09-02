# Key Vault for Secrets Management
resource "azurerm_key_vault" "main" {
  name                = "kv-${substr(replace(local.resource_prefix, "-", ""), 0, 18)}${local.unique_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  
  # SKU
  sku_name = "standard"  # Premium adds HSM support but costs more
  
  # Security
  enabled_for_deployment          = false
  enabled_for_disk_encryption     = false
  enabled_for_template_deployment = false
  enable_rbac_authorization       = true
  purge_protection_enabled        = var.environment == "prod"
  soft_delete_retention_days      = var.environment == "prod" ? 90 : 7
  
  # Network rules
  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
    
    virtual_network_subnet_ids = [azurerm_subnet.app_service.id]
    
    # Allow Terraform client IP during deployment
    ip_rules = []  # Add your IP here if needed
  }
  
  tags = local.common_tags
}

# Key Vault Access Policy for App Service
resource "azurerm_role_assignment" "app_keyvault_reader" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

# Store Database Password in Key Vault
resource "azurerm_key_vault_secret" "db_password" {
  name         = "database-password"
  value        = random_password.db_password.result
  key_vault_id = azurerm_key_vault.main.id
  
  depends_on = [
    azurerm_role_assignment.app_keyvault_reader
  ]
}

# Store Storage Account Key in Key Vault
resource "azurerm_key_vault_secret" "storage_key" {
  name         = "storage-account-key"
  value        = azurerm_storage_account.main.primary_access_key
  key_vault_id = azurerm_key_vault.main.id
  
  depends_on = [
    azurerm_role_assignment.app_keyvault_reader
  ]
}

# Store Redis Connection String in Key Vault (if enabled)
resource "azurerm_key_vault_secret" "redis_connection" {
  count        = var.redis_config.enabled ? 1 : 0
  name         = "redis-connection-string"
  value        = azurerm_redis_cache.main[0].primary_connection_string
  key_vault_id = azurerm_key_vault.main.id
  
  depends_on = [
    azurerm_role_assignment.app_keyvault_reader
  ]
}

# Store Application Insights Key in Key Vault
resource "azurerm_key_vault_secret" "appinsights_key" {
  count        = var.monitoring_config.enable_application_insights ? 1 : 0
  name         = "appinsights-instrumentation-key"
  value        = azurerm_application_insights.main[0].instrumentation_key
  key_vault_id = azurerm_key_vault.main.id
  
  depends_on = [
    azurerm_role_assignment.app_keyvault_reader
  ]
}

# Encryption Key for Application-Level Encryption
resource "azurerm_key_vault_key" "encryption" {
  name         = "app-encryption-key"
  key_vault_id = azurerm_key_vault.main.id
  key_type     = "RSA"
  key_size     = 4096
  
  key_opts = [
    "decrypt",
    "encrypt",
    "sign",
    "unwrapKey",
    "verify",
    "wrapKey",
  ]
  
  depends_on = [
    azurerm_role_assignment.app_keyvault_reader
  ]
}