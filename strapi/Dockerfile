# Strapi CMS Dockerfile for Unistyles
FROM node:20-alpine

# Install build dependencies for native modules
RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev python3

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm install --legacy-peer-deps

# Copy application files
COPY . .

# Build admin panel
ENV NODE_ENV=production
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S strapi && \
    adduser -S strapi -u 1001 -G strapi

# Ensure uploads directory exists and set ownership
RUN mkdir -p /app/public/uploads && \
    chown -R strapi:strapi /app

# Switch to non-root user
USER strapi

# Expose Strapi port
EXPOSE 1337

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:1337/_health || exit 1

# Start Strapi
CMD ["npm", "start"]
