# avatar-worker

アバター画像のEXIF除去+リサイズを行う、GCSイベント駆動のワーカー（Cloud Run Functions）。

設計の詳細（なぜこの構成にしたか・構成図・未決定事項）は`docs/async-worker-architecture.md`と
`docs/decisions.md`参照。ここは「実際にどう動かすか」だけをまとめる。

## 何をするか

1. `avatars/{userId}`にファイルが書き込まれる（アップロード、または本ワーカー自身の上書き）
2. GCSの`object.finalize`イベントがEventarc経由でこの関数を起動する
3. 自己チェックガード: 対象オブジェクトのカスタムメタデータ（`mymovie-avatar-processed`）を
   確認し、既に処理済みなら何もせず終了する（無限ループ対策）
4. 未処理なら、`sharp`で192x192のJPEGにリサイズ+EXIF除去し、同じキーに上書きする

`backend`とは独立した別パッケージ（`e2e`と同じ位置づけ）。`backend`のコードは
一切変更されず、参照もしない。

## セットアップ

```bash
npm install
```

## テスト

```bash
npm test
```

`imageTransform.test.ts`・`selfCheckGuard.test.ts`はGCSに一切依存しない純粋なロジックのみを
実物（モック無し）で検証する。GCS I/Oを含む`processAvatar.ts`自体はユニットテストせず、
実際のバケットに対して手動で動作確認する方針（`docs/testing.md`「実クラウドのIAM権限の過不足」
参照。`GcsAvatarSigner`と同じ判断）。

## ビルド

```bash
npm run build
```

`src/*.ts` → `dist/*.js`にコンパイルする。**ローカルでのビルドはデプロイに必須ではない**
（`gcloud functions deploy`はソースをアップロードし、Cloud Build側で`npm run build`
（`package.json`の`build`スクリプト）を自動実行してからデプロイする）。ローカルの`npm run build`は
型チェック・手動での動作確認用。

## デプロイ

GitHub Actionsには追加しない。**ローカルから手動デプロイ**する
（`docs/decisions.md`「実行基盤はCloud Run Functions、デプロイはTerraformと同じくローカル手動」参照。
理由: 変更頻度がほぼゼロと想定されるため）。

```bash
gcloud functions deploy processAvatar \
  --gen2 \
  --runtime=nodejs22 \
  --region=us-central1 \
  --source=. \
  --entry-point=processAvatar \
  --trigger-bucket=<project-id>-avatars \
  --trigger-location=us-central1 \
  --service-account=<runtime-service-account>@<project-id>.iam.gserviceaccount.com \
  --trigger-service-account=<runtime-service-account>@<project-id>.iam.gserviceaccount.com \
  --build-service-account=projects/<project-id>/serviceAccounts/<build-service-account>@<project-id>.iam.gserviceaccount.com \
  --project=<project-id> \
  --memory=<memory> \
  --timeout=<timeout> \
  --max-instances=<max-instances> \
  --retry
```

`--retry`も必須（省略すると`RETRY_POLICY_DO_NOT_RETRY`、つまり失敗しても一切再試行されない
設定になる。自己チェックガードにより再試行は安全なので、GCS一時障害等からの自動復旧を
優先する。CodeRabbit指摘で発覚: 実際のデプロイ値がこのフラグ無しの状態だったため、
`docs/async-worker-architecture.md`の「再試行上限に達した場合」という記述と食い違っていた）。

`--build-service-account`は必須（省略するとCloud Buildが暗黙にプロジェクトのデフォルト
Compute Engine SA、つまり広い権限を持つアカウントを使ってしまう。詳細:
`docs/decisions.md`「`gcloud functions deploy`のビルド実行専用サービスアカウントを新設」）。

`--trigger-service-account`も明示する。`gcloud functions deploy --help`には「未指定時は
プロジェクトのデフォルトCompute Engine SAを使う」と書かれているが、実機で確認した限り
未指定でも`--service-account`と同じ値が使われていた（実際に`gcloud pubsub subscriptions
describe`でpushサブスクリプションのOIDC発行元を確認済み）。ただしこれはドキュメント化
されていない挙動に依存することになるため、将来のgcloud SDKやGCP側の挙動変更で
静かに壊れるリスクがある。デフォルト任せにせず明示する（CLAUDE.md「土台となる設定は
意図して選ぶ」参照）。

サービスアカウント（ランタイム用・ビルド用の両方）・GCSバケットIAM・必要なAPI有効化は
Terraformで管理している（インフラのTerraform構成自体は本リポジトリには含めていない。
`terraform apply`を先に実行しておくこと）。
デプロイ手段自体（このコマンドの実行）はTerraformで自動化していないが、**関数本体
（`google_cloudfunctions2_function`）は`terraform import`でTerraform管理下に取り込み済み**
なので、再デプロイ後は`terraform plan`で設定差分（意図しない変更）が無いか確認できる
（`build_config.source.storage_source.generation`は毎回変わる無害な値のためignore対象）。

### 初回デプロイ時にハマった点（同じ構成を再現するときのメモ）

初回デプロイ時、以下の順番でエラーにぶつかった。2回目以降のデプロイでは通常発生しない
（権限はTerraform側に反映済みのため）が、記録として残す。

1. **`Permission denied while using the Eventarc Service Agent`** —
   `eventarc.googleapis.com`を有効化した直後は、サービスエージェントへの権限反映に
   数分かかることがある。数分待って再実行すれば解消する
2. **`Permission 'eventarc.events.receiveEvent' denied`** — ワーカーのサービスアカウントに
   `roles/eventarc.eventReceiver`（プロジェクト単位）が必要。トリガー単位には絞れない
3. **`The request was not authenticated`**（Cloud Runのログにwarningとして出る）—
   EventarcがPub/Sub経由でCloud Run（Cloud Run Functionsの実体）へpush配信する際、
   配信元（ワーカーのSA）に対象サービスへの`roles/run.invoker`が必要。プロジェクト全体ではなく、
   `gcloud run services add-iam-policy-binding`でサービス単位に絞って付与する
4. **`.gcloudignore`で`src/`と`tsconfig.json`を除外してビルド失敗** —
   Cloud Build側が`package.json`の`build`スクリプト（`tsc`）を自動実行するため、
   コンパイル対象のソースとtsconfigは除外してはいけない。除外してよいのは
   `node_modules/`・`dist/`（どちらもビルド時に再生成される）・テストファイルのみ

## ローカルでの動作確認

実際のGCSバケットに対して、関数を経由せず直接ロジックを呼んで確認できる（デプロイ不要）。

```bash
npm run build
node -e "
import('./dist/processAvatar.js').then(async ({ processAvatarObject }) => {
  const { Storage } = await import('@google-cloud/storage')
  const storage = new Storage()
  await processAvatarObject(storage, { bucket: '<project-id>-avatars', name: 'avatars/<test-user-id>' })
})
"
```

実際にGCP上のEventarcトリガー経由で確認する場合は、対象バケットにファイルをアップロードし
（`gcloud storage cp`等）、Cloud Runのログを確認する。

```bash
gcloud logging read 'resource.type="cloud_run_revision" resource.labels.service_name="processavatar"' \
  --project=<project-id> --limit=20 --freshness=5m
```
