# Multi-stage build for all MCP servers
# Base stage with common dependencies
FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y chromium \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_BIN=/usr/bin/chromium

# Build stage for UK Legislation server
FROM base AS uk-legislation-build
WORKDIR /app/uk-legislation-mcp-server
COPY uk-legislation-mcp-server/package*.json ./
RUN npm ci
COPY uk-legislation-mcp-server/ .
RUN npm run build

# Build stage for HMRC server
FROM base AS hmrc-build
WORKDIR /app/hmrc-mcp-server
COPY hmrc-mcp-server/package*.json ./
RUN npm ci
COPY hmrc-mcp-server/ .
RUN npm run build

# Build stage for Dataset Creation server
FROM base AS dataset-creation-build
WORKDIR /app/dataset-creation-mcp-server
COPY dataset-creation-mcp-server/package*.json ./
RUN npm ci
COPY dataset-creation-mcp-server/ .
RUN npm run build

# Build stage for Storybook server
FROM base AS storybook-build
WORKDIR /app/storybook-mcp-server
COPY storybook-mcp-server/package*.json ./
RUN npm ci
COPY storybook-mcp-server/ .
RUN npm run build

# Final stage for UK Legislation server
FROM base AS uk-legislation
WORKDIR /app/server
COPY --from=uk-legislation-build /app/uk-legislation-mcp-server/build ./build
COPY --from=uk-legislation-build /app/uk-legislation-mcp-server/package*.json ./
RUN npm ci --only=production
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1
CMD ["node", "build/index.js"]

# Final stage for HMRC server
FROM base AS hmrc
WORKDIR /app/server
COPY --from=hmrc-build /app/hmrc-mcp-server/build ./build
COPY --from=hmrc-build /app/hmrc-mcp-server/package*.json ./
RUN npm ci --only=production
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8081/health || exit 1
CMD ["node", "build/index.js"]

# Final stage for Dataset Creation server
FROM base AS dataset-creation
WORKDIR /app/server
COPY --from=dataset-creation-build /app/dataset-creation-mcp-server/build ./build
COPY --from=dataset-creation-build /app/dataset-creation-mcp-server/package*.json ./
RUN npm ci --only=production
EXPOSE 8082
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8082/health || exit 1
CMD ["node", "build/index.js"]

# Final stage for Storybook server
FROM base AS storybook
WORKDIR /app/server
COPY --from=storybook-build /app/storybook-mcp-server/build ./build
COPY --from=storybook-build /app/storybook-mcp-server/package*.json ./
RUN npm ci --only=production
EXPOSE 8083
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8083/health || exit 1
CMD ["node", "build/index.js"]
