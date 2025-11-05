# Monitoring Module - CloudWatch Dashboards, Alarms, SNS
# Comprehensive observability for the agent system

# ===========================================================================
# SNS Topics for Alerting
# ===========================================================================

# Critical alerts (P0/P1 - immediate action required)
resource "aws_sns_topic" "critical_alerts" {
  name              = "${var.environment}-agent-critical-alerts"
  display_name      = "Critical Alerts - ${var.environment}"
  kms_master_key_id = var.kms_key_id

  tags = merge(
    var.tags,
    {
      Name     = "${var.environment}-critical-alerts"
      Severity = "critical"
    }
  )
}

# Warning alerts (P2 - action required within hours)
resource "aws_sns_topic" "warning_alerts" {
  name              = "${var.environment}-agent-warning-alerts"
  display_name      = "Warning Alerts - ${var.environment}"
  kms_master_key_id = var.kms_key_id

  tags = merge(
    var.tags,
    {
      Name     = "${var.environment}-warning-alerts"
      Severity = "warning"
    }
  )
}

# Info alerts (P3 - informational)
resource "aws_sns_topic" "info_alerts" {
  name              = "${var.environment}-agent-info-alerts"
  display_name      = "Info Alerts - ${var.environment}"
  kms_master_key_id = var.kms_key_id

  tags = merge(
    var.tags,
    {
      Name     = "${var.environment}-info-alerts"
      Severity = "info"
    }
  )
}

# SNS Topic Subscriptions (email)
resource "aws_sns_topic_subscription" "critical_email" {
  count = length(var.critical_alert_emails) > 0 ? length(var.critical_alert_emails) : 0

  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "email"
  endpoint  = var.critical_alert_emails[count.index]
}

resource "aws_sns_topic_subscription" "warning_email" {
  count = length(var.warning_alert_emails) > 0 ? length(var.warning_alert_emails) : 0

  topic_arn = aws_sns_topic.warning_alerts.arn
  protocol  = "email"
  endpoint  = var.warning_alert_emails[count.index]
}

# ===========================================================================
# ECS Service Alarms
# ===========================================================================

# ECS Service Running Task Count
resource "aws_cloudwatch_metric_alarm" "ecs_running_tasks_low" {
  alarm_name          = "${var.environment}-ecs-running-tasks-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 60
  statistic           = "Average"
  threshold           = var.min_task_count
  alarm_description   = "Alert when ECS running task count drops below ${var.min_task_count}"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  tags = var.tags
}

# ECS Service CPU Utilization
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "${var.environment}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "Alert when ECS CPU exceeds 85%"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  tags = var.tags
}

# ECS Service Memory Utilization
resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  alarm_name          = "${var.environment}-ecs-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 90
  alarm_description   = "Alert when ECS memory exceeds 90%"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  tags = var.tags
}

# ===========================================================================
# ALB Alarms
# ===========================================================================

# ALB Target Health
resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_targets" {
  alarm_name          = "${var.environment}-alb-unhealthy-targets"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "Alert when ALB has unhealthy targets"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  tags = var.tags
}

# ALB 5XX Error Rate
resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  alarm_name          = "${var.environment}-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Alert when ALB 5XX errors exceed 10 in 5 minutes"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = var.tags
}

# ALB Response Time
resource "aws_cloudwatch_metric_alarm" "alb_response_time" {
  alarm_name          = "${var.environment}-alb-slow-response"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Average"
  threshold           = 5.0 # 5 seconds
  alarm_description   = "Alert when ALB response time exceeds 5 seconds"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = var.tags
}

# ALB Request Count (traffic spike detection)
resource "aws_cloudwatch_metric_alarm" "alb_traffic_spike" {
  alarm_name          = "${var.environment}-alb-traffic-spike"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "RequestCount"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.request_count_spike_threshold
  alarm_description   = "Alert when request count spikes above ${var.request_count_spike_threshold}"
  alarm_actions       = [aws_sns_topic.info_alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = var.tags
}

# ===========================================================================
# Application Log Alarms
# ===========================================================================

# Log Metric Filter for ERROR logs
resource "aws_cloudwatch_log_metric_filter" "error_logs" {
  name           = "${var.environment}-error-logs"
  log_group_name = var.cloudwatch_log_group_name
  pattern        = "[time, request_id, level = ERROR*, ...]"

  metric_transformation {
    name      = "ErrorLogCount"
    namespace = "${var.environment}/AgentSystem"
    value     = "1"
    unit      = "Count"
  }
}

resource "aws_cloudwatch_metric_alarm" "error_log_rate" {
  alarm_name          = "${var.environment}-error-log-rate-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ErrorLogCount"
  namespace           = "${var.environment}/AgentSystem"
  period              = 300
  statistic           = "Sum"
  threshold           = 20
  alarm_description   = "Alert when error logs exceed 20 in 5 minutes"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  tags = var.tags
}

# Log Metric Filter for CRITICAL logs
resource "aws_cloudwatch_log_metric_filter" "critical_logs" {
  name           = "${var.environment}-critical-logs"
  log_group_name = var.cloudwatch_log_group_name
  pattern        = "[time, request_id, level = CRITICAL*, ...]"

  metric_transformation {
    name      = "CriticalLogCount"
    namespace = "${var.environment}/AgentSystem"
    value     = "1"
    unit      = "Count"
  }
}

resource "aws_cloudwatch_metric_alarm" "critical_logs" {
  alarm_name          = "${var.environment}-critical-logs-detected"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "CriticalLogCount"
  namespace           = "${var.environment}/AgentSystem"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Alert immediately when critical logs are detected"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  tags = var.tags
}

# Log Metric Filter for Task Failures
resource "aws_cloudwatch_log_metric_filter" "task_failures" {
  name           = "${var.environment}-task-failures"
  log_group_name = var.cloudwatch_log_group_name
  pattern        = "{ $.status = \"failed\" }"

  metric_transformation {
    name      = "TaskFailureCount"
    namespace = "${var.environment}/AgentSystem"
    value     = "1"
    unit      = "Count"
  }
}

resource "aws_cloudwatch_metric_alarm" "task_failure_rate" {
  alarm_name          = "${var.environment}-task-failure-rate-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TaskFailureCount"
  namespace           = "${var.environment}/AgentSystem"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Alert when task failures exceed 10 in 5 minutes"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  tags = var.tags
}

# ===========================================================================
# Composite Alarms
# ===========================================================================

# System Health Composite Alarm
resource "aws_cloudwatch_composite_alarm" "system_degraded" {
  alarm_name          = "${var.environment}-system-degraded"
  alarm_description   = "Composite alarm indicating system degradation"
  actions_enabled     = true
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]

  alarm_rule = "ALARM(${aws_cloudwatch_metric_alarm.ecs_running_tasks_low.alarm_name}) OR ALARM(${aws_cloudwatch_metric_alarm.alb_unhealthy_targets.alarm_name}) OR ALARM(${aws_cloudwatch_metric_alarm.critical_logs.alarm_name})"

  tags = var.tags
}

# Performance Degradation Composite Alarm
resource "aws_cloudwatch_composite_alarm" "performance_degraded" {
  alarm_name          = "${var.environment}-performance-degraded"
  alarm_description   = "Composite alarm indicating performance issues"
  actions_enabled     = true
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  alarm_rule = "(ALARM(${aws_cloudwatch_metric_alarm.ecs_cpu_high.alarm_name}) AND ALARM(${aws_cloudwatch_metric_alarm.alb_response_time.alarm_name})) OR (ALARM(${aws_cloudwatch_metric_alarm.ecs_memory_high.alarm_name}) AND ALARM(${aws_cloudwatch_metric_alarm.alb_response_time.alarm_name}))"

  tags = var.tags
}

# ===========================================================================
# CloudWatch Dashboard
# ===========================================================================

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.environment}-agent-system"

  dashboard_body = jsonencode({
    widgets = [
      # ===========================================================================
      # Row 1: System Health Overview
      # ===========================================================================
      {
        type = "metric"
        properties = {
          title   = "ECS Running Tasks"
          region  = var.aws_region
          stat    = "Average"
          period  = 300
          metrics = [
            ["ECS/ContainerInsights", "RunningTaskCount", { "ClusterName" = var.ecs_cluster_name, "ServiceName" = var.ecs_service_name }]
          ]
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 8
        height = 6
        x      = 0
        y      = 0
      },
      {
        type = "metric"
        properties = {
          title   = "ALB Target Health"
          region  = var.aws_region
          stat    = "Average"
          period  = 60
          metrics = [
            ["AWS/ApplicationELB", "HealthyHostCount", { "LoadBalancer" = var.alb_arn_suffix, "TargetGroup" = var.target_group_arn_suffix }, { "color" = "#2ca02c" }],
            [".", "UnHealthyHostCount", { "." = ".", "." = "." }, { "color" = "#d62728" }]
          ]
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 8
        height = 6
        x      = 8
        y      = 0
      },
      {
        type = "metric"
        properties = {
          title   = "Request Count"
          region  = var.aws_region
          stat    = "Sum"
          period  = 300
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", { "LoadBalancer" = var.alb_arn_suffix }]
          ]
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 8
        height = 6
        x      = 16
        y      = 0
      },

      # ===========================================================================
      # Row 2: Performance Metrics
      # ===========================================================================
      {
        type = "metric"
        properties = {
          title   = "ECS CPU Utilization"
          region  = var.aws_region
          stat    = "Average"
          period  = 300
          metrics = [
            ["AWS/ECS", "CPUUtilization", { "ClusterName" = var.ecs_cluster_name, "ServiceName" = var.ecs_service_name }]
          ]
          yAxis = {
            left = {
              min = 0
              max = 100
            }
          }
          annotations = {
            horizontal = [
              {
                value = 85
                label = "High CPU Threshold"
                color = "#ff7f0e"
              }
            ]
          }
        }
        width  = 8
        height = 6
        x      = 0
        y      = 6
      },
      {
        type = "metric"
        properties = {
          title   = "ECS Memory Utilization"
          region  = var.aws_region
          stat    = "Average"
          period  = 300
          metrics = [
            ["AWS/ECS", "MemoryUtilization", { "ClusterName" = var.ecs_cluster_name, "ServiceName" = var.ecs_service_name }]
          ]
          yAxis = {
            left = {
              min = 0
              max = 100
            }
          }
          annotations = {
            horizontal = [
              {
                value = 90
                label = "High Memory Threshold"
                color = "#ff7f0e"
              }
            ]
          }
        }
        width  = 8
        height = 6
        x      = 8
        y      = 6
      },
      {
        type = "metric"
        properties = {
          title   = "ALB Response Time"
          region  = var.aws_region
          stat    = "Average"
          period  = 300
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", { "LoadBalancer" = var.alb_arn_suffix }, { "stat" = "Average", "label" = "Avg" }],
            ["...", { "stat" = "p50", "label" = "p50" }],
            ["...", { "stat" = "p90", "label" = "p90" }],
            ["...", { "stat" = "p99", "label" = "p99" }]
          ]
          yAxis = {
            left = {
              min = 0
            }
          }
          annotations = {
            horizontal = [
              {
                value = 5.0
                label = "Slow Response Threshold"
                color = "#ff7f0e"
              }
            ]
          }
        }
        width  = 8
        height = 6
        x      = 16
        y      = 6
      },

      # ===========================================================================
      # Row 3: Database Metrics
      # ===========================================================================
      {
        type = "metric"
        properties = {
          title   = "RDS CPU & Connections"
          region  = var.aws_region
          stat    = "Average"
          period  = 300
          metrics = [
            ["AWS/RDS", "CPUUtilization", { "DBInstanceIdentifier" = var.rds_instance_id }],
            [".", "DatabaseConnections", { "." = "." }]
          ]
          yAxis = {
            left = {
              label = "CPU %"
              min   = 0
              max   = 100
            }
            right = {
              label = "Connections"
              min   = 0
            }
          }
        }
        width  = 8
        height = 6
        x      = 0
        y      = 12
      },
      {
        type = "metric"
        properties = {
          title   = "Redis CPU & Memory"
          region  = var.aws_region
          stat    = "Average"
          period  = 300
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", { "ReplicationGroupId" = var.redis_replication_group_id }],
            [".", "DatabaseMemoryUsagePercentage", { "." = "." }]
          ]
          yAxis = {
            left = {
              min = 0
              max = 100
            }
          }
        }
        width  = 8
        height = 6
        x      = 8
        y      = 12
      },
      {
        type = "metric"
        properties = {
          title   = "Database I/O"
          region  = var.aws_region
          stat    = "Average"
          period  = 300
          metrics = [
            ["AWS/RDS", "ReadIOPS", { "DBInstanceIdentifier" = var.rds_instance_id }, { "label" = "RDS Read IOPS" }],
            [".", "WriteIOPS", { "." = "." }, { "label" = "RDS Write IOPS" }]
          ]
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 8
        height = 6
        x      = 16
        y      = 12
      },

      # ===========================================================================
      # Row 4: Error Rates
      # ===========================================================================
      {
        type = "metric"
        properties = {
          title   = "ALB Error Rates"
          region  = var.aws_region
          stat    = "Sum"
          period  = 300
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", { "LoadBalancer" = var.alb_arn_suffix }, { "color" = "#ff7f0e", "label" = "4XX Errors" }],
            [".", "HTTPCode_Target_5XX_Count", { "." = "." }, { "color" = "#d62728", "label" = "5XX Errors" }]
          ]
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 12
        height = 6
        x      = 0
        y      = 18
      },
      {
        type = "metric"
        properties = {
          title   = "Application Error & Critical Logs"
          region  = var.aws_region
          stat    = "Sum"
          period  = 300
          metrics = [
            ["${var.environment}/AgentSystem", "ErrorLogCount", { "label" = "Error Logs", "color" = "#ff7f0e" }],
            [".", "CriticalLogCount", { "label" = "Critical Logs", "color" = "#d62728" }],
            [".", "TaskFailureCount", { "label" = "Task Failures", "color" = "#9467bd" }]
          ]
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 12
        height = 6
        x      = 12
        y      = 18
      },

      # ===========================================================================
      # Row 5: Alarms Status
      # ===========================================================================
      {
        type = "alarm"
        properties = {
          title  = "Active Alarms"
          alarms = [
            aws_cloudwatch_composite_alarm.system_degraded.arn,
            aws_cloudwatch_composite_alarm.performance_degraded.arn,
            aws_cloudwatch_metric_alarm.ecs_running_tasks_low.arn,
            aws_cloudwatch_metric_alarm.alb_unhealthy_targets.arn,
            aws_cloudwatch_metric_alarm.critical_logs.arn,
            aws_cloudwatch_metric_alarm.error_log_rate.arn
          ]
        }
        width  = 24
        height = 4
        x      = 0
        y      = 24
      }
    ]
  })
}
