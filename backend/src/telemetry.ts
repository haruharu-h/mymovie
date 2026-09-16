// OTel SDKの初期化。--import でエントリポイントより前に読み込ませる必要がある
// （自動計装はモジュールのrequire/importをフックする方式のため、対象より後から読み込むと計装が効かない）。
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { FastifyOtelInstrumentation } from '@fastify/otel'

// エクスポート失敗等のSDK内部エラーはデフォルトでは握りつぶされるため、診断ロガーで可視化する。
// ERRORのみだと「キューが溢れてspanを破棄した」等のWARNレベルの警告を取り逃すためWARNまで含める。
// require-in-the-middle（CJSのrequireフック）はESM（import文）で読み込むパッケージには
// 効かないため、自前でimportするモジュール（infrastructure/logger.ts等）には別途このフックが要る
// （詳細: docs/decisions.md「ESM importの計装漏れ」）
register('@opentelemetry/instrumentation/hook.mjs', { parentURL: pathToFileURL('./') })

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN)

// New Relicへ送る場合は認証ヘッダー（api-key）が必要。ローカルのotel-collectorは無認証で受け付ける
const newRelicLicenseKey = process.env.NEW_RELIC_LICENSE_KEY
const otlpEndpoint = newRelicLicenseKey
  ? process.env.NEW_RELIC_OTLP_ENDPOINT ?? 'https://otlp.nr-data.net:4318'
  : process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318'
const otlpHeaders = newRelicLicenseKey ? { 'api-key': newRelicLicenseKey } : undefined

// spanProcessor/metricReader/logRecordProcessorへの参照をNodeSDKの外に保持しておく。
// NodeSDKはこれらを内部に隠し持つだけで外から取得する手段が無いため、forceFlush()（下記）を
// 呼べるようにするには自分で組み立てて渡す必要がある
const spanProcessor = new BatchSpanProcessor(
  new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces`, headers: otlpHeaders }),
)
const metricReader = new PeriodicExportingMetricReader({
  exporter: new OTLPMetricExporter({ url: `${otlpEndpoint}/v1/metrics`, headers: otlpHeaders }),
})
const logRecordProcessor = new BatchLogRecordProcessor({
  exporter: new OTLPLogExporter({ url: `${otlpEndpoint}/v1/logs`, headers: otlpHeaders }),
})

const sdk = new NodeSDK({
  serviceName: 'mymovie-backend',
  spanProcessors: [spanProcessor],
  metricReaders: [metricReader],
  logRecordProcessors: [logRecordProcessor],
  instrumentations: [
    getNodeAutoInstrumentations(),
    new FastifyOtelInstrumentation({ registerOnInitialization: true }),
  ],
})

sdk.start()

// Cloud Runの`cpu_idle: true`はレスポンスを返した瞬間からCPUを凍結するため、タイマー駆動の
// バッチ送信（このままだと数十秒後に発火する）がCPU凍結に巻き込まれてタイムアウト・欠落する
// ことがある（docs/decisions.md「New RelicのTransactionsページにデータが無かった原因」）。
// buildApp.tsのonResponseフックからリクエスト完了ごとに呼び、CPUが確実に割り当てられている
// うちに送信を試みる。1系統が失敗しても他をブロックしないようallSettledで待つ
export async function forceFlushTelemetry(): Promise<void> {
  await Promise.allSettled([
    spanProcessor.forceFlush(),
    metricReader.forceFlush(),
    logRecordProcessor.forceFlush(),
  ])
}

// プロセス終了時にエクスポーターをflushする（無いとバッファ内のspanが失われる）
process.on('SIGTERM', () => sdk.shutdown().finally(() => process.exit(0)))
process.on('SIGINT', () => sdk.shutdown().finally(() => process.exit(0)))
