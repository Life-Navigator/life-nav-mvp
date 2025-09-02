# LifeNavigator

A comprehensive life planning and goal management platform built with Next.js, TypeScript, and Azure.

## 🚀 Features

### Core Functionality
- **Benefits Discovery**: Interactive drag-and-drop interface to discover personal motivations
- **MyBlocks Goals**: Visual goal planning system inspired by MoneyGuidePro
- **What-What-Why Conversations**: AI-powered multi-agent system for discovering true motivations
- **Risk Assessment**: Comprehensive risk profiling (coming soon)

### Technical Features
- HIPAA-compliant architecture
- Real-time collaboration capabilities
- Multi-factor authentication
- End-to-end encryption for sensitive data
- Comprehensive audit logging

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (Azure Database)
- **Cache**: Redis
- **Queue**: Bull with Redis
- **Authentication**: NextAuth.js
- **Infrastructure**: Azure (App Service, PostgreSQL, Redis, Key Vault)
- **Deployment**: Docker, Terraform

## 📦 Installation

```bash
# Install dependencies (requires pnpm v9+)
pnpm install

# Set up environment variables
cp .env.example .env.local

# Run database migrations
pnpm prisma migrate dev

# Start development server
pnpm dev
```

## 🏗️ Project Structure

```
src/
├── app/           # Next.js app directory
├── components/    # React components
├── lib/          # Core libraries and utilities
│   ├── auth/     # Authentication
│   ├── benefits/ # Benefits discovery system
│   ├── conversation/ # What-What-Why conversation engine
│   ├── goals/    # Goal management
│   ├── security/ # Security and HIPAA compliance
│   └── queue/    # Background job processing
├── styles/       # Global styles
└── types/        # TypeScript type definitions
```

## 🚀 Deployment

See [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md) for detailed Azure deployment instructions.

## 📄 License

Proprietary - All Rights Reserved

## 🤝 Contributing

This is a private repository. Please contact the team for contribution guidelines.
