# ===========================================================================
# Cloudflare WAF Module - Web Application Firewall
# ===========================================================================

variable "zone_id" {
  description = "Cloudflare zone ID"
  type        = string
}

# WAF Managed Rules (Cloudflare Managed Ruleset)
resource "cloudflare_ruleset" "managed_waf" {
  zone_id     = var.zone_id
  name        = "Life Navigator WAF Managed Rules"
  description = "Managed WAF ruleset for Life Navigator"
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  # Cloudflare Managed Ruleset
  rules {
    action = "execute"
    action_parameters {
      id = "efb7b8c949ac4650a09736fc376e9aee" # Cloudflare Managed Ruleset
    }
    expression  = "true"
    description = "Cloudflare Managed Ruleset"
    enabled     = true
  }

  # OWASP Core Ruleset
  rules {
    action = "execute"
    action_parameters {
      id = "4814384a9e5d4991b9815dcfc25d2f1f" # OWASP Core Ruleset
    }
    expression  = "true"
    description = "OWASP Core Ruleset"
    enabled     = true
  }
}

# Custom WAF Rules
resource "cloudflare_ruleset" "custom_waf" {
  zone_id     = var.zone_id
  name        = "Life Navigator Custom WAF Rules"
  description = "Custom WAF rules for Life Navigator"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  # SQL Injection Protection
  rules {
    action      = "block"
    expression  = "(http.request.uri.query contains \"UNION\" or http.request.uri.query contains \"SELECT\" or http.request.uri.query contains \"DROP\")"
    description = "Block SQL Injection attempts"
    enabled     = true
  }

  # XSS Protection
  rules {
    action      = "block"
    expression  = "(http.request.uri contains \"<script\" or http.request.uri contains \"javascript:\")"
    description = "Block XSS attempts"
    enabled     = true
  }

  # Block requests without User-Agent
  rules {
    action      = "managed_challenge"
    expression  = "(not http.user_agent ne \"\")"
    description = "Challenge requests without User-Agent"
    enabled     = true
  }

  # Protect sensitive API endpoints
  rules {
    action      = "block"
    expression  = "(http.request.uri.path contains \"/api/finance\" and cf.threat_score gt 10)"
    description = "Block high-threat requests to finance API"
    enabled     = true
  }

  # Block path traversal
  rules {
    action      = "block"
    expression  = "(http.request.uri contains \"../\" or http.request.uri contains \"..%2f\")"
    description = "Block path traversal attempts"
    enabled     = true
  }

  # Challenge high threat score
  rules {
    action      = "managed_challenge"
    expression  = "(cf.threat_score gt 50)"
    description = "Challenge high threat score requests"
    enabled     = true
  }
}

# Bot Management
resource "cloudflare_bot_management" "bot_mgmt" {
  zone_id                   = var.zone_id
  enable_js                 = true
  optimize_wordpress        = false
  fight_mode                = true
  sbfm_definitely_automated = "block"
  sbfm_likely_automated     = "managed_challenge"
  sbfm_verified_bots        = "allow"
  suppress_session_score    = false
}

# Outputs
output "waf_ruleset_id" {
  description = "WAF Ruleset ID"
  value       = cloudflare_ruleset.managed_waf.id
}

output "custom_waf_ruleset_id" {
  description = "Custom WAF Ruleset ID"
  value       = cloudflare_ruleset.custom_waf.id
}
