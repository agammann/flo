FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS build

RUN npm install --global corepack@0.36.0 && corepack enable
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

FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS runtime

RUN npm install --global corepack@0.36.0 && corepack enable
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app /app

CMD ["node", "services/flo-mcp/dist/index.js"]
