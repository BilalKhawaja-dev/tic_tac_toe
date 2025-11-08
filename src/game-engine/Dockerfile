# Multi-stage Docker build for Game Engine Service
FROM node:18-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create app directory and user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S gameengine -u 1001 -G nodejs

WORKDIR /app

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm ci --include=dev
COPY . .
RUN chown -R gameengine:nodejs /app
USER gameengine
EXPOSE 3000
CMD ["dumb-init", "npm", "run", "dev"]

# Production dependencies stage
FROM base AS deps
ENV NODE_ENV=production
RUN npm ci --only=production && npm cache clean --force

# Production build stage
FROM base AS production

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY --chown=gameengine:nodejs . .

# Remove development files
RUN rm -rf \
    tests/ \
    *.test.js \
    jest.config.js \
    .eslintrc.js \
    nodemon.json \
    README.md

# Set proper ownership
RUN chown -R gameengine:nodejs /app

# Switch to non-root user
USER gameengine

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose port
EXPOSE 3000

# Start application with dumb-init for proper signal handling
CMD ["dumb-init", "node", "src/index.js"]

# Labels for metadata
LABEL maintainer="Global Gaming Platform Team"
LABEL version="1.0.0"
LABEL description="Game Engine Service for real-time tic-tac-toe multiplayer games"