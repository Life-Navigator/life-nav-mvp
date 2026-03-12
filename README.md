# Life Navigator

AI-powered life management platform with semantic GraphRAG for personalized financial, career, and education advice.

## Stack

- **Frontend**: Next.js 15 (React 19) + Tailwind CSS — deployed on Vercel
- **Mobile**: React Native (Expo)
- **Database**: Supabase (PostgreSQL + Auth + Edge Functions + Storage + Realtime)
- **Knowledge Graph**: Neo4j Aura (property graph with ontology)
- **Vector Search**: Qdrant Cloud (semantic embeddings)
- **AI**: Google Gemini (embeddings + reasoning)
- **Integrations**: Gmail, Outlook, Plaid, Stripe

## Project Structure

```
apps/
  web/          Next.js web app + marketing site
  mobile/       React Native (Expo) mobile app
packages/
  supabase/     Shared Supabase types, clients
  ui-components/ Shared design system
  risk-client/  Risk assessment logic
supabase/
  migrations/   SQL migrations (single source of truth)
  functions/    Supabase Edge Functions (Deno)
ontology/       RDF/Turtle ontology reference
```

## Getting Started

```bash
# Install dependencies (pnpm only)
pnpm install

# Set up environment
cp .env.example .env.local

# Run development server
pnpm dev
```

## Security

- Row-Level Security (RLS) on every table
- Column-level encryption for sensitive data (SSN, tokens, account numbers)
- GDPR compliant (data export, deletion, consent tracking)
- Financial compliance (audit logging, access controls)
- API keys stored in Supabase Vault (never in env vars or client code)
