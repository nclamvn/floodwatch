# Next.js Production Dockerfile with standalone output
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Accept build arguments for Next.js environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MAPTILER_KEY
ARG NEXT_PUBLIC_MAP_PROVIDER
ARG NODE_ENV=production

# Make them available as environment variables during build
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MAPTILER_KEY=$NEXT_PUBLIC_MAPTILER_KEY
ENV NEXT_PUBLIC_MAP_PROVIDER=$NEXT_PUBLIC_MAP_PROVIDER
ENV NODE_ENV=$NODE_ENV
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Build Next.js
RUN npm run build

# Production stage - minimal image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Health check endpoint
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start with node directly (faster startup than next start)
CMD ["node", "server.js"]
