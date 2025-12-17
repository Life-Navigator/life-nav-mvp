# ===========================================================================
# Cloudflare Cache Rules Module
# ===========================================================================

variable "zone_id" {
  description = "Cloudflare zone ID"
  type        = string
}

# Cache Rules Ruleset
resource "cloudflare_ruleset" "cache_rules" {
  zone_id     = var.zone_id
  name        = "Life Navigator Cache Rules"
  description = "Cache configuration for Life Navigator"
  kind        = "zone"
  phase       = "http_request_cache_settings"

  # Static JavaScript and CSS - aggressive caching
  rules {
    action = "set_cache_settings"
    action_parameters {
      edge_ttl {
        mode    = "override_origin"
        default = 604800 # 7 days
      }
      browser_ttl {
        mode    = "override_origin"
        default = 604800
      }
      cache = true
      cache_key {
        ignore_query_strings_order = true
        custom_key {
          query_string {
            include = ["v", "hash"]
          }
        }
      }
    }
    expression  = "(http.request.uri.path.extension in {\"js\" \"css\" \"woff2\" \"woff\" \"ttf\" \"eot\"})"
    description = "Cache static assets aggressively"
    enabled     = true
  }

  # Images - cache with optimization
  rules {
    action = "set_cache_settings"
    action_parameters {
      edge_ttl {
        mode    = "override_origin"
        default = 2592000 # 30 days
      }
      browser_ttl {
        mode    = "override_origin"
        default = 86400 # 1 day
      }
      cache = true
      serve_stale {
        disable_stale_while_updating = false
      }
    }
    expression  = "(http.request.uri.path.extension in {\"jpg\" \"jpeg\" \"png\" \"gif\" \"webp\" \"avif\" \"ico\" \"svg\"})"
    description = "Cache images"
    enabled     = true
  }

  # Next.js static assets (_next/static)
  rules {
    action = "set_cache_settings"
    action_parameters {
      edge_ttl {
        mode    = "override_origin"
        default = 31536000 # 1 year (immutable assets)
      }
      browser_ttl {
        mode    = "override_origin"
        default = 31536000
      }
      cache = true
    }
    expression  = "(http.request.uri.path contains \"/_next/static/\")"
    description = "Cache Next.js immutable assets"
    enabled     = true
  }

  # Supabase public storage - moderate cache
  rules {
    action = "set_cache_settings"
    action_parameters {
      edge_ttl {
        mode    = "override_origin"
        default = 86400 # 1 day
      }
      browser_ttl {
        mode    = "override_origin"
        default = 3600 # 1 hour
      }
      cache = true
    }
    expression  = "(http.request.uri.path contains \"/storage/\" and http.request.uri.path contains \"/public/\")"
    description = "Cache Supabase public storage"
    enabled     = true
  }

  # API endpoints - bypass cache (except public)
  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = false
    }
    expression  = "(http.request.uri.path starts_with \"/api/\" and not http.request.uri.path contains \"/api/public\")"
    description = "Bypass cache for API endpoints"
    enabled     = true
  }

  # Health endpoints - no cache
  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = false
    }
    expression  = "(http.request.uri.path eq \"/health\" or http.request.uri.path eq \"/health/db\" or http.request.uri.path eq \"/metrics\")"
    description = "No cache for health endpoints"
    enabled     = true
  }

  # Public API endpoints - short cache
  rules {
    action = "set_cache_settings"
    action_parameters {
      edge_ttl {
        mode    = "override_origin"
        default = 300 # 5 minutes
      }
      browser_ttl {
        mode    = "override_origin"
        default = 60 # 1 minute
      }
      cache = true
    }
    expression  = "(http.request.uri.path contains \"/api/public\")"
    description = "Short cache for public API"
    enabled     = true
  }

  # HTML pages - short cache with stale-while-revalidate
  rules {
    action = "set_cache_settings"
    action_parameters {
      edge_ttl {
        mode    = "override_origin"
        default = 60 # 1 minute
      }
      browser_ttl {
        mode = "respect_origin"
      }
      cache = true
      serve_stale {
        disable_stale_while_updating = false
      }
    }
    expression  = "(http.request.uri.path.extension eq \"html\" or http.request.uri.path eq \"/\" or not http.request.uri.path contains \".\")"
    description = "Cache HTML with stale-while-revalidate"
    enabled     = true
  }
}

# Tiered Cache
resource "cloudflare_tiered_cache" "smart" {
  zone_id    = var.zone_id
  cache_type = "smart"
}

# Outputs
output "cache_ruleset_id" {
  description = "Cache ruleset ID"
  value       = cloudflare_ruleset.cache_rules.id
}
