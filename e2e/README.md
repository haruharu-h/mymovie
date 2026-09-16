# e2e

Playwrightによる、実際のブラウザ操作を通したE2E（End-to-End）テスト。

`backend`のユニット/インテグレーションテスト（DBには実接続するが、TMDB等の外部APIはモック、
HTTPもFastifyのinject経由でブラウザを介さない）とは検証範囲が異なる。こちらは
「フロントエンド→バックエンド→DB→（実物の）外部API」までを、実際にブラウザでクリック・入力
しながら通しで検証する。その分実行は重く遅いため、本数を絞ってユーザーの中核的な導線だけを
カバーする方針。

## 前提条件

- Dockerが起動していること（`docker compose`でDB・backend・frontendをコンテナ起動するため）
- リポジトリルートに`.env`が存在すること（`DB_PASSWORD`・`JWT_SECRET`・`GOOGLE_CLIENT_ID`等、
  ルートの`docker-compose.yml`と同じ変数を使う。`docker compose -f ../docker-compose.e2e.yml`を
  `e2e/`から実行しても、Composeはコンポーズファイルの場所＝リポジトリルートを基準に`.env`を
  読むため、ルート直下の`.env`がそのまま使われる）
- `TMDB_READ_ACCESS_TOKEN`が有効であること（後述の通りテストは本物のTMDB
  APIを叩くため、キーが失効しているとテストも失敗する）

## 実行方法

```bash
npm run test:e2e
```

実体は`./run-e2e.sh`（`package.json`の`test:e2e`スクリプトが呼び出す）。

## ライフサイクル（`run-e2e.sh`の中身）

```bash
cd "$(dirname "$0")"
docker compose -f ../docker-compose.e2e.yml -p mymovie-e2e up -d --wait
trap 'docker compose -f ../docker-compose.e2e.yml -p mymovie-e2e down -v' EXIT
npx playwright test
```

1. `e2e/`に`cd`してから、リポジトリルートの`docker-compose.e2e.yml`をプロジェクト名
   `-p mymovie-e2e`で起動する。プロジェクト名を明示しているのは、通常の開発用スタック
   （`docker-compose.yml`、プロジェクト名は自動的にディレクトリ名`mymovieproject`になる）と
   コンテナ名・ネットワーク・ボリュームが衝突しないようにするため。これにより、開発用に
   `docker compose up`で立ち上げっぱなしのスタックがあっても、E2E用スタックは独立して並行起動
   できる
2. `--wait`でヘルスチェック（`db`の`pg_isready`等）が通ってからテストに進む
3. `trap ... EXIT`により、この後の`npx playwright test`が成功しても失敗しても、スクリプトが
   終了する際に必ず`down -v`（ボリュームごと削除）でスタックを破棄する。テスト失敗時に
   コンテナが残り続けて次回実行に影響する、という事故を防ぐ

## 使用スタック（`docker-compose.e2e.yml`）

開発用の`docker-compose.yml`とは別ファイル。OpenTelemetry関連（`otel-collector`・
`prometheus`・`grafana`・`jaeger`・`elasticsearch`）は含まず、E2Eの検証に必要な最小構成のみ。

| サービス | 内容 |
|---------|------|
| `db` | PostgreSQL 17。ホスト側`5433`番（開発用の`5432`と衝突しないようポートをずらしている） |
| `migrate` | `backend`イメージで`npm run db:migrate`を実行し、正常終了後に`backend`が起動する（`depends_on: condition: service_completed_successfully`） |
| `backend` | ホスト側`3001`番（開発用の`3000`と衝突回避） |
| `frontend` | ホスト側`5174`番（開発用の`5173`と衝突回避） |

DBは`mymovie_e2e`という別データベース名・専用ボリューム（`db_e2e_data`）を使うため、開発用DBの
データとも混ざらない。

## Playwright設定（`playwright.config.ts`)

- `baseURL: 'http://localhost:5174'`（上記`frontend`コンテナの公開ポート）
- `testDir: './tests'`
- `fullyParallel: false` / `workers: 1`（直列実行。テストがサインアップ等でDBに実データを
  作るため、並列化すると複数テストが同じ状態を取り合う恐れがある）
- `trace: 'retain-on-failure'`（失敗したテストのみPlaywrightのトレースを保持し、後から
  `npx playwright show-trace`で失敗時の操作を再生できる）
- ブラウザは`projects`未指定のため、Playwrightのデフォルト（Chromiumのみ）で実行される

## 現在のテストカバレッジ

`tests/user-journey.spec.ts`の1ファイル・1テストのみ。以下の一連の導線を通しで検証する。

1. `/signup`でメールアドレス・パスワード（確認用含む）を入力してサインアップし、`/`に
   リダイレクトされることを確認
2. 「+ 映画を登録」から`/movies/register`に遷移
3. タイトル欄に`Matrix`と入力し、TMDB検索結果（本物のTMDB API呼び出し）が表示されることを
   確認して先頭の候補を選択
4. スコアに`4.5`を入力して登録し、`/`にリダイレクトされることを確認
5. 登録した映画のタイトルがトップページの一覧に表示されることを確認

「サインアップ→映画登録（TMDB検索含む）→レビュー作成→一覧表示」という中核的な1本の
ユーザージャーニーのみをカバーしており、ログインやレビュー編集・削除、認可エラー等の
異常系はまだE2Eではカバーしていない。
