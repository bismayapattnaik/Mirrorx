# MirrorX API Dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared package
WORKDIR /app/packages/shared
RUN pnpm build

# Build API
WORKDIR /app/apps/api
RUN pnpm build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/package.json ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Set environment
ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app/apps/api

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Start server
CMD ["node", "dist/index.js"]
