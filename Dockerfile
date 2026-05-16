# syntax=docker/dockerfile:1

# Build requires ffmpeg/ffprobe (enhanced-video) and Node 24 (apps/demo engines).
FROM node:24-bookworm-slim AS builder

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg \
	&& rm -rf /var/lib/apt/lists/*

ENV HUSKY=0
RUN corepack enable pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/enhanced-video/package.json packages/enhanced-video/
COPY apps/demo/package.json apps/demo/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY packages/enhanced-video packages/enhanced-video
COPY apps/demo apps/demo

RUN pnpm install --frozen-lockfile \
	&& pnpm build \
	&& pnpm --filter demo deploy /deploy --prod --legacy \
	&& cp -r apps/demo/build /deploy/build

FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY --from=builder /deploy ./

EXPOSE 3000

CMD ["node", "build/index.js"]
