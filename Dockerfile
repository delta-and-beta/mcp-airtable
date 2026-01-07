# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --production && npm cache clean --force

# Copy built files
COPY --from=builder /app/dist ./dist

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose Streamable HTTP endpoint
EXPOSE 3000

# Health check - TCP check that server is responding
# Accept any response (including 400 for missing session) as healthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "const http = require('http'); \
    const req = http.request({hostname:'127.0.0.1',port:3000,path:'/mcp',method:'POST',headers:{'Content-Type':'application/json'}}, \
    (res) => process.exit(res.statusCode < 500 ? 0 : 1)); \
    req.on('error', () => process.exit(1)); \
    req.write('{}'); \
    req.end();"

# Run server in HTTP mode (Streamable HTTP transport)
CMD ["node", "dist/index.js"]
