# ===========================================================================
# Multi-stage Dockerfile for Next.js Web Application
# ===========================================================================
# Build: docker build -t life-navigator-web:latest .
# Run: docker run -p 3000:3000 life-navigator-web:latest
# ===========================================================================

# -----------------------------------------------------------------------------
# Stage 0: Base image with pnpm
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm@8.12.0

# -----------------------------------------------------------------------------
# Stage 1: Dependencies - Install all workspace dependencies
# -----------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY turbo.json ./

# Copy package.json files from workspace packages
COPY packages/ui-components/package.json ./packages/ui-components/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/provenance/package.json ./packages/provenance/
COPY apps/web/package.json ./apps/web/

# Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile --prefer-offline

# -----------------------------------------------------------------------------
# Stage 2: Builder - Build application and dependencies
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/pnpm-lock.yaml ./

# Copy package configurations
COPY pnpm-workspace.yaml package.json turbo.json ./

# Copy all source code
COPY . .

# Generate Prisma client (using npx since prisma is a devDependency)
RUN cd apps/web && npx prisma generate

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build with Turbo (builds dependencies first, then web app)
RUN pnpm turbo run build --filter=@life-navigator/web

# -----------------------------------------------------------------------------
# Stage 3: Runner - Minimal production image
# -----------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Copy Prisma schema and generated client
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Security: Switch to non-root user
USER nextjs

# Expose Next.js default port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start Next.js
CMD ["node", "apps/web/server.js"]
