# ===========================
# STAGE 1 — BUILD NEXT.JS
# ===========================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy file cấu hình npm
COPY package.json package-lock.json* ./

# Nhận các biến môi trường build-time từ docker-compose
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ARG NEXT_PUBLIC_MAPTILER_KEY
ARG NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
ARG NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN \
    NEXT_PUBLIC_MAPTILER_KEY=$NEXT_PUBLIC_MAPTILER_KEY \
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=$NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME \
    NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=$NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

# Cài dependencies + GHI ĐÈ lại node_modules/.bin/next + IN RA ĐỂ DEBUG
RUN npm ci \
 && mkdir -p node_modules/.bin \
 && printf '#!/usr/bin/env node\nrequire("next/dist/bin/next");\n' > node_modules/.bin/next \
 && chmod +x node_modules/.bin/next \
 && echo '==== DEBUG: /app/node_modules/.bin/next ====' \
 && sed -n '1,20p' node_modules/.bin/next

# Copy toàn bộ source
COPY . .

# Build Next.js production
RUN npm run build


# ===========================
# STAGE 2 — RUNTIME
# ===========================
FROM node:18-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy toàn bộ app đã build từ stage builder
COPY --from=builder /app ./

EXPOSE 3000

# Chạy Next.js ở chế độ production với PORT từ Render
CMD sh -c "next start -p ${PORT:-3000}"

