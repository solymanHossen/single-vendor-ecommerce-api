# syntax=docker/dockerfile:1

# ---------- deps: full dependency install + Prisma client generation ----------
FROM node:24-alpine AS deps
# bcrypt is a native module — alpine (musl) has no prebuilt binary for it,
# so it compiles from source and needs a toolchain.
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

# ---------- build: compile TypeScript ----------
FROM deps AS build
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---------- prod-deps: production-only node_modules ----------
FROM node:24-alpine AS prod-deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- runtime: minimal final image ----------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app

COPY --from=prod-deps /app/node_modules ./node_modules
# Prisma's generated client lives under node_modules/.prisma — separate from
# the @prisma/client package installed above — and must match schema.prisma.
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY package.json prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.PORT||3000,path:'/api/v1/health/live'},(res)=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main"]
