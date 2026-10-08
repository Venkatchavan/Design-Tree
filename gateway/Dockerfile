# DesignTree gateway — builds the web SPA, then serves it via nginx
# and reverse-proxies /api + /dbadmin. Build context: repo root.
#
#   Stage 1 (web-build): npm build of ./web  → /build/dist
#   Stage 2 (runtime):   nginx:alpine serving dist + gateway/nginx.conf
#
# Nothing secret is baked in: TLS certs and the dbadmin htpasswd file
# are mounted read-only at runtime (see docker-compose.yml).

# ---------- Stage 1: build the SPA ----------
FROM node:22-alpine AS web-build

WORKDIR /build

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./

# Same-origin deployment: the browser calls /api on the same host,
# so the build-time API base stays empty.
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ---------- Stage 2: nginx runtime ----------
FROM nginx:1.27-alpine

COPY --from=web-build /build/dist /usr/share/nginx/html
COPY gateway/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
