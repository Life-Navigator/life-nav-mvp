# Outputs for Backend Configuration

output "state_bucket_name" {
  description = "Name of the S3 bucket for Terraform state"
  value       = aws_s3_bucket.terraform_state.id
}

output "state_bucket_arn" {
  description = "ARN of the S3 bucket for Terraform state"
  value       = aws_s3_bucket.terraform_state.arn
}

output "lock_table_name" {
  description = "Name of the DynamoDB table for state locking"
  value       = aws_dynamodb_table.terraform_locks.id
}

output "lock_table_arn" {
  description = "ARN of the DynamoDB table for state locking"
  value       = aws_dynamodb_table.terraform_locks.arn
}

output "alb_logs_bucket_name" {
  description = "Name of the S3 bucket for ALB logs (if created)"
  value       = var.create_alb_logs_bucket ? aws_s3_bucket.alb_logs[0].id : null
}

output "alb_logs_bucket_arn" {
  description = "ARN of the S3 bucket for ALB logs (if created)"
  value       = var.create_alb_logs_bucket ? aws_s3_bucket.alb_logs[0].arn : null
}

output "backend_configuration" {
  description = "Backend configuration to add to your environment main.tf files"
  value = <<-EOT
    Add this configuration to your environment main.tf files:

    terraform {
      backend "s3" {
        bucket         = "${aws_s3_bucket.terraform_state.id}"
        key            = "<environment>/terraform.tfstate"  # Replace <environment> with dev/staging/production
        region         = "${var.aws_region}"
        dynamodb_table = "${aws_dynamodb_table.terraform_locks.id}"
        encrypt        = true
      }
    }

    Then run:
    terraform init -migrate-state
  EOT
}
