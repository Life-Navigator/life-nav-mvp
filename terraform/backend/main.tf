# Backend Configuration - S3 + DynamoDB for Terraform State
# This must be deployed FIRST before any other Terraform configuration
# Run this once to set up remote state storage

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # NOTE: This configuration uses LOCAL state since it creates the backend
  # After running this, you can configure remote state in your environments
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "Life Navigator Agent System"
      Component = "Terraform Backend"
      ManagedBy = "Terraform"
    }
  }
}

# ===========================================================================
# S3 Bucket for Terraform State
# ===========================================================================

resource "aws_s3_bucket" "terraform_state" {
  bucket = var.state_bucket_name

  # Prevent accidental deletion
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name        = var.state_bucket_name
    Description = "Terraform state storage"
  }
}

# Enable versioning to keep history of state files
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Enable server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle policy to clean up old versions
resource "aws_s3_bucket_lifecycle_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    id     = "delete-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Bucket policy for secure access
resource "aws_s3_bucket_policy" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnforcedTLS"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.terraform_state.arn,
          "${aws_s3_bucket.terraform_state.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# ===========================================================================
# DynamoDB Table for State Locking
# ===========================================================================

resource "aws_dynamodb_table" "terraform_locks" {
  name         = var.lock_table_name
  billing_mode = "PAY_PER_REQUEST" # On-demand pricing for infrequent access
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  # Enable point-in-time recovery
  point_in_time_recovery {
    enabled = true
  }

  # Enable encryption at rest
  server_side_encryption {
    enabled = true
  }

  # Prevent accidental deletion
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name        = var.lock_table_name
    Description = "Terraform state locking"
  }
}

# ===========================================================================
# Optional: S3 Bucket for ALB Logs
# ===========================================================================

resource "aws_s3_bucket" "alb_logs" {
  count = var.create_alb_logs_bucket ? 1 : 0

  bucket = var.alb_logs_bucket_name

  tags = {
    Name        = var.alb_logs_bucket_name
    Description = "ALB access logs"
  }
}

resource "aws_s3_bucket_versioning" "alb_logs" {
  count = var.create_alb_logs_bucket ? 1 : 0

  bucket = aws_s3_bucket.alb_logs[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  count = var.create_alb_logs_bucket ? 1 : 0

  bucket = aws_s3_bucket.alb_logs[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  count = var.create_alb_logs_bucket ? 1 : 0

  bucket = aws_s3_bucket.alb_logs[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle policy for ALB logs (delete after 90 days)
resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  count = var.create_alb_logs_bucket ? 1 : 0

  bucket = aws_s3_bucket.alb_logs[0].id

  rule {
    id     = "delete-old-logs"
    status = "Enabled"

    expiration {
      days = 90
    }
  }
}

# Bucket policy to allow ALB to write logs
# Note: You'll need to update the ELB account ID based on your region
# See: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/enable-access-logging.html
resource "aws_s3_bucket_policy" "alb_logs" {
  count = var.create_alb_logs_bucket ? 1 : 0

  bucket = aws_s3_bucket.alb_logs[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSLogDeliveryWrite"
        Effect = "Allow"
        Principal = {
          Service = "elasticloadbalancing.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs[0].arn}/*"
      },
      {
        Sid    = "EnforcedTLS"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.alb_logs[0].arn,
          "${aws_s3_bucket.alb_logs[0].arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}
