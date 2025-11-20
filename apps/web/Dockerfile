# Simple Next.js Production Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (including dev dependencies for build)
RUN npm ci && \
    npm cache clean --force

# Copy source code
COPY . .

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 3000

# Start command with PORT variable
CMD node_modules/.bin/next start -p ${PORT:-3000}
