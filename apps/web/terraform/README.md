# LifeNavigator Infrastructure as Code

## Overview

This Terraform configuration deploys a **production-ready, cost-optimized** Azure infrastructure for LifeNavigator that:
- **Starts at ~$100/month** for development
- **Scales to ~$500/month** for production
- **Auto-scales** to handle 10,000+ users
- **Ready for Kubernetes migration** when needed

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Azure CDN                           │
│                  (Static Content)                       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                 App Service Plan                        │
│            (Auto-scales 1-10 instances)                 │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Web App    │  │   Web App    │  │   Web App    │ │
│  │  Instance 1  │  │  Instance 2  │  │  Instance N  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┬──────────────┐
        │            │            │              │
┌───────▼──────┐ ┌──▼───┐ ┌──────▼────┐ ┌──────▼──────┐
│  PostgreSQL  │ │Redis │ │  Storage  │ │  Key Vault  │
│   Flexible   │ │Cache │ │  Account  │ │  (Secrets)  │
│    Server    │ │      │ │  (Blobs)  │ │             │
└──────────────┘ └──────┘ └───────────┘ └─────────────┘
```

## Cost Breakdown

### Development Environment (~$100/month)
- **App Service B1**: $13/month
- **PostgreSQL B1ms**: $15/month  
- **Storage LRS**: $5/month
- **Application Insights**: $0 (free tier)
- **CDN**: Disabled
- **Auto-shutdown**: 19:00-07:00 saves 50%

### Production Environment (~$500/month)
- **App Service P1v2** (2 instances): $160/month
- **PostgreSQL D2s_v3 + HA**: $300/month
- **Storage GRS**: $20/month
- **Redis Cache Standard**: $50/month
- **CDN**: $10/month
- **Application Insights**: $20/month

## Quick Start

### Prerequisites
```bash
# Install Terraform
brew install terraform  # macOS
# or
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform

# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login
```

### Deploy Development Environment

```bash
# Initialize Terraform
cd terraform
terraform init

# Create workspace for dev
terraform workspace new dev

# Plan deployment
terraform plan -var-file="environments/dev.tfvars"

# Deploy (takes ~10 minutes)
terraform apply -var-file="environments/dev.tfvars" -auto-approve

# Get outputs
terraform output -json > ../deployment-outputs.json
```

### Deploy Production Environment

```bash
# Switch to production workspace
terraform workspace new prod

# Deploy production
terraform plan -var-file="environments/prod.tfvars"
terraform apply -var-file="environments/prod.tfvars" -auto-approve
```

## Auto-Scaling Configuration

The infrastructure automatically scales based on:
- **CPU > 70%**: Add instance
- **CPU < 30%**: Remove instance  
- **Memory > 80%**: Add instance
- **HTTP Queue > 10**: Add 2 instances quickly
- **Min instances**: 1 (dev) / 2 (prod)
- **Max instances**: 2 (dev) / 10 (prod)

## Migration Path to Kubernetes

When you reach **$5K MRR** or **10K users**, migrate to AKS:

```bash
# 1. Enable container registry (already in variables)
k8s_migration_ready = {
  create_container_registry = true
  containerize_app         = true
}

# 2. The app is already modular (see modular-services.ts)
# 3. Deploy AKS cluster (separate Terraform module)
# 4. Migrate services one by one
```

## Monitoring & Alerts

Configured alerts:
- **Budget**: 50%, 80%, 100%, 120% thresholds
- **App CPU/Memory**: > 85%
- **Response Time**: > 2 seconds
- **HTTP 5xx Errors**: > 10 in 5 minutes
- **Database Storage**: > 80%
- **Database CPU**: > 80%

## Security Features

- **Network Isolation**: VNet integration
- **Private Endpoints**: Database not exposed to internet
- **Key Vault**: All secrets stored securely
- **Managed Identity**: No passwords in code
- **TLS 1.2+**: Enforced everywhere
- **NSGs**: Network security groups
- **RBAC**: Role-based access control

## Cost Optimization Tips

1. **Development**: Use auto-shutdown (saves 50%)
2. **Use Burstable VMs**: B-series for variable workloads
3. **Reserved Instances**: Save 40% with 1-year commitment
4. **Spot Instances**: Save 80% for batch jobs
5. **CDN**: Reduces bandwidth costs by 90%
6. **Autoscale Down**: Aggressive scale-down at night

## Backup & Disaster Recovery

- **Database**: 30-day backups, geo-redundant
- **Point-in-time restore**: Up to 35 days
- **High Availability**: Zone-redundant (production)
- **Storage**: Geo-redundant with versioning
- **RPO**: 1 hour
- **RTO**: 2 hours

## Deployment Slots (Production)

Zero-downtime deployments:
```bash
# Deploy to staging slot
az webapp deployment slot swap \
  --resource-group rg-lifenavigator-prod-eus \
  --name app-lifenavigator-prod-eus \
  --slot staging
```

## Useful Commands

```bash
# Check costs
az consumption usage list --output table

# Scale manually
az webapp scale --resource-group <rg> --name <app> --instance-count 5

# View metrics
az monitor metrics list --resource <app-id> --metric CpuPercentage

# Database connection
psql "host=<server>.postgres.database.azure.com \
     port=5432 \
     dbname=lifenavigator \
     user=psqladmin \
     password=<password> \
     sslmode=require"

# Clear CDN cache
az cdn endpoint purge \
  --resource-group <rg> \
  --profile-name <cdn> \
  --name <endpoint> \
  --content-paths "/*"
```

## Troubleshooting

### High Costs
1. Check autoscaling max instances
2. Verify auto-shutdown is working
3. Review Application Insights data cap
4. Check for unused resources

### Performance Issues  
1. Enable Redis cache
2. Increase database tier
3. Check Application Insights for slow queries
4. Review autoscaling thresholds

### Database Connection Issues
1. Check VNet integration
2. Verify NSG rules
3. Check connection pooling
4. Review firewall rules

## Clean Up

```bash
# Destroy everything (WARNING: Deletes all data)
terraform destroy -var-file="environments/dev.tfvars"
```

## Support

For issues, check:
1. Application Insights logs
2. Azure Monitor metrics
3. Database query performance insights
4. CDN analytics

## Next Steps

1. **Configure custom domain** when ready
2. **Enable Redis** when you have 1000+ users
3. **Upgrade database** at 5000+ users
4. **Consider AKS** at 10000+ users
5. **Add read replicas** for global scale