FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY config/services.json config/services.json
COPY monitor/check.mjs monitor/check.mjs
CMD ["node", "monitor/check.mjs"]
