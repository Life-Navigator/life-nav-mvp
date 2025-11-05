# Life Navigator Agent System - Terraform Infrastructure

Production-ready infrastructure as code for deploying the Life Navigator Agent System on AWS.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Cost Estimation](#cost-estimation)
- [Directory Structure](#directory-structure)
- [Module Documentation](#module-documentation)
- [Environment Configurations](#environment-configurations)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## 🎯 Overview

This Terraform configuration deploys a complete, production-ready infrastructure for the Life Navigator Agent System including:

- **Networking**: VPC with public/private subnets across multiple AZs, NAT gateway, VPC endpoints
- **Compute**: ECS Fargate cluster with auto-scaling, Application Load Balancer
- **Database**: RDS PostgreSQL with Multi-AZ, ElastiCache Redis cluster
- **Monitoring**: CloudWatch dashboards, alarms, log aggregation, SNS alerting
- **Security**: WAF, security groups, secrets management, encryption at rest

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         AWS Cloud                              │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  VPC (10.0.0.0/16 or 10.1.0.0/16)                        │ │
│  │                                                           │ │
│  │  ┌─────────────────┐     ┌─────────────────┐            │ │
│  │  │  Public Subnets │     │ Private Subnets │            │ │
│  │  │                 │     │                 │            │ │
│  │  │  ┌───────────┐  │     │  ┌───────────┐ │            │ │
│  │  │  │    ALB    │◄─┼─────┼─►│ECS Tasks  │ │            │ │
│  │  │  │   (WAF)   │  │     │  │ (Fargate) │ │            │ │
│  │  │  └───────────┘  │     │  └─────┬─────┘ │            │ │
│  │  │                 │     │        │        │            │ │
│  │  └─────────────────┘     │        ▼        │            │ │
│  │                          │  ┌───────────┐  │            │ │
│  │                          │  │    RDS    │  │            │ │
│  │                          │  │ PostgreSQL│  │            │ │
│  │                          │  └───────────┘  │            │ │
│  │                          │                 │            │ │
│  │                          │  ┌───────────┐  │            │ │
│  │                          │  │ ElastiCache│ │            │ │
│  │                          │  │   Redis   │  │            │ │
│  │                          │  └───────────┘  │            │ │
│  │                          └─────────────────┘            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ CloudWatch Monitoring & Alarms                           │ │
│  │ - Dashboards  - Log Aggregation  - SNS Alerting         │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

## ✅ Prerequisites

1. **AWS Account** with appropriate permissions (AdministratorAccess recommended for initial setup)
2. **AWS CLI** (v2.x) - [Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
3. **Terraform** (>= 1.5.0) - [Installation Guide](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli)
4. **Docker** (for building container images) - [Installation Guide](https://docs.docker.com/get-docker/)
5. **ACM Certificate** (for HTTPS in production) - Created in AWS Certificate Manager
6. **Container Image** - Built and pushed to ECR

## 🚀 Quick Start

### Step 1: Set Up Backend (One-Time Setup)

First, create the S3 bucket and DynamoDB table for Terraform state:

```bash
cd terraform/backend

# Review and customize backend/variables.tf if needed
# Then initialize and apply
terraform init
terraform plan
terraform apply

# Note the outputs - you'll need these values
terraform output backend_configuration
```

### Step 2: Build and Push Docker Image

```bash
# From project root
cd /home/riffe007/Documents/projects/life-navigator-agents

# Build the Docker image
docker build -t agent-api:latest .

# Create ECR repository (one-time)
aws ecr create-repository --repository-name agent-api --region us-east-1

# Get ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag agent-api:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/agent-api:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/agent-api:latest
```

### Step 3: Deploy Development Environment

```bash
cd terraform/environments/dev

# Copy and customize variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Uncomment the backend configuration in main.tf
# Update the S3 backend block with values from Step 1

# Initialize Terraform with backend
terraform init

# Review the plan
terraform plan

# Apply the configuration
terraform apply

# Get outputs
terraform output
```

### Step 4: Verify Deployment

```bash
# Get the ALB URL
terraform output agent_api_url

# Test health endpoint
curl $(terraform output -raw agent_api_health_check_url)

# View CloudWatch dashboard
terraform output dashboard_url
```

### Step 5: Deploy Production (When Ready)

```bash
cd terraform/environments/production

# Copy and customize variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with production values

# Initialize Terraform
terraform init

# Review the plan carefully
terraform plan

# Apply (with approval)
terraform apply

# Configure Route53 DNS (see outputs)
terraform output operations_commands
```

## 💰 Cost Estimation

### Development Environment (~$150-200/month)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| ECS Fargate | 1 task (0.5 vCPU, 1GB RAM, 24/7) | ~$30 |
| RDS PostgreSQL | db.t4g.micro, 20GB, Single-AZ | ~$15 |
| ElastiCache Redis | cache.t4g.micro, Single node | ~$12 |
| NAT Gateway | 1 NAT gateway + data transfer | ~$45 |
| ALB | Application Load Balancer + LCUs | ~$25 |
| CloudWatch | Logs, metrics, dashboards | ~$15 |
| VPC Endpoints | Interface endpoints (3x) | ~$20 |
| Data Transfer | Estimated outbound | ~$10 |
| **Total** | | **~$172/month** |

### Production Environment (~$600-800/month)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| ECS Fargate | 4 tasks (2 vCPU, 4GB RAM, 24/7) | ~$480 |
| RDS PostgreSQL | db.r6g.large, 100GB, Multi-AZ | ~$260 |
| ElastiCache Redis | cache.r6g.large, 3 nodes | ~$340 |
| NAT Gateway | 1 NAT gateway + data transfer | ~$60 |
| ALB | Application Load Balancer + LCUs | ~$35 |
| CloudWatch | Logs, metrics, dashboards, Container Insights | ~$40 |
| VPC Endpoints | Interface endpoints (3x) | ~$20 |
| WAF | Web Application Firewall | ~$10 |
| Data Transfer | Estimated outbound | ~$30 |
| **Total** | | **~$1,275/month** |

**Note**: Costs can vary based on:
- Actual traffic volume and data transfer
- Auto-scaling activity
- CloudWatch log volume
- Backup storage retention

**Cost Optimization Tips**:
- Use VPC endpoints to reduce NAT gateway costs
- Enable auto-scaling to scale down during off-peak hours
- Use Fargate Spot for non-critical workloads (dev only)
- Adjust log retention periods
- Monitor and optimize using Cost Explorer

## 📁 Directory Structure

```
terraform/
├── backend/                    # Terraform state backend setup
│   ├── main.tf                 # S3 bucket + DynamoDB table
│   ├── variables.tf
│   └── outputs.tf
│
├── modules/                    # Reusable Terraform modules
│   ├── networking/             # VPC, subnets, NAT, VPC endpoints
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── database/               # RDS PostgreSQL + ElastiCache Redis
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── agent-system/           # ECS Fargate, ALB, auto-scaling
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   └── monitoring/             # CloudWatch dashboards, alarms, SNS
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
│
├── environments/               # Environment-specific configurations
│   ├── dev/                    # Development environment
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── terraform.tfvars.example
│   │
│   └── production/             # Production environment
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── terraform.tfvars.example
│
└── README.md                   # This file
```

## 📚 Module Documentation

### Networking Module

Creates VPC infrastructure with:
- VPC with DNS support
- Public subnets for ALB (across 2-3 AZs)
- Private subnets for ECS tasks and databases
- NAT gateway for private subnet internet access
- VPC endpoints (S3, ECR, CloudWatch Logs) for cost optimization
- Optional VPC Flow Logs

**Inputs**: See `modules/networking/variables.tf`
**Outputs**: See `modules/networking/outputs.tf`

### Database Module

Creates database infrastructure with:
- RDS PostgreSQL with pgvector extension
- ElastiCache Redis cluster
- Automated backups and snapshots
- Multi-AZ deployment (production)
- CloudWatch alarms for CPU, memory, storage
- Secrets Manager integration for credentials

**Inputs**: See `modules/database/variables.tf`
**Outputs**: See `modules/database/outputs.tf`

### Agent System Module

Creates compute infrastructure with:
- ECS Fargate cluster with capacity providers
- Application Load Balancer with HTTPS
- ECS service with rolling deployments
- Auto-scaling policies (CPU, memory, request count)
- IAM roles with least-privilege permissions
- CloudWatch log groups
- Optional service discovery (AWS Cloud Map)

**Inputs**: See `modules/agent-system/variables.tf`
**Outputs**: See `modules/agent-system/outputs.tf`

### Monitoring Module

Creates observability infrastructure with:
- CloudWatch dashboard with key metrics
- SNS topics for alerting (critical, warning, info)
- CloudWatch alarms for ECS, ALB, databases
- Log metric filters for error tracking
- Composite alarms for complex conditions
- Email subscriptions for alerts

**Inputs**: See `modules/monitoring/variables.tf`
**Outputs**: See `modules/monitoring/outputs.tf`

## 🌍 Environment Configurations

### Development Environment

**Purpose**: Cost-optimized setup for development and testing

**Key Differences**:
- Single-AZ deployment
- Smaller instance sizes (t4g.micro)
- HTTP only (no HTTPS)
- Minimal backup retention (1 day)
- No Container Insights
- Single ECS task

**Estimated Cost**: ~$150-200/month

### Production Environment

**Purpose**: High-availability, production-grade deployment

**Key Differences**:
- Multi-AZ deployment (3 AZs)
- Larger instance sizes (r6g.large)
- HTTPS with ACM certificate
- Extended backup retention (30 days)
- Container Insights enabled
- Multiple ECS tasks (4+ with auto-scaling)
- WAF enabled
- VPC Flow Logs enabled

**Estimated Cost**: ~$600-800/month (base load)

## 🔧 Troubleshooting

### Common Issues

**Issue**: `terraform init` fails with "backend initialization required"
**Solution**: Ensure you've deployed the backend configuration first (see Step 1 in Quick Start)

**Issue**: RDS subnet group error during apply
**Solution**: RDS requires subnets in at least 2 different availability zones. Ensure `az_count >= 2` in networking module.

**Issue**: ECS tasks fail to start with "CannotPullContainerError"
**Solution**:
1. Verify ECR repository exists and image is pushed
2. Check ECS task execution role has `ecr:GetAuthorizationToken` permission
3. Verify VPC endpoints for ECR are configured (or NAT gateway is working)

**Issue**: ALB health checks failing
**Solution**:
1. Verify container is listening on the correct port (default 8000)
2. Check `/health` endpoint is implemented and returning 200
3. Review security group rules allow ALB → ECS communication

**Issue**: High NAT gateway costs
**Solution**:
1. Ensure VPC endpoints are created (S3, ECR, CloudWatch Logs)
2. VPC endpoints reduce traffic through NAT gateway
3. Review CloudWatch metrics to identify high-traffic sources

### Getting Help

1. **Check CloudWatch Logs**: `terraform/environments/<env>/outputs.tf` provides log commands
2. **Review ECS Service Events**: Check ECS console for deployment failures
3. **Verify Security Groups**: Ensure proper ingress/egress rules
4. **Check IAM Permissions**: Verify task roles have necessary permissions

## 📖 Additional Documentation

- **Setup Guide**: Detailed step-by-step deployment instructions
- **Cost Estimation**: Breakdown of AWS costs by service
- **Security Best Practices**: Hardening recommendations
- **Disaster Recovery**: Backup and restore procedures

## 🤝 Contributing

When contributing infrastructure changes:

1. **Test in Dev First**: Always test changes in dev environment
2. **Update Documentation**: Update relevant README and comments
3. **Run `terraform fmt`**: Format code before committing
4. **Run `terraform validate`**: Validate syntax
5. **Create PR**: Include plan output for review

## 📝 License

This infrastructure code is part of the Life Navigator Agent System project.

## 🆘 Support

For infrastructure issues:
- Check CloudWatch dashboard (see outputs)
- Review CloudWatch alarms
- Check ECS service events
- Contact DevOps team

---

**Last Updated**: 2025-10-26
**Terraform Version**: >= 1.5.0
**AWS Provider Version**: ~> 5.0
