# ===========================================================================
# Cloudflare Firewall Module - Origin Protection
# ===========================================================================

variable "zone_id" {
  description = "Cloudflare zone ID"
  type        = string
}

variable "admin_allowed_ips" {
  description = "IP addresses allowed for admin access"
  type        = list(string)
  default     = []
}

# Firewall Rules for Origin Protection
resource "cloudflare_ruleset" "firewall" {
  zone_id     = var.zone_id
  name        = "Life Navigator Firewall Rules"
  description = "Firewall rules for origin protection"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  # Block known bad countries (customize as needed)
  rules {
    action      = "managed_challenge"
    expression  = "(ip.geoip.country in {\"RU\" \"KP\" \"IR\"})"
    description = "Challenge requests from high-risk countries"
    enabled     = true
  }

  # Require authentication header for sensitive paths
  rules {
    action      = "block"
    expression  = "(http.request.uri.path contains \"/api/admin\" and not http.request.headers[\"authorization\"] contains \"Bearer\")"
    description = "Block admin requests without auth"
    enabled     = true
  }

  # Block direct access to internal endpoints
  rules {
    action      = "block"
    expression  = "(http.request.uri.path contains \"/internal/\" or http.request.uri.path contains \"/.env\")"
    description = "Block access to internal endpoints"
    enabled     = true
  }

  # Block suspicious request patterns
  rules {
    action      = "block"
    expression  = "(http.request.uri.path contains \"wp-admin\" or http.request.uri.path contains \"wp-login\" or http.request.uri.path contains \"xmlrpc.php\")"
    description = "Block WordPress probe attempts"
    enabled     = true
  }

  # Block common vulnerability scanners
  rules {
    action      = "block"
    expression  = "(http.user_agent contains \"sqlmap\" or http.user_agent contains \"nikto\" or http.user_agent contains \"masscan\")"
    description = "Block vulnerability scanner user agents"
    enabled     = true
  }
}

# IP Access Rules - Block known bad IPs (dynamic list)
resource "cloudflare_filter" "bad_ips" {
  zone_id     = var.zone_id
  description = "Block known malicious IPs"
  expression  = "(cf.threat_score gt 80)"
}

resource "cloudflare_firewall_rule" "block_bad_ips" {
  zone_id     = var.zone_id
  description = "Block high threat score IPs"
  filter_id   = cloudflare_filter.bad_ips.id
  action      = "block"
  priority    = 1
}

# Outputs
output "firewall_ruleset_id" {
  description = "Firewall ruleset ID"
  value       = cloudflare_ruleset.firewall.id
}
