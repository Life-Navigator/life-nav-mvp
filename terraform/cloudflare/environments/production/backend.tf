# ===========================================================================
# Terraform Backend Configuration
# ===========================================================================

terraform {
  backend "gcs" {
    bucket = "life-navigator-terraform-state-prod"
    prefix = "cloudflare/production"
  }
}
