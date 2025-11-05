# Additional Security for Full Production Compliance
# Add these resources for complete security

# Web Application Firewall (WAF)
resource "azurerm_frontdoor_firewall_policy" "main" {
  count               = var.environment == "prod" ? 1 : 0
  name                = "waf${replace(local.resource_prefix, "-", "")}"
  resource_group_name = azurerm_resource_group.main.name
  
  enabled = true
  mode    = "Prevention"  # Block malicious requests
  
  # OWASP Rules
  managed_rule {
    type    = "DefaultRuleSet"
    version = "1.0"
    
    override {
      rule_group_name = "SQLI"
      rule {
        rule_id = "942430"
        enabled = true
        action  = "Block"
      }
    }
  }
  
  # Custom rules for your app
  custom_rule {
    name      = "RateLimitRule"
    priority  = 1
    rule_type = "RateLimiting"
    
    match_condition {
      match_variable     = "RemoteAddr"
      operator           = "IPMatch"
      negation_condition = false
      match_values       = ["0.0.0.0/0"]
    }
    
    action               = "Block"
    rate_limit_threshold = 1000
    rate_limit_duration  = "OneMin"
  }
  
  tags = local.common_tags
}

# Azure Security Center (Defender for Cloud)
resource "azurerm_security_center_subscription_pricing" "defender_app_service" {
  count         = var.environment == "prod" ? 1 : 0
  tier          = "Standard"  # Enables Defender (~$15/month)
  resource_type = "AppServices"
}

resource "azurerm_security_center_subscription_pricing" "defender_sql" {
  count         = var.environment == "prod" ? 1 : 0
  tier          = "Standard"  # Enables Defender for SQL (~$15/month)
  resource_type = "SqlServers"
}

resource "azurerm_security_center_subscription_pricing" "defender_storage" {
  count         = var.environment == "prod" ? 1 : 0
  tier          = "Standard"  # Enables Defender for Storage (~$10/month)
  resource_type = "StorageAccounts"
}

# Compliance: Immutable Audit Log Storage
resource "azurerm_storage_account" "audit_logs" {
  count                    = var.environment == "prod" ? 1 : 0
  name                     = "auditlog${replace(local.resource_prefix, "-", "")}${local.unique_suffix}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "GRS"
  
  # Immutable storage for compliance
  immutability_policy {
    allow_protected_append_writes = false
    state                        = "Locked"
    period_since_creation_in_days = 2555  # 7 years
  }
  
  # Legal hold for compliance
  blob_properties {
    versioning_enabled = true
    
    delete_retention_policy {
      days = 365  # Keep deleted items for 1 year
    }
    
    container_delete_retention_policy {
      days = 365
    }
  }
  
  tags = merge(local.common_tags, {
    Compliance = "Audit-Logs"
    Immutable  = "true"
  })
}

# Data Loss Prevention (DLP) Policy
resource "azurerm_policy_definition" "dlp_policy" {
  count        = var.environment == "prod" ? 1 : 0
  name         = "dlp-${local.resource_prefix}"
  policy_type  = "Custom"
  mode         = "All"
  display_name = "Data Loss Prevention Policy"
  
  metadata = jsonencode({
    category = "Data Protection"
  })
  
  policy_rule = jsonencode({
    if = {
      allOf = [
        {
          field  = "type"
          equals = "Microsoft.Storage/storageAccounts"
        }
      ]
    }
    then = {
      effect = "audit"
      details = {
        type = "Microsoft.Security/dataClassifications"
      }
    }
  })
}

# Regulatory Compliance Assessment
resource "azurerm_security_center_assessment_policy" "hipaa" {
  count            = var.environment == "prod" ? 1 : 0
  display_name     = "HIPAA Compliance"
  severity         = "High"
  description      = "Ensure HIPAA compliance for health data"
  
  implementation_effort = "Moderate"
  remediation_description = "Enable encryption and audit logging"
  
  user_impact = "Low"
  
  categories = ["Data Protection", "Compliance"]
}

# Advanced Threat Protection
resource "azurerm_advanced_threat_protection" "storage" {
  count              = var.environment == "prod" ? 1 : 0
  target_resource_id = azurerm_storage_account.main.id
  enabled           = true
}

resource "azurerm_postgresql_flexible_server_configuration" "threat_protection" {
  count     = var.environment == "prod" ? 1 : 0
  name      = "log_connections"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "on"
}

# Network Watcher for security monitoring
resource "azurerm_network_watcher" "main" {
  count               = var.environment == "prod" ? 1 : 0
  name                = "nw-${local.resource_prefix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  
  tags = local.common_tags
}

# NSG Flow Logs for security audit
resource "azurerm_network_watcher_flow_log" "app_service" {
  count                    = var.environment == "prod" ? 1 : 0
  network_watcher_name     = azurerm_network_watcher.main[0].name
  resource_group_name      = azurerm_resource_group.main.name
  name                     = "flowlog-app-${local.resource_prefix}"
  
  network_security_group_id = azurerm_network_security_group.app_service.id
  storage_account_id        = azurerm_storage_account.audit_logs[0].id
  enabled                   = true
  version                   = 2
  
  retention_policy {
    enabled = true
    days    = 90
  }
  
  traffic_analytics {
    enabled               = true
    workspace_id          = azurerm_log_analytics_workspace.main[0].workspace_id
    workspace_region      = azurerm_log_analytics_workspace.main[0].location
    workspace_resource_id = azurerm_log_analytics_workspace.main[0].id
    interval_in_minutes   = 10
  }
}