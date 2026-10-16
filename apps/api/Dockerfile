FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@10.15.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @sentinel/api exec prisma generate
RUN pnpm --filter @sentinel/api build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN npm install -g pnpm@10.15.0
COPY --from=build /app /app
ENV NODE_ENV=production
EXPOSE 3001
RUN sed -i 's/\r$//' apps/api/docker-entrypoint.sh && chmod +x apps/api/docker-entrypoint.sh
CMD ["sh", "apps/api/docker-entrypoint.sh"]
