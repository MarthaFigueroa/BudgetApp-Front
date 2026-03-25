# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

# ── Stage 2: Serve with Nginx ────────────────────────────────────────────────
FROM nginx:stable-alpine

# Remove default Nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy Angular build output
COPY --from=builder /app/dist/budget-app/browser /usr/share/nginx/html

# Nginx config: redirect all routes to index.html (Angular client-side routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
