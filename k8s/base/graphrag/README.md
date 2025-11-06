# GraphRAG Deployment

The GraphRAG service is deployed via Terraform using the `graphrag-service` module located at:
`terraform/gcp/modules/graphrag-service/main.tf`

This module manages:
- Kubernetes Deployment
- Kubernetes Service (gRPC)
- Service Account with Workload Identity
- ConfigMap for configuration
- Secrets integration with GCP Secret Manager
- Horizontal Pod Autoscaler
- Pod Disruption Budget

To reference the GraphRAG service from other K8s resources, use:
- Service Name: `graphrag-{env}` (e.g., `graphrag-dev`)
- Namespace: `services`
- gRPC Endpoint: `graphrag-{env}.services.svc.cluster.local:50051`

## Configuration

GraphRAG configuration is managed through Terraform variables in the environment configuration files.
See `terraform/gcp/environments/{env}/main.tf` for instantiation.
