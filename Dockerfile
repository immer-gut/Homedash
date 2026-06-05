FROM node:22-alpine

LABEL org.opencontainers.image.title="Homebase"
LABEL org.opencontainers.image.description="A small Docker-friendly browser-managed startpage for home labs."
LABEL org.opencontainers.image.source="https://github.com/sandavdesigns/homebase"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app
COPY package.json server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

EXPOSE 3000
VOLUME ["/data"]

CMD ["npm", "start"]
