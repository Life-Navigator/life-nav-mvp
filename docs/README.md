# LifeNavigator Documentation

**Welcome!** This is your starting point for understanding the LifeNavigator system.

**Goal**: A new engineer can understand the system in 30 minutes.

---

## 🚀 Quick Start (Choose Your Path)

### I'm a New Developer
1. **Read**: [Developer Guide](./DEVELOPER_GUIDE.md) (10 min)
2. **Setup**: Run `./scripts/setup-dev-env.sh` (15 min)
3. **Test**: [Frontend Integration Quickstart](./CONNECT_FRONTEND_QUICKSTART.md) (5 min)

### I'm Deploying to Production
1. **Security**: [Security Quickstart](./security/SECURITY_QUICKSTART.md) (15 min)
2. **Checklist**: [Release Candidate Checklist](./deployment/RELEASE_CANDIDATE_CHECKLIST.md) (10 min)
3. **Deploy**: [Deployment Guide](./DEPLOYMENT_GUIDE.md) (30 min)

### I Need to Understand Architecture
1. **Overview**: [Architecture Overview](./architecture/OVERVIEW.md) (10 min)
2. **Services**: [Services Architecture](./architecture/SERVICES.md) (10 min)
3. **Data Flows**: [Data Flows](./architecture/DATA_FLOWS.md) (10 min)

### I'm Investigating an Issue
1. **Incident Response**: [Incident Response Plan](./incident_response/INCIDENT_RESPONSE.md) (5 min)
2. **Break-Glass**: [Emergency Access](./incident_response/BREAK_GLASS_PROCEDURE.md) (3 min)
3. **Rollback**: [Rollback Runbook](./resilience/ROLLBACK_RUNBOOK.md) (5 min)

---

## 📚 Master Index

**Too much to read?** See [INDEX.md](./INDEX.md) for a complete categorized list of all documentation.

---

## 🏗️ System Overview (5 Minute Version)

LifeNavigator is a **HIPAA-compliant financial + health planning platform** with:

### Core Services
- **Web App** (Next.js 16) - User interface
- **Main Backend** (FastAPI) - API gateway, auth, data
- **Risk Engine** (Python) - Monte Carlo simulations, goal analysis
- **Agent Orchestrator** (FastAPI) - AI agent coordination
- **GraphRAG API** (Optional) - Knowledge graph queries

### Data Stores
- **Supabase** (PostgreSQL) - Primary database
- **Redis** - Caching, rate limiting
- **GCS** - File storage

### Key Features
- Multi-goal financial planning
- Real-time risk computation
- AI-powered recommendations
- Household financial modeling
- HIPAA-compliant data handling

---

## 📖 Most Common Tasks

### Development

| Task | Documentation | Time |
|------|--------------|------|
| Set up dev environment | [Developer Guide](./DEVELOPER_GUIDE.md) | 15 min |
| Run backend locally | [Developer Guide § Local Development](./DEVELOPER_GUIDE.md#local-development) | 5 min |
| Run frontend locally | [Frontend Integration](./CONNECT_FRONTEND_QUICKSTART.md) | 5 min |
| Add a new API endpoint | [Developer Guide § API Development](./DEVELOPER_GUIDE.md#api-development) | 10 min |
| Write tests | [Phase 4 Domain Tests](./PHASE4_DOMAIN_TESTS.md) | 15 min |

### Security & Compliance

| Task | Documentation | Time |
|------|--------------|------|
| Security implementation | [Security Quickstart](./security/SECURITY_QUICKSTART.md) | 15 min |
| HIPAA compliance check | [HIPAA Compliance](./HIPAA_COMPLIANCE.md) | 20 min |
| Security audit | [Enterprise Security Audit](./security/ENTERPRISE_SECURITY_AUDIT_2026.md) | 30 min |
| Data boundary rules | [Risk Engine Data Boundary](./security/RISK_ENGINE_DATA_BOUNDARY.md) | 10 min |

### Deployment

| Task | Documentation | Time |
|------|--------------|------|
| Pre-deployment checklist | [Release Candidate Checklist](./deployment/RELEASE_CANDIDATE_CHECKLIST.md) | 15 min |
| Deploy to staging | [Deployment Guide § Staging](./DEPLOYMENT_GUIDE.md#staging) | 10 min |
| Deploy to production | [Deployment Guide § Production](./DEPLOYMENT_GUIDE.md#production) | 20 min |
| Rollback deployment | [Rollback Runbook](./resilience/ROLLBACK_RUNBOOK.md) | 5 min |

### Operations

| Task | Documentation | Time |
|------|--------------|------|
| Monitor system health | [Operations Guide](./operations/MONITORING.md) | 5 min |
| Respond to incident | [Incident Response](./incident_response/INCIDENT_RESPONSE.md) | 10 min |
| Access break-glass | [Break-Glass Procedure](./incident_response/BREAK_GLASS_PROCEDURE.md) | 3 min |
| Database backup/restore | [Restore Runbook](./resilience/RESTORE_RUNBOOK_CLOUDSQL.md) | 15 min |

---

## 🗺️ Documentation Map

```
docs/
├── README.md (you are here)          ← Start here
├── INDEX.md                          ← Complete documentation index
│
├── architecture/                     ← System design
│   ├── OVERVIEW.md                  ← High-level architecture (NEW)
│   ├── SERVICES.md                  ← Service details (NEW)
│   └── DATA_FLOWS.md                ← Data flow diagrams (NEW)
│
├── security/                         ← Security & compliance
│   ├── SECURITY_QUICKSTART.md       ← Quick security guide
│   ├── RISK_ENGINE_DATA_BOUNDARY.md ← Data boundary rules
│   └── ENTERPRISE_SECURITY_AUDIT_2026.md
│
├── deployment/                       ← Deployment guides
│   ├── RELEASE_CANDIDATE_CHECKLIST.md
│   └── DEPLOYMENT_GUIDE.md
│
├── incident_response/                ← Emergency procedures
│   ├── INCIDENT_RESPONSE.md
│   └── BREAK_GLASS_PROCEDURE.md
│
├── compliance/                       ← HIPAA, PCI, etc.
│   └── HIPAA_COMPLIANCE_CHECKLIST.md
│
├── guides/                           ← How-to guides
├── operations/                       ← Ops runbooks
└── archive/                          ← Old docs
```

---

## 🎯 Key Concepts (2 Minute Primer)

### Multi-Goal Planning
Users can have multiple competing goals (retirement, home purchase, education). Risk engine allocates shared cashflow using **waterfall policies**.

### Risk Engine
Internal Python service that runs **Monte Carlo simulations** to compute goal success probabilities. Frontend never calls it directly (security boundary).

### Data Boundary
Risk engine only receives **derived numeric features** (no PHI, no PCI). Example: `health_cost_shock_annual_max: 5000` instead of diagnosis codes.

### Service-to-Service Auth
Backend → Risk Engine uses JWT with `aud="risk-engine"` and scoped permissions.

### Break-Glass Access
Emergency access for production issues. Requires justification, logs everything, alerts security team.

---

## 🔗 External Resources

- **API Docs**: https://api.lifenavigator.com/docs (Swagger/OpenAPI)
- **Status Page**: https://status.lifenavigator.com
- **GitHub**: https://github.com/lifenavigator/monorepo (private)
- **Slack**: #engineering, #incidents

---

## 🆘 Need Help?

### Common Questions

**Q: Where do I start as a new developer?**
A: Run `./scripts/setup-dev-env.sh` and read [Developer Guide](./DEVELOPER_GUIDE.md).

**Q: How do I deploy to production?**
A: Complete [Release Candidate Checklist](./deployment/RELEASE_CANDIDATE_CHECKLIST.md), then follow [Deployment Guide](./DEPLOYMENT_GUIDE.md).

**Q: System is down, what do I do?**
A: Follow [Incident Response](./incident_response/INCIDENT_RESPONSE.md) and post in #incidents.

**Q: How do I add a new feature?**
A: Read [Developer Guide § Feature Development](./DEVELOPER_GUIDE.md#feature-development) and [Architecture Overview](./architecture/OVERVIEW.md).

**Q: Where are the tests?**
A: [Phase 4 Domain Tests](./PHASE4_DOMAIN_TESTS.md) + `backend/tests/` + `apps/web/__tests__/`.

### Contact

- **General Questions**: #engineering (Slack)
- **Security Issues**: security@lifenavigator.com
- **Incidents**: #incidents (Slack) or PagerDuty
- **Documentation Issues**: Create PR or GitHub issue

---

## 📝 Contributing to Docs

**Found a mistake?** Please update the docs!

1. Edit the relevant file
2. Submit PR with description
3. Tag @platform-team for review

**Adding new docs?**
1. Create in appropriate directory (see map above)
2. Add to [INDEX.md](./INDEX.md)
3. Link from this README if it's a common task

---

## ✅ Documentation Standards

- **Use clear headings** (H1 for title, H2 for sections)
- **Add time estimates** ("15 min read")
- **Include code examples** (copy-pasteable)
- **Link related docs** (no dead ends)
- **Keep it updated** (date stamp at top)
- **Archive old docs** (move to `archive/` with note)

---

**Last Updated**: 2026-01-09
**Next Review**: 2026-02-09 (monthly)

**Welcome to LifeNavigator!** 🚀
