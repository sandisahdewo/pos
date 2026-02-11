# ---- Development ----
FROM node:22 AS development

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---- Builder ----
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production ----
FROM node:22-alpine AS production

WORKDIR /app

COPY --from=builder /app/build build/
COPY --from=builder /app/package.json .
COPY --from=builder /app/node_modules node_modules/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "build"]
