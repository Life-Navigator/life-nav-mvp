# ===========================================================================
# OCR Models Storage Module
# For storing PaddleOCR and DeepSeek-OCR model files
# ===========================================================================

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# ===========================================================================
# Variables
# ===========================================================================

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "env" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "bucket_name_prefix" {
  description = "Bucket name prefix"
  type        = string
  default     = "life-navigator-ocr-models"
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

# ===========================================================================
# OCR Models Storage Bucket
# ===========================================================================

resource "google_storage_bucket" "ocr_models" {
  name     = "${var.bucket_name_prefix}-${var.env}"
  location = var.region
  project  = var.project_id

  # Storage class
  storage_class = "STANDARD"

  # Uniform bucket-level access
  uniform_bucket_level_access = true

  # Versioning (enabled for model rollback)
  versioning {
    enabled = true
  }

  # Lifecycle rules
  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      num_newer_versions = 3  # Keep last 3 versions
      with_state         = "ARCHIVED"
    }
  }

  # Labels
  labels = merge(
    var.labels,
    {
      environment = var.env
      managed_by  = "terraform"
      component   = "ocr-models"
      purpose     = "ml-models"
    }
  )

  # Force destroy (only for dev/staging)
  force_destroy = var.env != "prod"
}

# ===========================================================================
# IAM Bindings for OCR Models Bucket
# ===========================================================================

# Service account for finance-api (needs read access to models)
resource "google_storage_bucket_iam_binding" "finance_api_reader" {
  bucket = google_storage_bucket.ocr_models.name
  role   = "roles/storage.objectViewer"

  members = [
    "serviceAccount:finance-api-sa@${var.project_id}.iam.gserviceaccount.com",
    "serviceAccount:agents-sa@${var.project_id}.iam.gserviceaccount.com",
  ]
}

# Admin access for uploading models
resource "google_storage_bucket_iam_binding" "admin_writer" {
  bucket = google_storage_bucket.ocr_models.name
  role   = "roles/storage.objectAdmin"

  members = [
    "serviceAccount:terraform-sa@${var.project_id}.iam.gserviceaccount.com",
  ]
}

# ===========================================================================
# Model Upload Script (null_resource for initial upload)
# ===========================================================================

# Create a local script to download and upload OCR models
resource "null_resource" "upload_ocr_models" {
  # Only run on initial creation
  triggers = {
    bucket_id = google_storage_bucket.ocr_models.id
  }

  provisioner "local-exec" {
    command = <<-EOT
      #!/bin/bash
      set -e

      echo "====================================================================="
      echo "OCR Models Upload Script"
      echo "====================================================================="

      # Check if gsutil is installed
      if ! command -v gsutil &> /dev/null; then
        echo "ERROR: gsutil not found. Install Google Cloud SDK."
        exit 1
      fi

      # Set bucket name
      BUCKET="${google_storage_bucket.ocr_models.name}"

      # Create temporary directory
      TEMP_DIR=$(mktemp -d)
      cd $TEMP_DIR

      echo "Downloading PaddleOCR models (~500MB)..."
      # Note: PaddleOCR models will be downloaded on first run of the service
      # Create a placeholder file
      echo "PaddleOCR models will be downloaded on container startup" > paddleocr_readme.txt
      gsutil cp paddleocr_readme.txt gs://$BUCKET/paddleocr/

      echo "Downloading DeepSeek-OCR models (~2GB)..."
      # Note: DeepSeek models will be downloaded from HuggingFace on first run
      # Create a placeholder file
      echo "DeepSeek-OCR models will be downloaded from HuggingFace Hub on container startup" > deepseek_readme.txt
      echo "Model: deepseek-ai/deepseek-ocr" >> deepseek_readme.txt
      gsutil cp deepseek_readme.txt gs://$BUCKET/deepseek/

      echo "Creating model cache directory structure..."
      mkdir -p paddleocr deepseek

      echo "====================================================================="
      echo "OCR Models Upload Complete!"
      echo "====================================================================="
      echo "Bucket: gs://$BUCKET"
      echo ""
      echo "NOTE: Actual model files will be downloaded on first container startup:"
      echo "  - PaddleOCR: Downloaded automatically by paddleocr library"
      echo "  - DeepSeek-OCR: Downloaded from HuggingFace Hub (deepseek-ai/deepseek-ocr)"
      echo ""
      echo "Models will be cached in:"
      echo "  - PaddleOCR: ~/.paddleocr/"
      echo "  - DeepSeek: ~/.cache/huggingface/hub/"
      echo ""
      echo "To pre-download models, run:"
      echo "  python3 scripts/download_ocr_models.py"
      echo "====================================================================="

      # Cleanup
      cd /
      rm -rf $TEMP_DIR
    EOT
  }

  depends_on = [
    google_storage_bucket.ocr_models,
    google_storage_bucket_iam_binding.admin_writer
  ]
}

# ===========================================================================
# Outputs
# ===========================================================================

output "bucket_name" {
  description = "OCR models storage bucket name"
  value       = google_storage_bucket.ocr_models.name
}

output "bucket_url" {
  description = "OCR models storage bucket URL"
  value       = google_storage_bucket.ocr_models.url
}

output "bucket_self_link" {
  description = "OCR models storage bucket self link"
  value       = google_storage_bucket.ocr_models.self_link
}
