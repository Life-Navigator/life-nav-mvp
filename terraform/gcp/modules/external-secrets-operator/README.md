# External Secrets Operator Module

This module installs and configures the External Secrets Operator (ESO) on GKE with Workload Identity integration for secure access to GCP Secret Manager.

## Features

- **Helm Installation**: Installs ESO using official Helm chart
- **Workload Identity**: Secure authentication to GCP Secret Manager
- **ClusterSecretStore**: Pre-configured store for GCP Secret Manager
- **High Availability**: Multiple replicas for production
- **Security Hardened**: Non-root user, read-only root filesystem, dropped capabilities
- **Prometheus Metrics**: Monitoring integration

## Usage

```hcl
module "external_secrets_operator" {
  source = "../../modules/external-secrets-operator"

  project_id           = var.project_id
  cluster_name         = module.gke_cluster.cluster_name
  cluster_location     = module.gke_cluster.cluster_location
  workload_identity_pool = module.gke_cluster.workload_identity_pool
  env                  = "dev"

  labels = {
    environment = "dev"
    managed_by  = "terraform"
  }
}
```

## Creating ExternalSecrets

After deploying this module, you can create ExternalSecret resources that reference secrets from GCP Secret Manager:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: my-app-secrets
  namespace: my-namespace
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: gcpsm-secret-store
    kind: ClusterSecretStore
  target:
    name: my-app-secrets
    creationPolicy: Owner
  data:
  - secretKey: database-password
    remoteRef:
      key: my-database-password-secret-name
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| project_id | GCP project ID | string | n/a | yes |
| cluster_name | GKE cluster name | string | n/a | yes |
| cluster_location | GKE cluster location | string | n/a | yes |
| workload_identity_pool | Workload Identity pool | string | n/a | yes |
| env | Environment (dev/staging/prod) | string | n/a | yes |
| namespace | Namespace for ESO | string | "external-secrets-system" | no |
| chart_version | ESO Helm chart version | string | "0.9.11" | no |

## Outputs

| Name | Description |
|------|-------------|
| namespace | External Secrets Operator namespace |
| service_account_name | Kubernetes service account name |
| gcp_service_account_email | GCP service account email |
| cluster_secret_store_name | ClusterSecretStore name |

## Notes

- The GCP service account is granted `secretmanager.secretAccessor` role
- Workload Identity is used for secure authentication
- The ClusterSecretStore is available cluster-wide
- ExternalSecret resources can be created in any namespace
