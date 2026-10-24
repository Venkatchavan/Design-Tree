# DesignTree API — production image.
# Build context: ./api (see docker-compose.yml).
# Uploads are NEVER baked into the image: the app writes to $UPLOAD_DIR
# (/data/uploads), which compose mounts from the host HDD bind.
# Patched Node 22 LTS; pin the multi-platform index for reproducible builds.
FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS dependencies

WORKDIR /app

# Install production dependencies first (better layer caching).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Runtime needs Node and the installed application, not npm's own dependency
# tree or package-management tools. Keep those in the build stage only.
FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /opt/yarn-* /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY server.js ./
COPY src ./src

# Upload landing dir inside the container; compose mounts the real
# storage here. Created now so the non-root user owns it even if the
# mount is ever absent (e.g. local `docker run` smoke tests).
RUN mkdir -p /data/uploads && chown -R node:node /app /data/uploads

USER node

ENV NODE_ENV=production \
    PORT=5000 \
    UPLOAD_DIR=/data/uploads

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
