# ===========================================================================
# Cloudflare Workers Module
# ===========================================================================

variable "account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "zone_id" {
  description = "Cloudflare zone ID"
  type        = string
}

variable "supabase_url" {
  description = "Supabase URL"
  type        = string
}

variable "supabase_anon_key" {
  description = "Supabase anonymous key"
  type        = string
  sensitive   = true
}

# Workers KV Namespace for caching
resource "cloudflare_workers_kv_namespace" "cache" {
  account_id = var.account_id
  title      = "life-navigator-cache"
}

# Image Optimizer Worker
resource "cloudflare_worker_script" "image_optimizer" {
  account_id = var.account_id
  name       = "image-optimizer-prod"
  content    = file("${path.module}/../../workers/image-optimizer/dist/index.js")
  module     = true

  kv_namespace_binding {
    name         = "CACHE"
    namespace_id = cloudflare_workers_kv_namespace.cache.id
  }
}

# Supabase Proxy Worker
resource "cloudflare_worker_script" "supabase_proxy" {
  account_id = var.account_id
  name       = "supabase-proxy-prod"
  content    = file("${path.module}/../../workers/supabase-proxy/dist/index.js")
  module     = true

  kv_namespace_binding {
    name         = "CACHE"
    namespace_id = cloudflare_workers_kv_namespace.cache.id
  }

  plain_text_binding {
    name = "SUPABASE_URL"
    text = var.supabase_url
  }

  secret_text_binding {
    name = "SUPABASE_ANON_KEY"
    text = var.supabase_anon_key
  }
}

# Worker Routes
resource "cloudflare_worker_route" "image_optimizer" {
  zone_id     = var.zone_id
  pattern     = "*lifenavigator.app/images/*"
  script_name = cloudflare_worker_script.image_optimizer.name
}

resource "cloudflare_worker_route" "supabase_proxy" {
  zone_id     = var.zone_id
  pattern     = "*lifenavigator.app/storage/*"
  script_name = cloudflare_worker_script.supabase_proxy.name
}

# Outputs
output "kv_namespace_id" {
  description = "Workers KV Namespace ID"
  value       = cloudflare_workers_kv_namespace.cache.id
}

output "image_optimizer_worker_id" {
  description = "Image optimizer worker ID"
  value       = cloudflare_worker_script.image_optimizer.id
}

output "supabase_proxy_worker_id" {
  description = "Supabase proxy worker ID"
  value       = cloudflare_worker_script.supabase_proxy.id
}
