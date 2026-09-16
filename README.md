# mymovie

観た映画を記録し、5段階評価でレビューを残すWebアプリ。既存のバニラJS製サービス（mymovie.jp）を、
DDD（ドメイン駆動設計）に基づいてReact + TypeScript（フロントエンド）とFastify + TypeScript
（バックエンド）で作り直したもの。個人の学習プロジェクトだが、実務レベルの設計・運用（DDD・
IaC・可観測性・負荷試験・CI/CD）を意図的に採用している。

## 機能

- TMDB（The Movie Database）で映画を検索して自分のライブラリに登録
- 5段階評価でのレビュー投稿・編集・削除
- レビュー一覧の並び替え（スコア順・公開日順・登録日順）
- ユーザー検索・フォロー
- プロフィール編集・アバター画像アップロード（EXIF除去+リサイズは非同期ワーカーが処理）
- メール/パスワード認証 + Google/GitHub OAuth

## 構成

モノレポ構成で、各ディレクトリが独立したパッケージになっている。詳細はそれぞれの
READMEを参照。

| ディレクトリ | 内容 |
|---|---|
| [`backend/`](backend/README.md) | Fastify + TypeScript製REST API。DDDレイヤードアーキテクチャ |
| [`frontend/`](frontend/README.md) | React + TypeScript + Vite製SPA |
| [`avatar-worker/`](avatar-worker/README.md) | アバター画像のEXIF除去+リサイズを行う非同期ワーカー（Cloud Run Functions） |
| [`e2e/`](e2e/README.md) | Playwrightによるブラウザ経由のE2Eテスト |
| [`k6/`](k6/README.md) | 負荷試験・性能検証スクリプト |
| [`otel/`](otel/README.md) | ローカル開発用オブザーバビリティスタックの設定（OpenTelemetry Collector・Prometheus・Grafana） |

GCPインフラ一式（Cloud Run/Firebase Hosting/Secret Manager/Neon/IAM/Workload Identity
Federation等）はTerraformで管理しているが、実際のGCPプロジェクトID等が直書きされているため
本リポジトリには含めていない（`infra/`はgit管理外）。

## 技術スタック

- **フロントエンド**: React 19, TypeScript, Vite, React Router, Tailwind CSS, shadcn/ui
- **バックエンド**: Fastify, TypeScript, Drizzle ORM, Zod, argon2（パスワードハッシュ）, jose（JWT）, arctic（OAuth）
- **DB**: PostgreSQL（ローカルはDocker、本番はNeonのサーバーレスPostgres）
- **可観測性**: OpenTelemetry（トレース・メトリクス・ログ）、ローカルはJaeger/Prometheus/Grafana/Elasticsearch、本番はNew Relic
- **インフラ**: GCP（Cloud Run, Firebase Hosting, Secret Manager, Artifact Registry, Cloud Run Functions）、Terraform、GitHub Actions（Workload Identity Federationで長期キー無しのCI/CD）
- **テスト**: Jest（ユニット・統合）、Playwright（E2E）、k6（負荷試験）

## 開発環境のセットアップ

clone後、最初に以下を実行する（実際のアカウント識別子・個人情報の誤コミットを防ぐ
pre-commitフックを有効化する）。

```bash
git config core.hooksPath .githooks
```

`gitleaks`（`brew install gitleaks`）がインストールされていれば、コミット前に自動で
チェックされる。ルールの定義は`.gitleaks.toml`。

## ローカルでの起動

Dockerが起動していれば、以下でフロントエンド・バックエンド・DB・オブザーバビリティスタックを
まとめて起動できる。

```bash
docker compose up
```

| サービス | URL |
|---|---|
| フロントエンド | http://localhost:5173 |
| バックエンドAPI | http://localhost:3000 |
| PostgreSQL | localhost:5432 |
| Grafana（トレース・メトリクス・ログの入口） | http://localhost:3001 |
| Jaeger UI | http://localhost:16686 |
| Prometheus UI | http://localhost:9090 |

初回はリポジトリルートに`.env`が必要（`DB_PASSWORD`・`JWT_SECRET`・OAuthクライアント情報・
`TMDB_READ_ACCESS_TOKEN`等）。各変数の詳細は[`backend/README.md`](backend/README.md)を参照。

E2Eテスト（`npm run test:e2e`、`e2e/`配下）は上記の開発用スタックとは別の、独立した
docker composeスタックを使う。詳細は[`e2e/README.md`](e2e/README.md)を参照。

## デプロイ

`main`ブランチへのマージをトリガーに、GitHub Actions（`.github/workflows/deploy.yml`）が
テスト → Dockerイメージビルド → DBマイグレーション → バックエンド（Cloud Run）・
フロントエンド（Firebase Hosting）への順にデプロイする。インフラ自体はTerraformで管理して
おり、CI/CDからGCPへの認証はWorkload Identity Federationで行うため長期のサービスアカウント
キーは発行していない。実際のGCPプロジェクトID等はGitHub Actionsのリポジトリ変数
（Settings > Secrets and variables > Actions > Variables）として設定しており、
ワークフローファイル自体には含まれていない。

アバターワーカー（`avatar-worker/`）とインフラの一部変更は、変更頻度が低いためCI/CDに
含めず手動デプロイにしている。詳細は`avatar-worker/README.md`参照。
