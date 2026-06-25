FROM node:22-alpine

LABEL org.opencontainers.image.title="Homedash"
LABEL org.opencontainers.image.description="Homedash is a Docker-friendly browser-managed startpage for home labs."
LABEL org.opencontainers.image.source="https://github.com/immer-gut/Homedash"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app
COPY package.json server.js ./
COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

EXPOSE 3000
VOLUME ["/data"]

CMD ["npm", "start"]
