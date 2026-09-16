# otel

ローカル開発用オブザーバビリティスタックの設定ファイル集。**アプリケーションコードはここには無い**。
`docker-compose.yml`から各コンテナにマウントされる設定（OpenTelemetry Collector・Prometheus・
Grafanaのプロビジョニング）だけを置いている。

## 何をしているか

`backend`が出すトレース・メトリクス・ログを OTLP で OpenTelemetry Collector に送り、
Collector がそれぞれ別のバックエンドに振り分け、最終的に Grafana でまとめて見る、という構成。

```
backend --OTLP(gRPC:4317 / HTTP:4318)--> otel-collector
                                            ├─ traces  --> jaeger (保存先はElasticsearch)
                                            ├─ metrics --> :8889で公開 <-- prometheusがスクレイプ
                                            └─ logs    --> elasticsearch (logs-mymovie-otel)

grafana --> prometheus (メトリクス) / jaeger (トレース) / elasticsearch (ログ) を横断的に参照
```

### otel-collector-config.yaml

`otlp`レシーバーがgRPC(4317)とHTTP(4318)の両方で受信し、3種類のpipelineに分かれる。

- **traces**: `otlp/jaeger`エクスポーターで`jaeger:4317`に転送（Collector自身はJaegerのUIやストレージを
  持たない。あくまで中継役）
- **metrics**: `prometheus`エクスポーターが`0.0.0.0:8889`にPrometheus形式で公開する。Collector自身は
  Prometheusにpushしない。Prometheus側からpull（スクレイプ）される待ち受け口を開けているだけ
- **logs**: `elasticsearch/logs`エクスポーターで`http://elasticsearch:9200`の`logs-mymovie-otel`
  データストリームに書き込む。Jaegerが使っているのと同じElasticsearchインスタンスを、ログ保存用にも
  使い回している

`debug`エクスポーター（`traces`パイプラインにのみ追加）は、Collectorコンテナの標準出力に受信内容を
そのまま出す。動作確認用で、実際のバックエンドではない。

**注意**: `logs_index: logs-mymovie-otel`は、事前にElasticsearch側で`data_stream`対応のindex
templateを作成しておくことが前提（OTel Elasticsearch Exporterのデフォルトのmapping modeは
`require_data_stream: true`のため）。このindex template自体はこのリポジトリに定義ファイルとして
存在しない（手動でElasticsearchに作成する運用）。初回起動時にログだけが弾かれる場合は、まずこの
index templateの有無を疑うこと。

### prometheus.yml

スクレイプ対象は`otel-collector:8889`の1つだけ。つまりPrometheusは`backend`を直接見ておらず、
必ずCollector経由でメトリクスを取得する。

### grafana/provisioning/datasources/datasource.yml

Grafana起動時に自動登録される3つのデータソース。

| 名前 | type | URL | 用途 |
|---|---|---|---|
| Prometheus | prometheus | `http://prometheus:9090` | メトリクス（デフォルトデータソース） |
| Jaeger | jaeger | `http://jaeger:16686` | トレース。ElasticsearchではなくJaeger自身のクエリAPIを直接見に行く |
| Elasticsearch-Logs | elasticsearch | `http://elasticsearch:9200` | ログ。`logs-mymovie-otel`データストリームを`@timestamp`基準で参照 |

## 起動して見る場所

`docker compose up`（リポジトリルートの`docker-compose.yml`）で起動後、以下を開く。

| サービス | URL | 補足 |
|---|---|---|
| Grafana | http://localhost:3001 | ここが基本の入り口。ホスト側ポートが3001なのは、backendが既に3000を使っているため（コンテナ内部は3000のまま） |
| Jaeger UI | http://localhost:16686 | トレースを個別に深掘りしたいとき |
| Prometheus UI | http://localhost:9090 | PromQLを直接叩きたいとき |
| Elasticsearch | http://localhost:9200 | ログの生データやindex templateの確認用（`curl`でのデバッグ向け） |
| otel-collectorのPrometheusエクスポーター | http://localhost:8889/metrics | Collectorが何を公開しているかを直接確認したいとき |

`otel-collector`は`depends_on`で`jaeger`と`elasticsearch`（healthy）を待ち、`backend`は
`otel-collector`の起動（`service_started`。healthcheck無しのため起動完了を待つのみ）を待ってから
起動する。`backend`の`OTEL_EXPORTER_OTLP_ENDPOINT`は`http://otel-collector:4318`（OTLP/HTTP）を指す。

## 適用範囲

このオブザーバビリティスタック（otel-collector / prometheus / grafana / elasticsearch / jaeger）は
`docker-compose.yml`（通常のローカル開発用）にのみ存在する。E2Eテスト用の`docker-compose.e2e.yml`には
これらのサービスが一切含まれない（db・migrate・backend・frontendのみの最小構成）。つまりここは
**ローカル開発時の可観測性のための設定であり、本番環境の構成をそのまま表すものではない**
（例: Elasticsearchは`xpack.security.enabled: false`で認証無効化・シングルノード構成にしている）。
