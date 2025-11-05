# App Service Plan
resource "azurerm_service_plan" "main" {
  name                = "asp-${local.resource_prefix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  
  # SKU - Start with B2 (Burstable) for cost efficiency
  # B2: 2 cores, 3.5 GB RAM, ~$50/month
  # Can scale to P1v2 when needed: 1 core, 3.5 GB RAM, ~$80/month
  sku_name = var.environment == "prod" ? "P1v2" : var.app_service_config.sku_name
  
  tags = local.common_tags
}

# App Service
resource "azurerm_linux_web_app" "main" {
  name                = "app-${local.resource_prefix}-${local.unique_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.main.id
  
  # Enable HTTPS only
  https_only = true
  
  # Client affinity for session management
  client_affinity_enabled = false  # We use JWT, not sessions
  
  # Virtual network integration
  virtual_network_subnet_id = azurerm_subnet.app_service.id
  
  # Identity
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }
  
  site_config {
    always_on              = var.environment == "prod" ? true : var.app_service_config.always_on
    ftps_state            = var.app_service_config.ftps_state
    http2_enabled         = var.app_service_config.http2_enabled
    minimum_tls_version   = var.app_service_config.minimum_tls_version
    use_32_bit_worker     = false
    websockets_enabled    = false  # Not needed, saves resources
    
    # Health check
    health_check_path                 = var.app_service_config.health_check_path
    health_check_eviction_time_in_min = 5
    
    # Node.js application
    application_stack {
      node_version = "20-lts"
    }
    
    # Auto-heal rules
    auto_heal_enabled = true
    auto_heal_setting {
      trigger {
        status_code {
          status_code_range = "500-599"
          count             = 5
          interval          = "00:05:00"
        }
        
        slow_request {
          time_taken = "00:00:30"
          count      = 5
          interval   = "00:05:00"
        }
      }
      
      action {
        action_type = "Recycle"
        minimum_process_execution_time = "00:01:00"
      }
    }
    
    # CORS (configured in app)
    cors {
      allowed_origins = ["https://${azurerm_cdn_endpoint.main.name}.azureedge.net"]
    }
    
    # IP Restrictions (optional)
    dynamic "ip_restriction" {
      for_each = var.allowed_ip_ranges != ["0.0.0.0/0"] ? var.allowed_ip_ranges : []
      content {
        ip_address = ip_restriction.value
        action     = "Allow"
        priority   = 100
        name       = "AllowedIP${ip_restriction.key}"
      }
    }
  }
  
  # App Settings
  app_settings = merge(
    {
      # Database
      DATABASE_URL = local.database_connection_string
      
      # Redis (if enabled)
      REDIS_URL = var.redis_config.enabled ? local.redis_connection_string : ""
      
      # Node.js
      NODE_ENV                      = var.environment == "prod" ? "production" : var.environment
      WEBSITE_NODE_DEFAULT_VERSION  = "~20"
      WEBSITE_RUN_FROM_PACKAGE      = "1"
      
      # Performance
      WEBSITE_ENABLE_SYNC_UPDATE_SITE = "true"
      WEBSITES_ENABLE_APP_SERVICE_STORAGE = "false"
      
      # Application Insights
      APPINSIGHTS_INSTRUMENTATIONKEY             = var.monitoring_config.enable_application_insights ? azurerm_application_insights.main[0].instrumentation_key : ""
      APPLICATIONINSIGHTS_CONNECTION_STRING      = var.monitoring_config.enable_application_insights ? azurerm_application_insights.main[0].connection_string : ""
      ApplicationInsightsAgent_EXTENSION_VERSION = "~3"
      
      # Storage
      AZURE_STORAGE_ACCOUNT_NAME = azurerm_storage_account.main.name
      AZURE_STORAGE_ACCOUNT_KEY  = azurerm_storage_account.main.primary_access_key
      
      # Cost tracking
      MONTHLY_BUDGET = var.monthly_budget
      ECONOMY_MODE   = var.environment != "prod" ? "true" : "false"
      
      # Cache settings
      CACHE_TTL = var.environment == "prod" ? "300" : "60"
    },
    var.app_settings
  )
  
  # Connection strings
  connection_string {
    name  = "Database"
    type  = "PostgreSQL"
    value = local.database_connection_string
  }
  
  # Logs
  logs {
    detailed_error_messages = var.environment != "prod"
    failed_request_tracing  = var.environment != "prod"
    
    application_logs {
      file_system_level = var.environment == "prod" ? "Error" : "Information"
    }
    
    http_logs {
      file_system {
        retention_in_days = 3
        retention_in_mb   = 35
      }
    }
  }
  
  tags = local.common_tags
  
  depends_on = [
    azurerm_subnet_network_security_group_association.app_service
  ]
  
  lifecycle {
    ignore_changes = [
      app_settings["WEBSITE_RUN_FROM_PACKAGE"],
    ]
  }
}

# Auto-scaling settings
resource "azurerm_monitor_autoscale_setting" "main" {
  name                = "autoscale-${local.resource_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  target_resource_id  = azurerm_service_plan.main.id
  
  profile {
    name = "defaultProfile"
    
    capacity {
      default = var.scaling_config.min_instances
      minimum = var.scaling_config.min_instances
      maximum = var.scaling_config.max_instances
    }
    
    # Scale up rule - CPU
    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.main.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "GreaterThan"
        threshold          = var.scaling_config.scale_up_cpu
      }
      
      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }
    
    # Scale down rule - CPU
    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.main.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT10M"
        time_aggregation   = "Average"
        operator           = "LessThan"
        threshold          = var.scaling_config.scale_down_cpu
      }
      
      scale_action {
        direction = "Decrease"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT10M"
      }
    }
    
    # Scale up rule - Memory
    rule {
      metric_trigger {
        metric_name        = "MemoryPercentage"
        metric_resource_id = azurerm_service_plan.main.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "GreaterThan"
        threshold          = 80
      }
      
      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }
    
    # Scale up rule - HTTP Queue Length
    rule {
      metric_trigger {
        metric_name        = "HttpQueueLength"
        metric_resource_id = azurerm_service_plan.main.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "GreaterThan"
        threshold          = 10
      }
      
      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = "2"  # Scale faster for queue backup
        cooldown  = "PT3M"
      }
    }
  }
  
  # Schedule-based scaling for development/staging
  dynamic "profile" {
    for_each = var.environment != "prod" && var.cost_optimization_features.enable_auto_shutdown ? [1] : []
    
    content {
      name = "nighttime"
      
      capacity {
        default = 0
        minimum = 0
        maximum = 0
      }
      
      recurrence {
        timezone = "Eastern Standard Time"
        hours    = [19]  # 7 PM
        minutes  = [0]
        days     = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
      }
    }
  }
  
  notification {
    email {
      send_to_subscription_administrator    = false
      send_to_subscription_co_administrators = false
      custom_emails                          = var.monitoring_config.alert_email != "" ? [var.monitoring_config.alert_email] : []
    }
  }
  
  tags = local.common_tags
}

# Deployment slots for zero-downtime deployments (production only)
resource "azurerm_linux_web_app_slot" "staging" {
  count          = var.environment == "prod" ? 1 : 0
  name           = "staging"
  app_service_id = azurerm_linux_web_app.main.id
  
  site_config {
    always_on           = false  # Save cost on staging slot
    ftps_state         = "Disabled"
    http2_enabled      = true
    minimum_tls_version = "1.2"
    
    application_stack {
      node_version = "20-lts"
    }
  }
  
  app_settings = azurerm_linux_web_app.main.app_settings
  
  tags = local.common_tags
}