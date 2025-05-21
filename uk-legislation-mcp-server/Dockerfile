FROM node:18-slim

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Expose the port
EXPOSE 8080

# Start the MCP server
CMD ["node", "build/index.js"] 