# ===========================================================================
# Cloudflare Rate Limiting Module
# ===========================================================================

variable "zone_id" {
  description = "Cloudflare zone ID"
  type        = string
}

# Rate Limiting Ruleset
resource "cloudflare_ruleset" "rate_limiting" {
  zone_id     = var.zone_id
  name        = "Life Navigator Rate Limiting"
  description = "Rate limiting rules for Life Navigator"
  kind        = "zone"
  phase       = "http_ratelimit"

  # Auth endpoints - strictest limits
  rules {
    action = "block"
    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 60
      requests_per_period = 10
      mitigation_timeout  = 600
    }
    expression  = "(http.request.uri.path contains \"/api/auth\" or http.request.uri.path contains \"/api/v1/auth\")"
    description = "Rate limit auth endpoints"
    enabled     = true
  }

  # Password reset - very strict
  rules {
    action = "block"
    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 3600 # 1 hour
      requests_per_period = 3
      mitigation_timeout  = 3600
    }
    expression  = "(http.request.uri.path contains \"/password-reset\" or http.request.uri.path contains \"/forgot-password\")"
    description = "Rate limit password reset"
    enabled     = true
  }

  # Finance API - moderate limits (PCI-DSS consideration)
  rules {
    action = "managed_challenge"
    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 60
      requests_per_period = 60
      mitigation_timeout  = 300
    }
    expression  = "(http.request.uri.path contains \"/api/finance\")"
    description = "Rate limit finance API"
    enabled     = true
  }

  # Agents API - allow more for AI interactions
  rules {
    action = "managed_challenge"
    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 60
      requests_per_period = 100
      mitigation_timeout  = 120
    }
    expression  = "(http.request.uri.path contains \"/api/agents\")"
    description = "Rate limit agents API"
    enabled     = true
  }

  # MCP Server (WebSocket) - higher limits
  rules {
    action = "log"
    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 60
      requests_per_period = 500
      mitigation_timeout  = 60
    }
    expression  = "(http.request.uri.path contains \"/api/mcp\")"
    description = "Monitor MCP server traffic"
    enabled     = true
  }

  # File uploads - stricter limits
  rules {
    action = "block"
    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 300 # 5 minutes
      requests_per_period = 10
      mitigation_timeout  = 600
    }
    expression  = "(http.request.uri.path contains \"/upload\" and http.request.method eq \"POST\")"
    description = "Rate limit file uploads"
    enabled     = true
  }

  # General API - catch-all
  rules {
    action = "managed_challenge"
    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 60
      requests_per_period = 200
      mitigation_timeout  = 120
    }
    expression  = "(http.request.uri.path starts_with \"/api/\")"
    description = "General API rate limit"
    enabled     = true
  }
}

# Outputs
output "rate_limit_ruleset_id" {
  description = "Rate limiting ruleset ID"
  value       = cloudflare_ruleset.rate_limiting.id
}
