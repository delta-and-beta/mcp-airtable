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

# Expose Streamable HTTP endpoint
EXPOSE 3000

# Health check - verify MCP endpoint responds
# Uses the initialize handshake to verify server is operational
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); \
    const req = http.request({hostname:'localhost',port:3000,path:'/mcp',method:'POST',headers:{'Content-Type':'application/json'}}, \
    (res) => process.exit(res.statusCode < 500 ? 0 : 1)); \
    req.on('error', () => process.exit(1)); \
    req.write(JSON.stringify({jsonrpc:'2.0',method:'initialize',params:{capabilities:{}},id:1})); \
    req.end();"

# Run server in HTTP mode (Streamable HTTP transport)
CMD ["node", "dist/index.js"]
