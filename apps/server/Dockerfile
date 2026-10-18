# ODİ sosyal sunucusu — tek dosyalık paket (dist/server.mjs) + Node 22 (yerleşik node:sqlite, yerel derleme yok)
# Depo kökünden derlenir:  docker build -f apps/server/Dockerfile -t odi-sunucu .
FROM node:22-alpine AS build
WORKDIR /src
COPY packages/shared ./packages/shared
COPY packages/content ./packages/content
COPY apps/server/package.json apps/server/build.mjs ./apps/server/
COPY apps/server/src ./apps/server/src
# Tüm monorepo yerine yalnızca paketleme için gerekenler
RUN npm init -y >/dev/null \
 && npm install --no-save --no-audit --no-fund --legacy-peer-deps esbuild@0.28.2 ws@8.22.0 zod@4.6.7 \
 && mkdir -p node_modules/@odi && ln -s ../../packages/shared node_modules/@odi/shared \
 && ln -s ../../packages/content node_modules/@odi/content \
 && node apps/server/build.mjs

FROM node:22-alpine
WORKDIR /app
COPY --from=build /src/apps/server/dist ./dist
ENV NODE_ENV=production \
    PORT=8787 \
    ODI_DB=/app/data/odi.sqlite
EXPOSE 8787
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/server.mjs"]
