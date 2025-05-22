FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Expose port for health check endpoint
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Start the server
CMD ["node", "build/index.js"]
