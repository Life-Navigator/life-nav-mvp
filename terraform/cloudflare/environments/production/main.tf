# ===========================================================================
# Cloudflare Production Environment
# ===========================================================================

terraform {
  backend "gcs" {
    bucket = "life-navigator-terraform-state-prod"
    prefix = "cloudflare/production"
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# Zone Module
module "zone" {
  source = "../../modules/zone"

  account_id    = var.cloudflare_account_id
  domain_name   = var.domain_name
  api_origin_ip = var.gke_ingress_ip
  plan          = "business"
}

# SSL/TLS Configuration
module "ssl" {
  source = "../../modules/ssl"

  zone_id     = module.zone.zone_id
  domain_name = var.domain_name
}

# WAF Configuration
module "waf" {
  source = "../../modules/waf"

  zone_id = module.zone.zone_id
}

# Cache Rules
module "cache_rules" {
  source = "../../modules/cache-rules"

  zone_id = module.zone.zone_id
}

# Rate Limiting
module "rate_limiting" {
  source = "../../modules/rate-limiting"

  zone_id = module.zone.zone_id
}

# Firewall (Origin Protection)
module "firewall" {
  source = "../../modules/firewall"

  zone_id           = module.zone.zone_id
  admin_allowed_ips = var.admin_allowed_ips
}

# Workers
module "workers" {
  source = "../../modules/workers"

  account_id        = var.cloudflare_account_id
  zone_id           = module.zone.zone_id
  supabase_url      = var.supabase_url
  supabase_anon_key = var.supabase_anon_key
}

# Monitoring
module "monitoring" {
  source = "../../modules/monitoring"

  account_id        = var.cloudflare_account_id
  zone_id           = module.zone.zone_id
  alert_email       = var.alert_email
  slack_webhook_url = var.slack_webhook_url
  gcs_log_bucket    = var.gcs_log_bucket
  gcp_project_id    = var.gcp_project_id
}
