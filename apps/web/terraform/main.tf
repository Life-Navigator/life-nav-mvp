# Configure Azure Provider
provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
    
    key_vault {
      purge_soft_delete_on_destroy = false
      recover_soft_deleted_key_vaults = true
    }
  }
}

# Data source for current subscription
data "azurerm_client_config" "current" {}

# Random suffix for unique resource names
resource "random_string" "unique" {
  length  = 6
  special = false
  upper   = false
}

# Resource naming convention
locals {
  resource_prefix = "${var.project_name}-${var.environment}-${var.location_short}"
  unique_suffix   = random_string.unique.result
  
  # Common tags
  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      CreatedDate = timestamp()
      CostCenter  = "${var.project_name}-${var.environment}"
    },
    var.tags
  )
  
  # Connection strings
  database_connection_string = "postgresql://${azurerm_postgresql_flexible_server.main.administrator_login}@${azurerm_postgresql_flexible_server.main.name}:${random_password.db_password.result}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.main.name}?sslmode=require"
  
  redis_connection_string = var.redis_config.enabled ? azurerm_redis_cache.main[0].primary_connection_string : ""
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "rg-${local.resource_prefix}"
  location = var.location
  tags     = local.common_tags
}

# Managed Identity for App Service
resource "azurerm_user_assigned_identity" "app" {
  name                = "id-${local.resource_prefix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}