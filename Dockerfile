FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY config/services.json config/services.json
COPY monitor/check.mjs monitor/check.mjs
COPY src/js/health.js src/js/health.js
RUN mkdir -p /app/src/data && chown node:node /app/src/data
USER node
CMD ["node", "monitor/check.mjs"]
