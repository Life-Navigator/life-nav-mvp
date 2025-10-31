# Outputs for Database Module

# ===========================================================================
# RDS PostgreSQL Outputs
# ===========================================================================

output "rds_endpoint" {
  description = "RDS instance endpoint (host:port)"
  value       = aws_db_instance.main.endpoint
}

output "rds_address" {
  description = "RDS instance address (hostname only)"
  value       = aws_db_instance.main.address
}

output "rds_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "rds_db_name" {
  description = "Name of the default database"
  value       = aws_db_instance.main.db_name
}

output "rds_username" {
  description = "Master username for RDS"
  value       = aws_db_instance.main.username
  sensitive   = true
}

output "rds_password_secret_arn" {
  description = "ARN of the Secrets Manager secret containing RDS password"
  value       = aws_secretsmanager_secret.db_password.arn
}

output "rds_connection_string" {
  description = "PostgreSQL connection string (without password)"
  value       = "postgresql://${aws_db_instance.main.username}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${aws_db_instance.main.db_name}"
  sensitive   = true
}

output "rds_security_group_id" {
  description = "Security group ID for RDS instance"
  value       = aws_security_group.rds.id
}

output "rds_instance_id" {
  description = "RDS instance identifier"
  value       = aws_db_instance.main.id
}

output "rds_arn" {
  description = "ARN of the RDS instance"
  value       = aws_db_instance.main.arn
}

# ===========================================================================
# ElastiCache Redis Outputs
# ===========================================================================

output "redis_endpoint" {
  description = "Redis primary endpoint (host:port)"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Redis reader endpoint for read replicas (if Multi-AZ enabled)"
  value       = var.redis_num_cache_nodes > 1 ? aws_elasticache_replication_group.main.reader_endpoint_address : null
}

output "redis_port" {
  description = "Redis port"
  value       = 6379
}

output "redis_auth_token_secret_arn" {
  description = "ARN of the Secrets Manager secret containing Redis auth token"
  value       = aws_secretsmanager_secret.redis_auth_token.arn
}

output "redis_connection_string" {
  description = "Redis connection string (rediss:// for TLS)"
  value       = "rediss://:@${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
  sensitive   = true
}

output "redis_security_group_id" {
  description = "Security group ID for Redis cluster"
  value       = aws_security_group.redis.id
}

output "redis_replication_group_id" {
  description = "Redis replication group identifier"
  value       = aws_elasticache_replication_group.main.id
}

output "redis_arn" {
  description = "ARN of the Redis replication group"
  value       = aws_elasticache_replication_group.main.arn
}

# ===========================================================================
# Combined Database Configuration
# ===========================================================================

output "database_config" {
  description = "Combined database configuration for ECS task definitions"
  value = {
    # PostgreSQL
    postgres_host     = aws_db_instance.main.address
    postgres_port     = aws_db_instance.main.port
    postgres_database = aws_db_instance.main.db_name
    postgres_username = aws_db_instance.main.username
    postgres_password_secret_arn = aws_secretsmanager_secret.db_password.arn

    # Redis
    redis_host     = aws_elasticache_replication_group.main.primary_endpoint_address
    redis_port     = 6379
    redis_auth_token_secret_arn = aws_secretsmanager_secret.redis_auth_token.arn

    # Security Groups
    rds_security_group_id   = aws_security_group.rds.id
    redis_security_group_id = aws_security_group.redis.id
  }
  sensitive = true
}

# ===========================================================================
# CloudWatch Alarm ARNs
# ===========================================================================

output "rds_cpu_alarm_arn" {
  description = "ARN of RDS CPU utilization alarm"
  value       = aws_cloudwatch_metric_alarm.rds_cpu.arn
}

output "rds_storage_alarm_arn" {
  description = "ARN of RDS storage alarm"
  value       = aws_cloudwatch_metric_alarm.rds_storage.arn
}

output "redis_cpu_alarm_arn" {
  description = "ARN of Redis CPU utilization alarm"
  value       = aws_cloudwatch_metric_alarm.redis_cpu.arn
}

output "redis_memory_alarm_arn" {
  description = "ARN of Redis memory utilization alarm"
  value       = aws_cloudwatch_metric_alarm.redis_memory.arn
}
