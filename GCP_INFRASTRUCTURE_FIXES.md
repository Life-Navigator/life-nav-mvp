# GCP Infrastructure Fixes & Improvements
## Life Navigator - Backend & Multi-Agent System Deployment

**Last Updated:** 2025-11-12
**Status:** Ready for Implementation
**Architecture:** GKE Autopilot + Managed Services

---

## Executive Summary

Your GCP infrastructure is well-architected with GKE Autopilot, Cloud SQL, and managed services. However, there are **critical security and configuration issues** that must be fixed before production deployment:

### Critical Issues Found:
1. ❌ **Firewall rules allow ALL TCP ports** (0-65535) - Security risk
2. ❌ **Network policies use empty namespace selectors** - Overly permissive
3. ❌ **CORS allows all origins** (`*`) - Security vulnerability
4. ⚠️ **GPU node pools not explicitly configured** - Required for Finance API & Agents
5. ⚠️ **No Vercel domain in CORS configuration** - Frontend will be blocked
6. ⚠️ **iOS mobile app needs API endpoint configuration** - Must use HTTPS load balancer

### Architecture Overview:
```
┌─────────────────────────────────────────────────────────────────┐
│  Vercel (Frontend)         iOS App (Mobile)                      │
│  https://app.vercel.app    https://apps.apple.com/...           │
└──────────────┬──────────────────────┬───────────────────────────┘
               │                      │
               │   HTTPS (TLS 1.2+)  │
               │                      │
       ┌───────▼──────────────────────▼──────────────────┐
       │  GCP Cloud Load Balancer (Global)               │
       │  api.lifenavigator.ai                          │
       │  - Auto SSL/TLS certificates                   │
       │  - DDoS protection                             │
       │  - Rate limiting: 100 RPS                      │
       └────────┬───────────────────────────────────────┘
                │
       ┌────────▼─────────────────────────────────────┐
       │  GKE Autopilot Cluster (us-central1)        │
       │                                              │
       │  ┌──────────────────────────────────────┐   │
       │  │ Backend API (Python/FastAPI)         │   │
       │  │ - Port 8000                          │   │
       │  │ - No GPU                             │   │
       │  │ - HPA: 2-10 replicas                 │   │
       │  └──────────────────────────────────────┘   │
       │                                              │
       │  ┌──────────────────────────────────────┐   │
       │  │ Finance API (Python/FastAPI + GPU)   │   │
       │  │ - Port 8001                          │   │
       │  │ - NVIDIA T4 GPU (OCR inference)      │   │
       │  │ - HPA: 2-5 replicas                  │   │
       │  └──────────────────────────────────────┘   │
       │                                              │
       │  ┌──────────────────────────────────────┐   │
       │  │ Agents Service (Multi-Agent + GPU)   │   │
       │  │ - Port 8080                          │   │
       │  │ - NVIDIA T4 GPU (LLM inference)      │   │
       │  │ - 6 specialized agents               │   │
       │  │ - HPA: 2-5 replicas                  │   │
       │  └──────────────────────────────────────┘   │
       │                                              │
       │  ┌──────────────────────────────────────┐   │
       │  │ MCP Server (Claude Integration)      │   │
       │  │ - Port 8090                          │   │
       │  │ - No GPU                             │   │
       │  └──────────────────────────────────────┘   │
       └────┬─────────────────────┬─────────────────┘
            │                     │
   ┌────────▼─────────┐  ┌───────▼──────────┐
   │ Cloud SQL (PG15) │  │ Memorystore Redis│
   │ - 2 vCPU, 7.5GB  │  │ - 1GB Basic      │
   │ - Private IP     │  │ - Private IP     │
   └──────────────────┘  └──────────────────┘
```

---

## Fix #1: Restrict Firewall Rules (CRITICAL)

### Current Problem:
```terraform
# File: terraform/gcp/modules/vpc/main.tf
resource "google_compute_firewall" "allow_internal" {
  allow {
    protocol = "tcp"
    ports    = ["0-65535"]  # ❌ ALLOWS ALL TCP PORTS!
  }
}
```

**Security Risk:** ANY internal service can connect to ANY port, violating least-privilege principle.

### Solution:
<function_calls>
<invoke name="Read">
<parameter name="file_path">/home/riffe007/Documents/projects/life-navigator-monorepo/terraform/gcp/modules/vpc/main.tf