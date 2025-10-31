# Database Module - RDS PostgreSQL and ElastiCache Redis
# Production-ready with Multi-AZ, automated backups, and encryption

# Random password for RDS
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Store password in AWS Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name_prefix             = "${var.environment}-db-password-"
  description             = "RDS PostgreSQL password for ${var.environment}"
  recovery_window_in_days = var.environment == "production" ? 30 : 0

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

# ===========================================================================
# RDS PostgreSQL
# ===========================================================================

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name_prefix = "${var.environment}-db-subnet-group-"
  description = "Database subnet group for ${var.environment}"
  subnet_ids  = var.private_subnet_ids

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-db-subnet-group"
    }
  )
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  name_prefix = "${var.environment}-rds-"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.ecs_security_group_id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-rds-sg"
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "main" {
  identifier     = "${var.environment}-graphrag-db"
  engine         = "postgres"
  engine_version = var.postgres_version

  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # High Availability
  multi_az = var.enable_multi_az

  # Backups
  backup_retention_period = var.backup_retention_period
  backup_window           = "03:00-04:00" # 3-4 AM UTC
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Monitoring
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  monitoring_interval             = var.enable_enhanced_monitoring ? 60 : 0
  monitoring_role_arn             = var.enable_enhanced_monitoring ? aws_iam_role.rds_monitoring[0].arn : null

  # Performance Insights
  performance_insights_enabled    = var.enable_performance_insights
  performance_insights_retention_period = var.enable_performance_insights ? 7 : null

  # Protection
  deletion_protection = var.environment == "production" ? true : false
  skip_final_snapshot = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${var.environment}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null

  # Auto minor version upgrades
  auto_minor_version_upgrade = true

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-graphrag-db"
    }
  )
}

# IAM Role for Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring" {
  count = var.enable_enhanced_monitoring ? 1 : 0

  name_prefix = "${var.environment}-rds-monitoring-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  managed_policy_arns = [
    "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
  ]

  tags = var.tags
}

# ===========================================================================
# ElastiCache Redis
# ===========================================================================

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name_prefix = "${var.environment}-redis-subnet-"
  description = "ElastiCache subnet group for ${var.environment}"
  subnet_ids  = var.private_subnet_ids

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis-subnet-group"
    }
  )
}

# Security Group for Redis
resource "aws_security_group" "redis" {
  name_prefix = "${var.environment}-redis-"
  description = "Security group for ElastiCache Redis"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.ecs_security_group_id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis-sg"
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

# ElastiCache Redis Replication Group
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.environment}-redis"
  description          = "Redis cluster for ${var.environment}"

  engine               = "redis"
  engine_version       = var.redis_version
  node_type            = var.redis_node_type
  num_cache_clusters   = var.redis_num_cache_nodes
  parameter_group_name = aws_elasticache_parameter_group.main.name

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # High Availability
  automatic_failover_enabled = var.redis_num_cache_nodes > 1
  multi_az_enabled           = var.redis_num_cache_nodes > 1

  # Encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token_enabled         = true
  auth_token                 = random_password.redis_auth_token.result

  # Backups
  snapshot_retention_limit = var.redis_snapshot_retention_limit
  snapshot_window          = "03:00-05:00" # 3-5 AM UTC
  maintenance_window       = "sun:05:00-sun:07:00"

  # Auto minor version upgrades
  auto_minor_version_upgrade = true

  # Notifications
  notification_topic_arn = var.sns_topic_arn

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-redis"
    }
  )
}

# Random auth token for Redis
resource "random_password" "redis_auth_token" {
  length  = 32
  special = false # Redis doesn't support special characters in auth token
}

# Store Redis auth token in Secrets Manager
resource "aws_secretsmanager_secret" "redis_auth_token" {
  name_prefix             = "${var.environment}-redis-token-"
  description             = "Redis auth token for ${var.environment}"
  recovery_window_in_days = var.environment == "production" ? 30 : 0

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id     = aws_secretsmanager_secret.redis_auth_token.id
  secret_string = random_password.redis_auth_token.result
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  name_prefix = "${var.environment}-redis-params-"
  family      = "redis7"
  description = "Custom parameter group for ${var.environment}"

  # Optimize for agent caching workload
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru" # Evict least recently used keys
  }

  parameter {
    name  = "timeout"
    value = "300" # 5 minutes idle timeout
  }

  tags = var.tags

  lifecycle {
    create_before_destroy = true
  }
}

# ===========================================================================
# CloudWatch Alarms
# ===========================================================================

# RDS CPU Alarm
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.environment}-rds-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Alert when RDS CPU exceeds 80%"
  alarm_actions       = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = var.tags
}

# RDS Storage Alarm
resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  alarm_name          = "${var.environment}-rds-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10737418240 # 10 GB in bytes
  alarm_description   = "Alert when RDS free storage falls below 10GB"
  alarm_actions       = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = var.tags
}

# Redis CPU Alarm
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${var.environment}-redis-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 75
  alarm_description   = "Alert when Redis CPU exceeds 75%"
  alarm_actions       = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main.id
  }

  tags = var.tags
}

# Redis Memory Alarm
resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  alarm_name          = "${var.environment}-redis-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 90
  alarm_description   = "Alert when Redis memory usage exceeds 90%"
  alarm_actions       = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main.id
  }

  tags = var.tags
}
