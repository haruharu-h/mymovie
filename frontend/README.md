# frontend

mymovie（映画レビュー管理アプリ）のフロントエンド。React + TypeScript + Viteで構成する。

## 何をするアプリか

観た映画を記録し、5段階評価でレビューを残すためのWebアプリ。TMDB（The Movie Database）で映画を検索して自分のライブラリに登録し、レビュー一覧の閲覧・投稿・編集・削除、他ユーザーのフォロー、プロフィール確認ができる。バックエンド（`../backend`、Fastify + TypeScript）とは別リポジトリ構成ではなくモノレポ内の別パッケージで、REST API経由で通信する。

## 技術スタック

- **React 19** + **TypeScript** + **Vite**（ビルドツール。`@vitejs/plugin-react`でFast Refresh）
- **React Router v8**（`createBrowserRouter`によるルーティング。`src/routes/router.tsx`）
- **Tailwind CSS v4**（`@tailwindcss/vite`プラグイン経由。設定ファイルは持たず`src/index.css`にCSSベースの設定を書く方式）
- **shadcn/ui**（`components.json`でセットアップ済み。npmパッケージとしてインストールするUIライブラリではなく、CLIでコンポーネントのソースコードを`src/components/ui/`配下に生成してリポジトリに取り込む方式。そのため`node_modules`ではなく自分のコードとして存在し、自由に編集できる。現時点ではコンポーネントはまだ生成しておらず、`class-variance-authority`・`clsx`・`tailwind-merge`・`lucide-react`など前提となる依存関係のみ入っている状態）
- データフェッチは現状**TanStack Queryなどのライブラリを使わず**、`useState`/`useEffect`と`src/lib/services/*.ts`の素朴な組み合わせで行っている

## セットアップ・起動

### リポジトリ全体をdocker composeで起動する（推奨）

ルートの`docker-compose.yml`が`frontend`・`backend`・DB（Postgres）・OpenTelemetry収集基盤をまとめて起動する。frontend単体で完結する変更以外（バックエンドAPIと合わせて確認したい場合など）はこちらを使う。

```bash
# リポジトリルートで
docker compose up
```

frontendコンテナは`http://localhost:5173`で起動し、ホストの`./frontend`をボリュームマウントしているためソース変更はそのままHMRに反映される。`VITE_BACKEND_URL=http://localhost:3000`が環境変数として渡される。

### frontend単体で起動する

依存関係の変更やUIだけを素早く確認したい場合は、Node.js 22以上がインストールされていればfrontend単体でも動く。

```bash
npm install
npm run dev
```

`vite.config.ts`の`server.proxy`が`/api`宛のリクエストを`http://backend:3000`（docker composeのサービス名）に転送する設定になっているため、バックエンドをdocker composeで起動していない状態でfrontend単体を`npm run dev`しただけではAPI呼び出しは失敗する。バックエンドも合わせて必要な場合は先にdocker composeでbackendだけ起動しておくか、両方composeで起動する。

### ビルド・プレビュー・Lint

```bash
npm run build    # tsc -b（型チェック）してから vite build。dist/に出力
npm run preview  # ビルド済みdistをローカルで配信して確認
npm run lint     # oxlint
```

Lintには ESLint ではなく **oxlint**（Rust製）を使っている。設定は`.oxlintrc.json`にあり、`react`・`typescript`・`oxc`プラグインを有効化し、`react/rules-of-hooks`をerror、`react/only-export-components`をwarnにしている。

TypeScriptは`tsconfig.json`から`tsconfig.app.json`（`src/`配下のアプリコード用）と`tsconfig.node.json`（`vite.config.ts`用）に分離する、Vite標準の構成。パスエイリアス`@/*` → `./src/*`を両方（`tsconfig.app.json`とVite側の`resolve.alias`）に設定している。

## ページ構成・ルーティング

`src/routes/router.tsx`で`createBrowserRouter`を使い、各ルートを`Layout`（共通レイアウト）と`ProtectedRoute`（認証必須ページのガード）でラップして組み立てている。

| パス | ページ | 認証 |
|---|---|---|
| `/`, `/reviews` | `ReviewsPage`（レビュー一覧） | 必須 |
| `/movies/:tmdbId` | `MovieDetailPage`（映画詳細） | 必須 |
| `/movies/register` | `MovieRegisterPage`（TMDB検索から映画登録） | 必須 |
| `/users/:userId` | `UserPage`（他ユーザーのプロフィール） | 不要 |
| `/following` | `FollowingPage`（フォロー中一覧） | 必須 |
| `/search` | `SearchPage` | 必須 |
| `/profile` | `ProfilePage`（自分のプロフィール） | 必須 |
| `/signin`, `/signup` | ログイン・新規登録 | - |
| `/auth/callback` | `AuthCallbackPage`（OAuthリダイレクト後の中継） | - |
| `/privacy-policy`, `/terms` | 静的ページ | - |
| `*` | `NotFoundPage` | - |

## 認証まわり

JWTベースの認証で、アクセストークンとリフレッシュトークンを役割分担させている。

- **アクセストークン**: `src/lib/tokenStore.ts`のモジュールスコープ変数に保持するのみで、`localStorage`等の永続化はしない。XSSでJSが乗っ取られない限り読み出せない代わりに、ページをリロードすると消える
- **リフレッシュトークン**: `httpOnly`のCookieとしてバックエンドが発行する想定（フロントのJSからは触れない）。`fetch`に毎回`credentials: 'include'`を付けてブラウザにCookieを送らせている
- アプリ起動時（`AuthContext`の`useEffect`）に`POST /api/auth/refresh`をCookie付きで叩き、有効なリフレッシュトークンがあればアクセストークンを復元する。これによりリロードしてもログイン状態が保たれる
- `src/lib/apiClient.ts`の`apiClient()`はAPI呼び出し前にアクセストークンのexpをデコードして期限切れ間近（30秒前）なら自動でリフレッシュしてから本来のリクエストを送る
- ルーティングの認可は`ProtectedRoute`（`src/components/ProtectedRoute.tsx`）が`useAuth().accessToken`の有無で判定し、未ログインなら`/signin`にリダイレクトする
- **メール・パスワード認証**に加え、**Google／GitHub OAuth**にも対応。`SignInPage`のOAuthボタンは`<a href="${VITE_BACKEND_URL}/auth/google">`のような素のリンクで、ブラウザを直接バックエンドの認可エンドポイントへ遷移させる（fetchではなくページ遷移である点がポイント）。バックエンド側でOAuthプロバイダとのやり取りを完結させ、成功後に`/auth/callback`へリダイレクトし、`AuthCallbackPage`が`refresh()`を呼んでCookie経由でアクセストークンを取得する

## API呼び出し層とdev/prod差分の吸収

`src/lib/services/*.ts`（`movieService.ts`・`reviewService.ts`・`followService.ts`・`userService.ts`）がドメインごとのAPI呼び出しをまとめ、内部で共通の`apiClient()`（`src/lib/apiClient.ts`）を呼ぶ。呼び出し側は`res.ok`のチェックや`res.json()`を意識せず、失敗時は`ApiError`（`statusCode`付き）がthrowされる前提でtry/catchすればよい。

開発環境と本番環境でバックエンドへのパス解決が異なるため、`resolveApiPath()`で吸収している。

```ts
// frontend/src/lib/apiClient.ts
export function resolveApiPath(path: string): string {
  if (import.meta.env.DEV) return path
  return `${import.meta.env.VITE_BACKEND_URL}${path.replace(/^\/api/, '')}`
}
```

- **開発時**: Viteのdevサーバーが`/api`宛のリクエストをバックエンドにプロキシする（`vite.config.ts`の`server.proxy`）ため、フロントは相対パス（`/api/...`）のままで届く
- **本番時**: フロントエンド（Firebase Hosting）とバックエンド（Cloud Run）が別ドメインにデプロイされ、プロキシが存在しないため、`VITE_BACKEND_URL`環境変数からバックエンドの絶対URLを組み立てる必要がある。この時パスの先頭`/api`は除去する（バックエンド側のルーティングに`/api`プレフィックスが無いため）

## デプロイ

Firebase Hostingにデプロイする。設定は`firebase.json`（`dist`を公開、SPAのためすべてのパスを`index.html`にrewrite）と`.firebaserc`（プロジェクトIDを指定。実際の値が入るファイルのためgit管理外。`.firebaserc.example`をコピーして使う）。

```bash
npm run build
firebase deploy --only hosting
```
