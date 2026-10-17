FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY patio/patio/package.json patio/patio/package.json
RUN npm ci --omit=dev

COPY patio/patio/ patio/patio/

WORKDIR /app/patio/patio
EXPOSE 3000
CMD ["node", "server.js"]
