FROM node:22-alpine AS base
WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# install only runtime dependencies
RUN NODE_ENV=production corepack enable && \
    corepack prepare pnpm@10.12.1 --activate && \
    pnpm install --prod --frozen-lockfile --ignore-scripts

FROM base AS build
COPY . .

# install everything for the build
RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM base AS runtime
COPY --from=build /app/dist ./dist

EXPOSE $PORT
USER node

CMD ["node", "dist/streamableHttp.js"]
