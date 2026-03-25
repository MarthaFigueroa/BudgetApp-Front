# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# URL del backend — se inyecta desde Secret Manager vía Cloud Build.
# Valor por defecto para desarrollo local.
ARG API_URL=http://localhost:3001

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Reemplaza la URL del backend en el servicio antes de compilar
RUN sed -i "s|http://localhost:3001|${API_URL}|g" src/app/services/api.service.ts

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
