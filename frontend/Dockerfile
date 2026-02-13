# ===========================================
# UNISTYLES FRONTEND - Multi-stage Dockerfile
# React + Vite with Nginx
# ===========================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build arguments for environment variables (set at build time)
ARG VITE_USE_STRAPI=true
ARG VITE_STRAPI_URL=http://localhost:1337
ARG VITE_API_URL=http://localhost:3000

# Set environment variables for Vite build
ENV VITE_USE_STRAPI=$VITE_USE_STRAPI
ENV VITE_STRAPI_URL=$VITE_STRAPI_URL
ENV VITE_API_URL=$VITE_API_URL

# Build the application
RUN npm run build

# Stage 2: Production with Nginx
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
