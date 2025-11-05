# Log Analytics Workspace
resource "azurerm_log_analytics_workspace" "main" {
  count               = var.monitoring_config.enable_application_insights ? 1 : 0
  name                = "log-${local.resource_prefix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = var.monitoring_config.retention_days
  
  tags = local.common_tags
}

# Application Insights
resource "azurerm_application_insights" "main" {
  count                      = var.monitoring_config.enable_application_insights ? 1 : 0
  name                       = "appi-${local.resource_prefix}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  workspace_id               = azurerm_log_analytics_workspace.main[0].id
  application_type           = "web"
  retention_in_days          = var.monitoring_config.retention_days
  sampling_percentage        = var.environment == "prod" ? 100 : 50  # Sample less in dev to save cost
  daily_data_cap_in_gb      = var.environment == "prod" ? 5 : 1     # Cap daily data to control costs
  daily_data_cap_notifications_disabled = false
  
  tags = local.common_tags
}

# Action Group for Alerts
resource "azurerm_monitor_action_group" "main" {
  count               = var.monitoring_config.enable_alerts ? 1 : 0
  name                = "ag-${local.resource_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  short_name          = substr(var.project_name, 0, 12)
  
  dynamic "email_receiver" {
    for_each = var.monitoring_config.alert_email != "" ? [1] : []
    content {
      name          = "email-alert"
      email_address = var.monitoring_config.alert_email
    }
  }
  
  tags = local.common_tags
}

# Budget Alert
resource "azurerm_consumption_budget_resource_group" "main" {
  name              = "budget-${local.resource_prefix}"
  resource_group_id = azurerm_resource_group.main.id
  
  amount     = var.monthly_budget
  time_grain = "Monthly"
  
  time_period {
    start_date = formatdate("YYYY-MM-01'T'00:00:00Z", timestamp())
  }
  
  dynamic "notification" {
    for_each = var.budget_alert_thresholds
    content {
      enabled   = true
      threshold = notification.value
      operator  = "GreaterThan"
      
      contact_emails = var.monitoring_config.alert_email != "" ? [var.monitoring_config.alert_email] : []
    }
  }
}

# App Service CPU Alert
resource "azurerm_monitor_metric_alert" "app_cpu" {
  count               = var.monitoring_config.enable_alerts ? 1 : 0
  name                = "alert-app-cpu-${local.resource_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_service_plan.main.id]
  description         = "Alert when App Service CPU exceeds threshold"
  severity            = 2
  
  criteria {
    metric_namespace = "Microsoft.Web/serverfarms"
    metric_name      = "CpuPercentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 85
  }
  
  window_size = "PT5M"
  frequency   = "PT1M"
  
  action {
    action_group_id = azurerm_monitor_action_group.main[0].id
  }
  
  tags = local.common_tags
}

# App Service Memory Alert
resource "azurerm_monitor_metric_alert" "app_memory" {
  count               = var.monitoring_config.enable_alerts ? 1 : 0
  name                = "alert-app-memory-${local.resource_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_service_plan.main.id]
  description         = "Alert when App Service Memory exceeds threshold"
  severity            = 2
  
  criteria {
    metric_namespace = "Microsoft.Web/serverfarms"
    metric_name      = "MemoryPercentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 85
  }
  
  window_size = "PT5M"
  frequency   = "PT1M"
  
  action {
    action_group_id = azurerm_monitor_action_group.main[0].id
  }
  
  tags = local.common_tags
}

# App Service Response Time Alert
resource "azurerm_monitor_metric_alert" "app_response_time" {
  count               = var.monitoring_config.enable_alerts ? 1 : 0
  name                = "alert-app-response-${local.resource_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_linux_web_app.main.id]
  description         = "Alert when response time is slow"
  severity            = 3
  
  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "HttpResponseTime"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 2  # 2 seconds
  }
  
  window_size = "PT5M"
  frequency   = "PT5M"
  
  action {
    action_group_id = azurerm_monitor_action_group.main[0].id
  }
  
  tags = local.common_tags
}

# App Service HTTP 5xx Errors Alert
resource "azurerm_monitor_metric_alert" "app_http_5xx" {
  count               = var.monitoring_config.enable_alerts ? 1 : 0
  name                = "alert-app-5xx-${local.resource_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_linux_web_app.main.id]
  description         = "Alert on HTTP 5xx errors"
  severity            = 1
  
  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "Http5xx"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = 10
  }
  
  window_size = "PT5M"
  frequency   = "PT1M"
  
  action {
    action_group_id = azurerm_monitor_action_group.main[0].id
  }
  
  tags = local.common_tags
}

# Storage Account Availability Alert
resource "azurerm_monitor_metric_alert" "storage_availability" {
  count               = var.monitoring_config.enable_alerts ? 1 : 0
  name                = "alert-storage-availability-${local.resource_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_storage_account.main.id]
  description         = "Alert when storage availability is low"
  severity            = 1
  
  criteria {
    metric_namespace = "Microsoft.Storage/storageAccounts"
    metric_name      = "Availability"
    aggregation      = "Average"
    operator         = "LessThan"
    threshold        = 99.9
  }
  
  window_size = "PT5M"
  frequency   = "PT5M"
  
  action {
    action_group_id = azurerm_monitor_action_group.main[0].id
  }
  
  tags = local.common_tags
}

# Diagnostic Settings for App Service
resource "azurerm_monitor_diagnostic_setting" "app_service" {
  count                      = var.monitoring_config.enable_application_insights ? 1 : 0
  name                       = "diag-app-${local.resource_prefix}"
  target_resource_id         = azurerm_linux_web_app.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main[0].id
  
  enabled_log {
    category = "AppServiceHTTPLogs"
  }
  
  enabled_log {
    category = "AppServiceConsoleLogs"
  }
  
  enabled_log {
    category = "AppServiceAppLogs"
  }
  
  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

# Diagnostic Settings for PostgreSQL
resource "azurerm_monitor_diagnostic_setting" "postgresql" {
  count                      = var.monitoring_config.enable_application_insights ? 1 : 0
  name                       = "diag-db-${local.resource_prefix}"
  target_resource_id         = azurerm_postgresql_flexible_server.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main[0].id
  
  enabled_log {
    category = "PostgreSQLLogs"
  }
  
  metric {
    category = "AllMetrics"
    enabled  = true
  }
}