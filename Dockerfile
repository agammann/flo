FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json eslint.config.js ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps
COPY tests ./tests
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm build:customer
RUN pnpm build:enrollment

FROM node:22-alpine AS runtime

RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app /app

CMD ["node", "services/flo-mcp/dist/index.js"]
