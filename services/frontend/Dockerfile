# ===========================================
# UNISTYLES FRONTEND - Multi-stage Dockerfile
# React + Vite with Nginx
# ===========================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build args — Vite bakes these into the bundle, so any change requires
# a rebuild. Coolify passes these as Build-time Environment Variables.
ARG VITE_API_URL=http://localhost:3000
ARG VITE_DIRECTUS_URL=http://localhost:8055
ARG VITE_USE_CMS=true

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DIRECTUS_URL=$VITE_DIRECTUS_URL
ENV VITE_USE_CMS=$VITE_USE_CMS

RUN npm run build

# Stage 2: Production with Nginx
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
