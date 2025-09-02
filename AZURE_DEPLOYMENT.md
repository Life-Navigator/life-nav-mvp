# Azure Deployment Guide

## Prerequisites
- Azure subscription
- Azure CLI installed
- Terraform installed
- Docker installed
- pnpm installed (v9+)

## Environment Setup
1. Copy `.env.example` to `.env.local`
2. Configure Azure-specific environment variables
3. Set up Azure Key Vault for secrets

## Database Setup
- PostgreSQL Flexible Server on Azure
- Connection string in Key Vault
- SSL required for production

## Deployment Steps
1. Run Terraform to provision infrastructure:
   ```bash
   cd terraform
   terraform init
   terraform plan -var-file="environments/production.tfvars"
   terraform apply -var-file="environments/production.tfvars"
   ```

2. Build and deploy Docker container:
   ```bash
   docker build -t lifenavigator -f Dockerfile.simple .
   az acr build --registry <your-registry> --image lifenavigator:latest .
   ```

3. Deploy to App Service:
   ```bash
   ./deploy-production.sh
   ```

## Monitoring
- Application Insights configured
- Log Analytics workspace
- Azure Monitor alerts

## Security
- HIPAA compliant configuration
- End-to-end encryption
- Azure Key Vault for secrets
- Managed Identity for service authentication
