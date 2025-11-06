# LifeNavigator Production Deployment Quick Start 🚀

**Time to Production: 30 minutes**

## Prerequisites Checklist
- [ ] Azure subscription with ~$500/month budget
- [ ] Azure CLI installed (`az version`)
- [ ] Terraform installed (`terraform version`)
- [ ] Node.js 18+ installed (`node --version`)
- [ ] Git repository cloned

## Step 1: Azure Setup (5 minutes)

```bash
# Login to Azure
az login

# Set subscription (if you have multiple)
az account set --subscription "YOUR_SUBSCRIPTION_ID"

# Create resource group for Terraform state
az group create --name rg-terraform-state --location eastus

# Create storage account for Terraform state
az storage account create \
  --name tfstatelifenavXXXX \
  --resource-group rg-terraform-state \
  --location eastus \
  --sku Standard_LRS

# Create container
az storage container create \
  --name tfstate \
  --account-name tfstatelifenavXXXX
```

## Step 2: Configure Terraform Backend (2 minutes)

```bash
cd terraform

# Create backend config
cat > backend.tf << 'EOF'
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "tfstatelifenavXXXX"  # UPDATE THIS
    container_name       = "tfstate"
    key                  = "prod.terraform.tfstate"
  }
}
EOF
```

## Step 3: Deploy Infrastructure (15 minutes)

```bash
# Initialize Terraform
terraform init

# Create production workspace
terraform workspace new prod

# Review the plan
terraform plan -var-file="environments/prod.tfvars"

# DEPLOY! (This takes ~10-15 minutes)
terraform apply -var-file="environments/prod.tfvars" -auto-approve

# Save outputs for next steps
terraform output -json > ../deployment-outputs.json
```

## Step 4: Run Post-Deployment Script (8 minutes)

```bash
cd ..

# Make script executable
chmod +x deploy-production.sh

# Run the deployment finalization
./deploy-production.sh prod
```

## Step 5: Verify Deployment ✅

```bash
# Get your app URL
APP_URL=$(jq -r '.app_service_url.value' deployment-outputs.json)

# Test the health endpoint
curl $APP_URL/api/health

# Should return:
# {"status":"healthy","timestamp":"..."}
```

## Step 6: Configure Application

```bash
# Set environment variables in Azure
az webapp config appsettings set \
  --name app-lifenavigator-prod \
  --resource-group rg-lifenavigator-prod \
  --settings \
    NODE_ENV=production \
    NEXTAUTH_URL=$APP_URL \
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
```

## Step 7: Deploy Your Code

```bash
# Build the application
npm run build

# Deploy to Azure (using GitHub Actions is recommended)
az webapp deployment source config \
  --name app-lifenavigator-prod \
  --resource-group rg-lifenavigator-prod \
  --repo-url https://github.com/YOUR_USERNAME/lifenavigator \
  --branch master \
  --manual-integration
```

## What You Get

### ✅ Infrastructure
- Auto-scaling App Service (2-10 instances)
- PostgreSQL with high availability
- Redis cache for sessions
- CDN for static assets
- Application Insights monitoring

### ✅ Security
- NSA-grade AES-256-GCM encryption
- Row-level security on all tables
- Audit logging (7-year retention)
- Managed identities (no passwords)
- Network isolation with VNet

### ✅ Compliance
- HIPAA-ready infrastructure
- GDPR data residency controls
- SOC 2 monitoring capabilities
- PCI DSS network segmentation

### ✅ Operational
- Automated backups (30-day retention)
- Disaster recovery (1-hour RPO, 2-hour RTO)
- Cost alerts at 50%, 80%, 100%, 120%
- Auto-scaling based on load

## Costs

**Monthly Breakdown (~$500/month)**:
- App Service (P1v2, 2 instances): $160
- PostgreSQL (D2s_v3 + HA): $300
- Redis Cache Standard: $50
- Storage & CDN: $30
- Monitoring: $20

**Cost Optimization Available**:
- Reserved instances: Save 40%
- Dev/test pricing: Save 55%
- Spot instances for batch: Save 80%

## Manual Tasks Required

### Within 24 Hours
1. **Configure custom domain**
   ```bash
   az webapp config hostname add \
     --webapp-name app-lifenavigator-prod \
     --resource-group rg-lifenavigator-prod \
     --hostname www.yourdomain.com
   ```

2. **Enable backup verification**
   - Test restore procedure
   - Document recovery steps

### Within 7 Days
1. **Sign Business Associate Agreement (BAA)**
   - Contact: Microsoft Azure Support
   - Required for HIPAA compliance

2. **Create compliance documents**
   - Privacy Policy
   - Terms of Service
   - Data Processing Agreement

### Within 30 Days
1. **Penetration Testing**
   - Use Azure Security Center
   - Or hire security firm (~$5,000)

2. **Security Assessment**
   - Run Azure Security Center assessment
   - Fix all critical/high findings

## Monitoring Commands

```bash
# View real-time logs
az webapp log tail \
  --name app-lifenavigator-prod \
  --resource-group rg-lifenavigator-prod

# Check costs
az consumption usage list \
  --start-date 2024-01-01 \
  --end-date 2024-01-31 \
  --output table

# Security status
az security assessment list \
  --resource-group rg-lifenavigator-prod

# Database metrics
az monitor metrics list \
  --resource /subscriptions/.../servers/psql-lifenavigator-prod \
  --metric cpu_percent \
  --interval PT1H
```

## Troubleshooting

### App not responding
```bash
# Restart app service
az webapp restart \
  --name app-lifenavigator-prod \
  --resource-group rg-lifenavigator-prod

# Check application logs
az webapp log download \
  --name app-lifenavigator-prod \
  --resource-group rg-lifenavigator-prod
```

### Database connection issues
```bash
# Check firewall rules
az postgres flexible-server firewall-rule list \
  --resource-group rg-lifenavigator-prod \
  --server-name psql-lifenavigator-prod

# Test connection
psql "host=psql-lifenavigator-prod.postgres.database.azure.com \
     port=5432 dbname=lifenavigator user=psqladmin \
     password=YOUR_PASSWORD sslmode=require"
```

### High costs
```bash
# Check what's costing money
az consumption usage list \
  --output table \
  --query "[?contains(instanceName, 'lifenavigator')]"

# Scale down if needed
az webapp scale \
  --name app-lifenavigator-prod \
  --resource-group rg-lifenavigator-prod \
  --instance-count 1
```

## Support

- **Azure Issues**: [Azure Support Portal](https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade)
- **Security Concerns**: security@lifenavigator.com
- **Application Bugs**: Create issue in GitHub repo

## Next Steps

1. **Set up CI/CD pipeline** (GitHub Actions recommended)
2. **Configure monitoring dashboards** in Application Insights
3. **Schedule weekly backup tests**
4. **Document incident response procedures**
5. **Train team on Azure Portal**

---

**🎉 Congratulations! Your LifeNavigator app is production-ready!**

Remember: The infrastructure will auto-scale based on load, but monitor costs closely in the first month to understand your actual usage patterns.