# ===========================================================================
# Cloudflare SSL/TLS Module - Certificates and Encryption
# ===========================================================================

variable "zone_id" {
  description = "Cloudflare zone ID"
  type        = string
}

variable "domain_name" {
  description = "Primary domain name"
  type        = string
}

# Private key for origin certificate
resource "tls_private_key" "origin" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

# CSR for origin certificate
resource "tls_cert_request" "origin" {
  private_key_pem = tls_private_key.origin.private_key_pem

  subject {
    common_name  = var.domain_name
    organization = "Life Navigator"
  }
}

# Origin Certificate (for GKE origin)
resource "cloudflare_origin_ca_certificate" "origin_cert" {
  csr = tls_cert_request.origin.cert_request_pem
  hostnames = [
    "*.${var.domain_name}",
    var.domain_name
  ]
  request_type       = "origin-rsa"
  requested_validity = 5475 # 15 years (max for origin certs)
}

# Authenticated Origin Pull
resource "cloudflare_authenticated_origin_pulls" "aop" {
  zone_id = var.zone_id
  enabled = true
}

# Total TLS
resource "cloudflare_total_tls" "enable" {
  zone_id               = var.zone_id
  enabled               = true
  certificate_authority = "lets_encrypt"
}

# Outputs
output "origin_certificate" {
  description = "Origin certificate PEM"
  value       = cloudflare_origin_ca_certificate.origin_cert.certificate
  sensitive   = true
}

output "origin_private_key" {
  description = "Origin certificate private key"
  value       = tls_private_key.origin.private_key_pem
  sensitive   = true
}

output "origin_certificate_expiry" {
  description = "Origin certificate expiry date"
  value       = cloudflare_origin_ca_certificate.origin_cert.expires_on
}
