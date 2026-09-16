FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# 開発用ステージ: docker-compose.yml/e2eがbind mountするので、
# ここでのCOPY package*.json ./ は「初回起動時にnode_modulesを用意するため」だけの役割
FROM base AS dev
RUN npm install
CMD ["npm", "run", "dev"]

# ビルド専用ステージ: devDependencies込みでTypeScriptをJSに変換する
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# 本番ステージ: 変換済みのdist/だけを持ち込み、依存関係も本番用(devDependencies抜き)で入れ直す
FROM base AS production
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
CMD ["npm", "start"]
