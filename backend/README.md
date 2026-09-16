# backend

mymovie.jp（バニラJS製の映画レビューアプリ）をDDD（ドメイン駆動設計）でリライトしたバックエンド。
Fastify + TypeScript製のREST APIで、映画検索・登録、レビューのCRUD、ユーザー認証（メール/パスワード + Google/GitHub OAuth）、フォロー機能を提供する。永続化はPostgres（Drizzle ORM）、外部APIとしてTMDB（映画情報）を利用し、OpenTelemetryでトレース・メトリクス・ログを計装する。本番はGoogle Cloud Run + Neon（サーバーレスPostgres）にデプロイされている。

## アーキテクチャ

DDDのレイヤードアーキテクチャを採用している（`src/`配下）。

```
src/
├── domain/          # ドメイン層: エンティティ・値オブジェクト・リポジトリインターフェース
├── application/      # アプリケーション層: ユースケース（1ユースケース1クラス）
├── infrastructure/   # インフラ層: Drizzle実装・外部APIクライアント・DB接続・ロガー
├── presentation/      # プレゼンテーション層: Fastifyルート・ミドルウェア・エラーハンドラ
├── composition/       # 合成ルート: 実装の組み立て・依存注入を行う唯一の場所
├── buildApp.ts        # Fastifyインスタンスを組み立てる（listenはしない）
├── index.ts           # 本番起動のエントリポイント（buildAppを呼びlistenする）
└── telemetry.ts        # OpenTelemetry初期化（--importでindex.tsより前に読み込む）
```

- **domain層**: ビジネスルールの中心。例えば`domain/review/Review.ts`は`canBeDeletedBy(userId)`/`canBeUpdatedBy(userId)`のように「誰が操作できるか」の判断をエンティティ自身に持たせている（Application層で`review.userId !== userId`のような直接比較はしない）。リポジトリはインターフェース（`IReviewRepository`等）のみを置く。
- **application層**: ユースケース単位のクラス（`RegisterUser`/`CreateReview`等）。ドメインのリポジトリインターフェースに依存し、具体的な実装（Drizzle等）は知らない。
- **infrastructure層**: `DrizzleXxxRepository`がドメインのリポジトリインターフェースを実装する。DBの生データはリポジトリ内で必ずドメインクラス（`Review`/`Movie`等）に変換して返す。`TmdbApiClient`（TMDB API）、`GitHubApiClient`（GitHub API）、`GcsAvatarSigner`（GCSの署名付きURL発行）もここに置く。
- **presentation層**: `presentation/routes/*.ts`がFastifyルートを定義する。リクエストボディの型・必須チェックはZodスキーマ（`fastify-type-provider-zod`）で行う。`presentation/middleware/authenticate.ts`がJWTを検証するpreHandlerフック、`presentation/errorHandler.ts`が`AppError`かどうかでステータスコードを振り分ける集約エラーハンドラ。
- **composition層**: `composition/container.ts`だけが具体実装（`DrizzleXxxRepository`、`TmdbApiClient`、`JwtService`等）をnewしてよい唯一の場所。各ルートが必要とするユースケースの束（`AuthRouteDeps`等）を組み立てて`index.ts`に渡す。テスト（e2eテスト）では本番実装を使わず、必要な分のモックだけを`buildApp()`に渡せる。

## セットアップ・実行

### リポジトリ全体を動かす場合（推奨）

ローカル開発は基本的にリポジトリルートの`docker-compose.yml`経由で行う。backend単体だけでなく、Postgres・フロントエンド・OpenTelemetry Collector・Jaeger・Prometheus・Grafana・Elasticsearchも含めて一括起動できる。

```bash
# リポジトリルートで
docker compose up
```

backendは`http://localhost:3000`で待ち受ける。`docker-compose.yml`の`backend`サービスは`./backend`をbind mountしているため、ローカルのソース変更が即座にコンテナ内の`npm run dev`（`tsx watch`）に反映される。

### backend単体で動かす場合

Postgresなど依存サービスを別途用意した上で、以下のスクリプトで直接実行できる。

```bash
cd backend
npm install
```

`.env`（またはシェル環境変数）に最低限以下を設定する。

| 変数名 | 内容 |
|---|---|
| `DATABASE_URL` | Postgres接続文字列 |
| `JWT_SECRET` | JWTの署名鍵 |
| `BACKEND_URL` / `FRONTEND_URL` | OAuthコールバックURL・ログイン後リダイレクト先の組み立てに使用 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `TMDB_READ_ACCESS_TOKEN` | TMDB API |
| `AVATAR_BUCKET_NAME` | アバター画像用GCSバケット名 |
| `NODE_ENV` | `production`でCookieの`secure`/`sameSite`設定が変わる |
| `ENABLE_API_DOCS` | `true`のときだけSwagger UI（`/documentation`）を有効化するopt-inフラグ（デフォルト無効） |

```bash
npm run dev    # tsx watch。ホットリロード付きの開発サーバー
npm run build  # tscでdist/にコンパイル
npm start       # distをビルド済み前提で本番起動（--importでdist/telemetry.jsを先読み）
```

Node.jsのバージョンは`.nvmrc`で22を指定している（`package.json`の`engines.node`も`>=22`）。

## テスト

ユニットテストと統合テストを設定ファイルレベルで分離している。

```bash
npm test              # jest.config.cjs: リポジトリをモックした高速なユニットテスト（*.test.ts）
npm run test:integration  # jest.integration.config.cjs: 実際のPostgresを使う統合テスト（*.integration.test.ts）
```

- ユニットテスト（`jest.config.cjs`）は`testPathIgnorePatterns`で`*.integration.test.ts`を除外している。ドメイン層・アプリケーション層のロジックをリポジトリのモックで高速に検証する。
- 統合テスト（`jest.integration.config.cjs`）は`*.integration.test.ts`のみを対象にする。Testcontainers（`@testcontainers/postgresql`）でDockerコンテナとして実Postgresを起動し、`src/infrastructure/db/migrations`のマイグレーションを流してから`DrizzleXxxRepository`を実際のSQLで検証する（`jest/integration/testDb.ts`）。実行にはDockerが起動している必要がある。
- e2eテスト（`presentation/routes/*.e2e.test.ts`）はFastifyの`app.inject()`でHTTPレイヤーごと検証する。ユニットテストの設定に含まれ`npm test`で実行される。

## マイグレーション（Drizzle Kit）

スキーマ定義は`src/infrastructure/db/schema.ts`（Drizzle ORM）。マイグレーションファイルは`src/infrastructure/db/migrations/`に生成される（`drizzle.config.ts`で`schema`/`out`を指定）。

```bash
npm run db:generate  # schema.tsの差分からマイグレーションSQLを生成
npm run db:migrate   # DATABASE_URLが指す先にマイグレーションを適用
```

マイグレーション番号`0007`/`0008`（`0007_grant_app_role.sql`/`0008_grant_looker_studio_readonly.sql`）は`drizzle-kit generate`によるスキーマ差分の自動生成ではなく、手書きのカスタムSQLファイル（Drizzle Kitの「空のマイグレーションファイルを作ってから中身を手で書く」運用に乗せたもの）。それぞれ本番Postgres（Neon）上の`mymovie_app`ロール（アプリ実行時が使う最小権限ロール、DDL権限なし）と`looker_studio_readonly`ロール（BIツール用の読み取り専用ロール、PII列を除外）へのGRANTを行う。どちらもロールが存在しない環境（ローカル/CI/統合テストの使い捨てPostgres）では`DO $$ IF EXISTS ... $$`で安全にスキップされる。

## 認証

メール/パスワードとOAuth（Google/GitHub）の両方に対応する。

- **メール/パスワード**: `POST /auth/register`・`POST /auth/login`（`presentation/routes/authRoutes.ts`）。パスワードは`argon2`でハッシュ化する。
- **OAuth**: `presentation/routes/googleAuthRoutes.ts`・`githubAuthRoutes.ts`が`arctic`ライブラリでGoogle/GitHubの認可コードフローを扱う。ログイン成功時にユーザー・アイデンティティを作成/紐付けし、`FRONTEND_URL`にリダイレクトする。
- **トークン方式**: ログイン成功時にアクセストークン（JWT、レスポンスボディで返す）とリフレッシュトークン（`refresh_token`という`httpOnly` Cookieで発行）を発行する。`jose`でJWTの署名・検証を行う（`application/shared/JwtService.ts`）。`POST /auth/refresh`でリフレッシュトークンからアクセストークンを再発行し、`POST /auth/logout`でセッションを失効させる。
- **保護ルート**: `presentation/middleware/authenticate.ts`の`makeAuthenticate(jwtService)`が生成するpreHandlerフックが`Authorization: Bearer <token>`を検証し、`request.userId`に詰める。本番用のフロントエンドとバックエンドはドメインが異なるクロスサイト構成のため、Cookieの`sameSite`は本番のみ`'none'`（`NODE_ENV === 'production'`で判定）にしている。

## テレメトリ

`src/telemetry.ts`でOpenTelemetry SDK（`@opentelemetry/sdk-node`）を初期化し、トレース・メトリクス・ログをOTLP（HTTP）で送信する。ベンダー固有APIではなく素のOpenTelemetry API（`@opentelemetry/api`等）で計装しているため、送信先（ローカルのotel-collector、New Relic等）を環境変数だけで切り替えられる。

- `dev`/`start`スクリプトはどちらも`--import ./src/telemetry.ts`（または`dist/telemetry.js`）でエントリポイントより前にSDKを読み込む。自動計装（`getNodeAutoInstrumentations`）はモジュールの読み込みをフックする方式のため、対象コードより後から読み込むと計装が効かない。
- `NEW_RELIC_LICENSE_KEY`が設定されていればNew Relic（OTLPエンドポイント）へ、未設定ならローカルの`otel-collector`（`docker-compose.yml`の`otel-collector`サービス、デフォルト`http://localhost:4318`）へ送信する。
- ESM（`import`文）で読み込まれたモジュール（自前のpinoロガー等）は`require-in-the-middle`ベースの自動計装だけでは計装されないため、`node:module`の`register('@opentelemetry/instrumentation/hook.mjs', ...)`でESM専用のローダーフックを別途登録している。
