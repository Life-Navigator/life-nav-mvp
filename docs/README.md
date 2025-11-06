# Life Navigator Documentation

Welcome to the Life Navigator documentation hub. This directory contains all technical documentation, guides, and reference materials for the platform.

## 📚 Documentation Structure

### 🏗️ Architecture
- [Backend Architecture](./architecture/) - FastAPI, SQLAlchemy, multi-tenant design
- [Frontend Architecture](./FRONTEND_INTEGRATION_GUIDE.md) - Next.js, React, TypeScript
- [Integration Architecture](./INTEGRATION_ARCHITECTURE.md) - Service communication patterns
- [GraphRAG System](./architecture/) - Semantic knowledge graph and vector search

### 🚀 Deployment
- [GCP Deployment Guide](./deployment/web-deployment-guide.md) - Complete GCP deployment walkthrough
- [Quick Start](./deployment/web-quickstart.md) - Fast deployment guide
- [Docker Setup](./deployment/docker-setup.md) - Local Docker development
- [Azure Deployment](./deployment/azure-deployment.md) - Azure-specific deployment (legacy)
- [Kubernetes Deployment](../k8s/DEPLOYMENT_GUIDE.md) - K8s manifests and Kustomize
- [GCP K8s Summary](../GCP_K8S_DEPLOYMENT_SUMMARY.md) - Infrastructure overview

### 📖 Guides
- **Getting Started:**
  - [Quickstart Guide](./guides/quickstart.md) - Get up and running fast
  - [START_HERE](./guides/START_HERE.md) - New developer onboarding
  - [Developer Guide](./DEVELOPER_GUIDE.md) - Development best practices

- **Configuration:**
  - [OAuth Setup](./guides/oauth-setup.md) - Configure OAuth providers
  - [Auto-Start Setup](./guides/auto-start-setup.md) - Automated service startup
  - [Monitoring Setup](./guides/monitoring-setup.md) - Observability and alerts

- **Testing:**
  - [Beta Testing Guide](./guides/beta-testing.md) - Beta testing procedures
  - [API Testing](./guides/API_ENDPOINTS_COMPLETE.md) - API endpoint testing

- **Models & Integration:**
  - [LLM Model Setup](./LLM_MODEL_SETUP.md) - Configure language models
  - [Connect Maverick Model](./guides/CONNECT_MAVERICK_MODEL.md) - Maverick LLM integration
  - [Real Data Integration](./guides/REAL_DATA_AND_MODEL_INTEGRATION_COMPLETE.md) - Production data setup

### 🔒 Compliance & Security
- [HIPAA Compliance Checklist](./compliance/hipaa-checklist.md) - Healthcare data requirements
- [General Compliance](./compliance/general-compliance.md) - Security and privacy standards

### 🌐 Web Application
- [Auth System](./web/auth-system.md) - Authentication and authorization
- [Auth Implementation](./web/auth-implementation.md) - Technical implementation details
- [Services API](./web/services-api.md) - Frontend service layer
- [Troubleshooting Chat](./web/troubleshooting-chat.md) - Chat feature debugging

### 📊 APIs & Contracts
- [API Documentation](./api/) - REST API reference
- [MCP Tools Contract](./MCP_TOOLS_CONTRACT.md) - Model Context Protocol tools
- [API Endpoints Complete](./guides/API_ENDPOINTS_COMPLETE.md) - Full API catalog

### 🗺️ Roadmap & Planning
- [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md) - Feature development timeline
- [System Audit Report](./SYSTEM_AUDIT_REPORT.md) - Comprehensive system audit (Nov 2025)

### 📦 Ontology
- [Ontology Documentation](./ontology/) - RDF/OWL semantic models

### 📜 Historical Documentation
- [Archive](./archive/) - Completed milestones and historical docs

---

## 🔍 Finding What You Need

### I want to...

**Deploy to production:**
→ Start with [GCP Deployment Guide](./deployment/web-deployment-guide.md)
→ Use [Deployment Checklist](../DEPLOYMENT_CHECKLIST.md)

**Set up local development:**
→ Read [Quickstart Guide](./guides/quickstart.md)
→ Run `./scripts/dev/local-dev.sh`

**Understand the architecture:**
→ Check [Backend Architecture](./architecture/)
→ Review [Integration Architecture](./INTEGRATION_ARCHITECTURE.md)

**Configure OAuth/Auth:**
→ Follow [OAuth Setup Guide](./guides/oauth-setup.md)
→ Read [Auth System docs](./web/auth-system.md)

**Ensure HIPAA compliance:**
→ Review [HIPAA Checklist](./compliance/hipaa-checklist.md)
→ Audit [System Audit Report](./SYSTEM_AUDIT_REPORT.md)

**Test the API:**
→ Use [API Endpoints guide](./guides/API_ENDPOINTS_COMPLETE.md)
→ Check [test-api.html](./test-api.html) for interactive testing

**Set up monitoring:**
→ Follow [Monitoring Setup Guide](./guides/monitoring-setup.md)

---

## 🛠️ Quick Links

- **Main README:** [../README.md](../README.md)
- **Scripts Documentation:** [../scripts/README.md](../scripts/README.md)
- **K8s Documentation:** [../k8s/README.md](../k8s/README.md)
- **Terraform Documentation:** [../terraform/gcp/COMPREHENSIVE_README.md](../terraform/gcp/COMPREHENSIVE_README.md)
- **Backend Code:** [../backend/](../backend/)
- **Frontend Code:** [../apps/web/](../apps/web/)
- **Services:** [../services/](../services/)

---

## 📝 Documentation Standards

### File Naming
- Use lowercase with hyphens: `oauth-setup.md`
- Be descriptive: `web-deployment-guide.md` not `deploy.md`
- Avoid abbreviations unless well-known

### Content Structure
- Start with a clear title and purpose
- Include table of contents for long docs
- Use code blocks with language tags
- Add prerequisites sections
- Include troubleshooting sections

### Keeping Docs Updated
- Update docs when changing features
- Archive outdated docs to `archive/`
- Update this index when adding new docs
- Include "Last Updated" dates in major guides

---

## 🤝 Contributing

When adding documentation:
1. Place in the appropriate subdirectory
2. Follow naming conventions
3. Update this README's index
4. Link from related documents
5. Include code examples where applicable
6. Test all commands and examples

---

## 📞 Support

- **Issues:** Report documentation issues on GitHub
- **Questions:** Check existing docs first, then ask in team chat
- **Improvements:** Submit PRs with documentation updates

---

**Last Updated:** November 5, 2025
