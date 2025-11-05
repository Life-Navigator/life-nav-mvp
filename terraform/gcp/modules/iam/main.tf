# ===========================================================================
# IAM Module - Service accounts and permissions
# ===========================================================================

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "env" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "service_accounts" {
  description = "List of service accounts to create"
  type = list(object({
    account_id   = string
    display_name = string
    description  = string
    roles        = list(string)
  }))
}

# Service Accounts
resource "google_service_account" "service_accounts" {
  count = length(var.service_accounts)

  account_id   = var.service_accounts[count.index].account_id
  display_name = var.service_accounts[count.index].display_name
  description  = var.service_accounts[count.index].description
  project      = var.project_id
}

# IAM bindings for service accounts
resource "google_project_iam_member" "service_account_roles" {
  for_each = {
    for pair in flatten([
      for idx, sa in var.service_accounts : [
        for role in sa.roles : {
          sa_email = google_service_account.service_accounts[idx].email
          role     = role
          key      = "${sa.account_id}-${role}"
        }
      ]
    ]) : pair.key => pair
  }

  project = var.project_id
  role    = each.value.role
  member  = "serviceAccount:${each.value.sa_email}"
}

# Outputs
output "service_account_emails" {
  description = "Map of service account emails"
  value = {
    for idx, sa in var.service_accounts :
    sa.account_id => google_service_account.service_accounts[idx].email
  }
}

output "service_account_ids" {
  description = "List of service account IDs"
  value       = [for sa in google_service_account.service_accounts : sa.id]
}

output "service_account_unique_ids" {
  description = "List of service account unique IDs"
  value       = [for sa in google_service_account.service_accounts : sa.unique_id]
}
