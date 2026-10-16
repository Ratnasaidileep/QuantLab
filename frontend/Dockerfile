# ==============================================================================
# QuantLab React Frontend Multi-Stage Dockerfile
# Stage 1: Build production bundle using Node 20
# Stage 2: Serve optimized assets with Nginx Alpine
# ==============================================================================

# Stage 1: Build React SPA bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package dependency manifests first to leverage Docker layer caching
COPY package.json package-lock.json ./

# Install dependencies deterministically
RUN npm ci

# Copy frontend source code and configuration
COPY . .

# Build production assets (TypeScript validation + Vite bundle)
RUN npm run build

# Stage 2: Serve with lightweight, secure Nginx reverse proxy
FROM nginx:alpine AS runner

# Remove default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration with API reverse proxy & SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production static build artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
