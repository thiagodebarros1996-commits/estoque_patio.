FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY patio/patio/package.json patio/patio/package-lock.json ./
RUN npm ci --omit=dev

COPY patio/patio/ ./

EXPOSE 3000
CMD ["node", "server.js"]
