# LifeNavigator Microservices Architecture

## Overview

LifeNavigator uses a microservices architecture to ensure scalability, maintainability, and domain separation. Each service is independently deployable and focuses on a specific domain.

## Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Azure API Gateway                        │
│                    (Rate Limiting, Auth)                     │
└──────────┬──────────────────────────────────────────────────┘
           │
           ├─────────────────────────────────────────┐
           │                                         │
    ┌──────▼──────┐                         ┌───────▼────────┐
    │  Next.js    │                         │   GraphQL      │
    │  Frontend   │◄────────────────────────│   Gateway      │
    │  (Port 3000)│                         │  (Port 4000)   │
    └─────────────┘                         └───────┬────────┘
                                                    │
    ┌───────────────────────────────────────────────┼───────────────────────────────┐
    │                                               │                               │
    ▼                                               ▼                               ▼
┌──────────────┐                        ┌──────────────┐                ┌──────────────┐
│  Finance API │                        │Healthcare API│                │  Career API  │
│   (FastAPI)  │                        │  (FastAPI)   │                │   (Go/Gin)   │
│  Port: 8001  │                        │  Port: 8002  │                │  Port: 8003  │
└──────┬───────┘                        └──────┬───────┘                └──────┬───────┘
       │                                        │                                │
       ▼                                        ▼                                ▼
┌──────────────┐                        ┌──────────────┐                ┌──────────────┐
│  PostgreSQL  │                        │  PostgreSQL  │                │  PostgreSQL  │
│   Finance    │                        │   Health     │                │   Career     │
└──────────────┘                        └──────────────┘                └──────────────┘

    ┌───────────────────────────────────────────────┼───────────────────────────────┐
    │                                               │                               │
    ▼                                               ▼                               ▼
┌──────────────┐                        ┌──────────────┐                ┌──────────────┐
│Education API │                        │   User API   │                │Analytics API │
│   (Node.js)  │                        │  (FastAPI)   │                │   (Python)   │
│  Port: 8004  │                        │  Port: 8005  │                │  Port: 8006  │
└──────┬───────┘                        └──────┬───────┘                └──────┬───────┘
       │                                        │                                │
       ▼                                        ▼                                ▼
┌──────────────┐                        ┌──────────────┐                ┌──────────────┐
│  PostgreSQL  │                        │  PostgreSQL  │                │   ClickHouse │
│  Education   │                        │    Users     │                │   Analytics  │
└──────────────┘                        └──────────────┘                └──────────────┘

                              ┌─────────────────────────┐
                              │   Shared Services       │
                              ├─────────────────────────┤
                              │ • Redis Cache           │
                              │ • Azure Service Bus     │
                              │ • Azure Cosmos DB       │
                              │ • Azure OpenAI          │
                              │ • Application Insights  │
                              └─────────────────────────┘
```

## Service Details

### 1. Finance API (FastAPI) ✅ Built
**Technology**: Python, FastAPI, SQLAlchemy, Pandas
**Port**: 8001
**Responsibilities**:
- Financial profile management
- Goal planning and tracking
- Investment analysis and recommendations
- Budget management
- Transaction categorization
- Integration with Plaid, Stripe, Alpaca
- Tax optimization strategies
- Monte Carlo simulations

**Key Features**:
- Real-time market data integration
- Portfolio rebalancing algorithms
- Retirement planning projections
- Debt optimization strategies

### 2. Healthcare API (FastAPI) 🔄 Suggested
**Technology**: Python, FastAPI, SQLAlchemy, NumPy/SciPy
**Port**: 8002
**Responsibilities**:
- Health profile management
- Medical record storage (HIPAA compliant)
- Fitness tracking integration
- Nutrition planning
- Mental health assessments
- Medication management
- Healthcare provider network
- Insurance optimization

**Key Features**:
- Wearable device integration (Apple Health, Fitbit)
- Predictive health analytics
- Personalized wellness plans
- Telemedicine integration

### 3. Career API (Go/Gin) 🔄 Suggested
**Technology**: Go, Gin, GORM, PostgreSQL
**Port**: 8003
**Why Go?**: High performance, excellent concurrency for job matching algorithms
**Responsibilities**:
- Career profile and resume management
- Skill assessment and gap analysis
- Job market analysis
- Salary benchmarking
- Professional development tracking
- Networking recommendations
- Interview preparation
- LinkedIn integration

**Key Features**:
- Real-time job matching
- Skill trending analysis
- Career path simulations
- Industry insights

### 4. Education API (Node.js/Express) 🔄 Suggested
**Technology**: Node.js, Express, Prisma, TypeScript
**Port**: 8004
**Why Node.js?**: Excellent for real-time features, course content delivery
**Responsibilities**:
- Learning profile management
- Course recommendations
- Skill certification tracking
- Learning path optimization
- Study schedule management
- Resource library
- Progress tracking
- Integration with online learning platforms

**Key Features**:
- Adaptive learning algorithms
- Content recommendation engine
- Study group matching
- Certification roadmaps

### 5. User & Auth API (FastAPI) 🔄 Suggested
**Technology**: Python, FastAPI, SQLAlchemy, Redis
**Port**: 8005
**Responsibilities**:
- User authentication and authorization
- Profile management
- Preferences and settings
- Security and privacy controls
- Multi-factor authentication
- Session management
- API key management
- RBAC implementation

**Key Features**:
- OAuth2/OIDC support
- Biometric authentication
- Zero-trust security model
- Audit logging

### 6. Analytics API (Python) 🔄 Suggested
**Technology**: Python, FastAPI, ClickHouse, Apache Spark
**Port**: 8006
**Why ClickHouse?**: Excellent for time-series analytics
**Responsibilities**:
- Cross-domain analytics
- User behavior tracking
- Performance metrics
- Predictive analytics
- Report generation
- Data aggregation
- ML model serving
- A/B testing infrastructure

**Key Features**:
- Real-time dashboards
- Custom report builder
- Predictive insights
- Anomaly detection

## Shared Infrastructure

### Message Queue (Azure Service Bus)
- Event-driven communication between services
- Async task processing
- Service decoupling

### Cache Layer (Redis)
- Session storage
- API response caching
- Rate limiting
- Real-time features

### GraphRAG (Cosmos DB)
- Knowledge graph storage
- Relationship mapping
- Context enhancement
- Pattern recognition

### API Gateway (Azure API Management)
- Request routing
- Rate limiting
- Authentication
- API versioning
- Request/response transformation
- Circuit breaking

## Development Setup

### Running All Services Locally

```bash
# Start infrastructure
docker-compose up -d postgres redis

# Finance API
cd services/finance-api
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001

# Healthcare API
cd services/healthcare-api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8002

# Career API (Go)
cd services/career-api
go mod download
go run main.go

# Education API (Node.js)
cd services/education-api
pnpm install
pnpm dev

# Frontend
cd /
pnpm dev
```

### Docker Compose Setup

```yaml
version: '3.8'

services:
  finance-api:
    build: ./services/finance-api
    ports:
      - "8001:8001"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/finance
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  healthcare-api:
    build: ./services/healthcare-api
    ports:
      - "8002:8002"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/health
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  career-api:
    build: ./services/career-api
    ports:
      - "8003:8003"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/career
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_MULTIPLE_DATABASES=finance,health,career,education,users
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Service Communication

### Synchronous Communication
- REST APIs for client-facing operations
- GraphQL for frontend data aggregation
- gRPC for internal service-to-service (future)

### Asynchronous Communication
- Event-driven via Azure Service Bus
- Background job processing
- Notification system

### Example Flow: Creating a Financial Goal

1. **Frontend** → GraphQL Gateway: Create goal mutation
2. **GraphQL Gateway** → Finance API: POST /api/v1/goals
3. **Finance API**:
   - Validates goal parameters
   - Calculates projections
   - Stores in PostgreSQL
   - Publishes "GoalCreated" event
4. **Analytics API** (subscriber):
   - Updates user analytics
   - Generates insights
5. **Notification Service** (subscriber):
   - Sends confirmation email
6. **AI Agent** (subscriber):
   - Updates knowledge graph
   - Generates recommendations

## Security Considerations

### API Security
- JWT tokens for authentication
- API key management for service-to-service
- Rate limiting per user/service
- Input validation and sanitization
- SQL injection prevention
- XSS protection

### Data Security
- Encryption at rest (PostgreSQL, Redis)
- Encryption in transit (TLS 1.3)
- PII data masking
- HIPAA compliance for health data
- GDPR compliance for EU users
- Audit logging

### Network Security
- Private VNet for services
- Network segmentation
- WAF for public endpoints
- DDoS protection
- Regular security scanning

## Monitoring & Observability

### Application Insights
- Request tracking
- Exception logging
- Performance metrics
- Custom events

### Prometheus + Grafana
- Service metrics
- Infrastructure monitoring
- Custom dashboards
- Alerting

### Distributed Tracing
- Correlation IDs
- Request flow visualization
- Performance bottleneck identification

### Health Checks
- Liveness probes
- Readiness probes
- Dependency checks

## Deployment Strategy

### Azure Kubernetes Service (AKS)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: finance-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: finance-api
  template:
    metadata:
      labels:
        app: finance-api
    spec:
      containers:
      - name: finance-api
        image: lifenavigator.azurecr.io/finance-api:latest
        ports:
        - containerPort: 8001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: finance-secrets
              key: database-url
        livenessProbe:
          httpGet:
            path: /health
            port: 8001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8001
          initialDelaySeconds: 5
          periodSeconds: 5
```

### CI/CD Pipeline
1. Code push to main branch
2. Run tests (unit, integration, e2e)
3. Build Docker image
4. Push to Azure Container Registry
5. Deploy to staging environment
6. Run smoke tests
7. Deploy to production (blue-green)
8. Monitor metrics

## Scaling Strategy

### Horizontal Scaling
- Auto-scaling based on CPU/memory
- Request rate scaling
- Event-driven scaling (KEDA)

### Vertical Scaling
- Resource optimization
- Database connection pooling
- Cache optimization

### Data Scaling
- Database sharding
- Read replicas
- Caching strategies
- CDN for static assets

## Next Steps

1. **Complete Finance API** ✅
2. **Build Healthcare API** with HIPAA compliance
3. **Implement Career API** in Go for performance
4. **Create Education API** with real-time features
5. **Set up User/Auth API** with OAuth2
6. **Deploy Analytics API** with ClickHouse
7. **Configure API Gateway** with Azure API Management
8. **Implement GraphQL Gateway** for frontend
9. **Set up monitoring** with Application Insights
10. **Deploy to AKS** with auto-scaling