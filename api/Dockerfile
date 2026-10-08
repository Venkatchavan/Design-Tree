# DesignTree API — production image.
# Build context: ./api (see docker-compose.yml).
# Uploads are NEVER baked into the image: the app writes to $UPLOAD_DIR
# (/data/uploads), which compose mounts from the host HDD bind.
FROM node:22-alpine

WORKDIR /app

# Install production dependencies first (better layer caching).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

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
