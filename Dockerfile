FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY patio/patio/package.json patio/patio/package-lock.json ./patio/patio/
WORKDIR /app/patio/patio
RUN npm ci --omit=dev

COPY patio/patio/ ./

WORKDIR /app
EXPOSE 3000
CMD ["node", "patio/patio/server.js"]
