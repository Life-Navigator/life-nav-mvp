# ===========================================================================
# Cloudflare Zone Module - DNS Zone and Records Management
# ===========================================================================

variable "account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "domain_name" {
  description = "Primary domain name"
  type        = string
}

variable "api_origin_ip" {
  description = "GKE Ingress static IP for API"
  type        = string
}

variable "plan" {
  description = "Cloudflare plan (free, pro, business, enterprise)"
  type        = string
  default     = "business"
}

# Primary Zone
resource "cloudflare_zone" "primary" {
  account_id = var.account_id
  zone       = var.domain_name
  plan       = var.plan
  type       = "full"
}

# Zone Settings
resource "cloudflare_zone_settings_override" "settings" {
  zone_id = cloudflare_zone.primary.id

  settings {
    # Performance
    brotli = "on"
    minify {
      css  = "on"
      html = "on"
      js   = "on"
    }
    http2            = "on"
    http3            = "on"
    zero_rtt         = "off"
    early_hints      = "on"
    rocket_loader    = "off"

    # Security
    security_level        = "high"
    challenge_ttl         = 1800
    browser_check         = "on"
    email_obfuscation     = "on"
    server_side_exclude   = "on"
    hotlink_protection    = "on"

    # SSL
    ssl                      = "strict"
    min_tls_version          = "1.2"
    tls_1_3                  = "zrt"
    automatic_https_rewrites = "on"
    always_use_https         = "on"

    # Caching
    cache_level      = "aggressive"
    browser_cache_ttl = 14400

    # Origin
    opportunistic_encryption     = "on"
    origin_error_page_pass_thru = "off"

    # Development Mode - OFF in production
    development_mode = "off"
  }
}

# DNS Records

# Root domain
resource "cloudflare_record" "root" {
  zone_id = cloudflare_zone.primary.id
  name    = "@"
  type    = "A"
  value   = var.api_origin_ip
  proxied = true
  ttl     = 1
}

# WWW subdomain
resource "cloudflare_record" "www" {
  zone_id = cloudflare_zone.primary.id
  name    = "www"
  type    = "CNAME"
  value   = "app.${var.domain_name}"
  proxied = true
  ttl     = 1
}

# App subdomain (Next.js frontend)
resource "cloudflare_record" "app" {
  zone_id = cloudflare_zone.primary.id
  name    = "app"
  type    = "A"
  value   = var.api_origin_ip
  proxied = true
  ttl     = 1
}

# API subdomain (GKE backend)
resource "cloudflare_record" "api" {
  zone_id = cloudflare_zone.primary.id
  name    = "api"
  type    = "A"
  value   = var.api_origin_ip
  proxied = true
  ttl     = 1
}

# Images subdomain (Imgproxy)
resource "cloudflare_record" "images" {
  zone_id = cloudflare_zone.primary.id
  name    = "images"
  type    = "A"
  value   = var.api_origin_ip
  proxied = true
  ttl     = 1
}

# Storage proxy subdomain
resource "cloudflare_record" "storage" {
  zone_id = cloudflare_zone.primary.id
  name    = "storage"
  type    = "CNAME"
  value   = "app.${var.domain_name}"
  proxied = true
  ttl     = 1
}

# SPF Record
resource "cloudflare_record" "spf" {
  zone_id = cloudflare_zone.primary.id
  name    = "@"
  type    = "TXT"
  value   = "v=spf1 include:_spf.google.com ~all"
  ttl     = 3600
}

# DMARC Record
resource "cloudflare_record" "dmarc" {
  zone_id = cloudflare_zone.primary.id
  name    = "_dmarc"
  type    = "TXT"
  value   = "v=DMARC1; p=quarantine; rua=mailto:dmarc@${var.domain_name}"
  ttl     = 3600
}

# CAA Record - Allow Cloudflare
resource "cloudflare_record" "caa_cloudflare" {
  zone_id = cloudflare_zone.primary.id
  name    = "@"
  type    = "CAA"

  data {
    flags = 0
    tag   = "issue"
    value = "cloudflare.com"
  }

  ttl = 3600
}

# CAA Record - Allow Let's Encrypt
resource "cloudflare_record" "caa_letsencrypt" {
  zone_id = cloudflare_zone.primary.id
  name    = "@"
  type    = "CAA"

  data {
    flags = 0
    tag   = "issue"
    value = "letsencrypt.org"
  }

  ttl = 3600
}

# Outputs
output "zone_id" {
  description = "Cloudflare zone ID"
  value       = cloudflare_zone.primary.id
}

output "zone_name" {
  description = "Zone name"
  value       = cloudflare_zone.primary.zone
}

output "name_servers" {
  description = "Cloudflare nameservers"
  value       = cloudflare_zone.primary.name_servers
}

output "zone_status" {
  description = "Zone status"
  value       = cloudflare_zone.primary.status
}
