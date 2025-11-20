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

# Accept build arguments for Next.js environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MAPTILER_KEY
ARG NEXT_PUBLIC_MAP_PROVIDER
ARG NODE_ENV

# Make them available as environment variables during build
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MAPTILER_KEY=$NEXT_PUBLIC_MAPTILER_KEY
ENV NEXT_PUBLIC_MAP_PROVIDER=$NEXT_PUBLIC_MAP_PROVIDER
ENV NODE_ENV=$NODE_ENV

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 3000

# Start command with PORT variable
CMD node_modules/.bin/next start -p ${PORT:-3000}
