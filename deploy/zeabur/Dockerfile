# Zeabur-specific Dockerfile
FROM ../base/Dockerfile.base AS base

# Zeabur-specific configuration
ENV NODE_ENV=production
ENV DEPLOYMENT_NAME=zeabur

# Copy Zeabur-specific configs
COPY deploy/zeabur/zeabur.json ./

# Zeabur uses PORT env variable
EXPOSE ${PORT:-3000}

# Health check for Zeabur
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Start SSE server for Zeabur deployment
CMD ["node", "dist/server-sse-production.js"]