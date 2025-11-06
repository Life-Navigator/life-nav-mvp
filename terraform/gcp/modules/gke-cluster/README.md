# GKE Autopilot Cluster Module

This module creates a Google Kubernetes Engine (GKE) Autopilot cluster with enterprise features and best practices.

## Features

- **Autopilot Mode**: Fully managed Kubernetes with automatic node provisioning
- **Workload Identity**: Secure access to GCP services from pods
- **Private Cluster**: Nodes without public IP addresses
- **VPC-Native Networking**: IP aliasing for pods and services
- **Dataplane V2**: Advanced networking with Cilium
- **Managed Prometheus**: Integrated monitoring
- **Config Connector**: Manage GCP resources from Kubernetes
- **Binary Authorization**: Enforce deployment policies (prod only)
- **Cloud Armor**: DDoS protection and WAF (prod only)
- **Network Policy**: Pod-to-pod communication control

## Usage

```hcl
module "gke_cluster" {
  source = "../../modules/gke-cluster"

  project_id = var.project_id
  region     = var.region
  env        = "dev"

  cluster_name = "life-navigator-gke"
  network      = module.vpc.network_name
  subnetwork   = module.vpc.subnet_names[0]

  enable_private_cluster = true
  enable_private_nodes   = true

  master_authorized_networks = [
    {
      cidr_block   = "0.0.0.0/0"
      display_name = "All"
    }
  ]

  labels = {
    environment = "dev"
    managed_by  = "terraform"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| project_id | GCP project ID | string | n/a | yes |
| region | GCP region | string | n/a | yes |
| env | Environment (dev/staging/prod) | string | n/a | yes |
| cluster_name | GKE cluster name | string | "life-navigator-gke" | no |
| network | VPC network name | string | n/a | yes |
| subnetwork | VPC subnetwork name | string | n/a | yes |
| enable_autopilot | Enable Autopilot mode | bool | true | no |
| enable_private_cluster | Enable private cluster | bool | true | no |

## Outputs

| Name | Description |
|------|-------------|
| cluster_name | GKE cluster name |
| cluster_endpoint | GKE cluster endpoint |
| cluster_ca_certificate | GKE cluster CA certificate |
| workload_identity_pool | Workload Identity pool |

## Notes

- Autopilot mode manages node pools automatically
- Deletion protection is enabled for production
- Maintenance windows are configured for Saturdays 3-7 AM UTC
- Binary authorization is enabled for production only
