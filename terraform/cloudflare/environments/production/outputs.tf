# ===========================================================================
# Cloudflare Production Outputs
# ===========================================================================

output "zone_id" {
  description = "Cloudflare zone ID"
  value       = module.zone.zone_id
}

output "name_servers" {
  description = "Cloudflare nameservers - update your domain registrar with these"
  value       = module.zone.name_servers
}

output "zone_status" {
  description = "Zone activation status"
  value       = module.zone.zone_status
}

output "origin_certificate" {
  description = "Origin certificate for GKE (base64 encoded)"
  value       = base64encode(module.ssl.origin_certificate)
  sensitive   = true
}

output "origin_private_key" {
  description = "Origin certificate private key (base64 encoded)"
  value       = base64encode(module.ssl.origin_private_key)
  sensitive   = true
}

output "origin_certificate_expiry" {
  description = "Origin certificate expiry date"
  value       = module.ssl.origin_certificate_expiry
}

output "kv_namespace_id" {
  description = "Workers KV namespace ID"
  value       = module.workers.kv_namespace_id
}

output "waf_ruleset_id" {
  description = "WAF ruleset ID"
  value       = module.waf.waf_ruleset_id
}

output "cache_ruleset_id" {
  description = "Cache ruleset ID"
  value       = module.cache_rules.cache_ruleset_id
}

output "rate_limit_ruleset_id" {
  description = "Rate limiting ruleset ID"
  value       = module.rate_limiting.rate_limit_ruleset_id
}
