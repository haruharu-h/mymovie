// OTel SDKの初期化。--import でエントリポイントより前に読み込ませる必要がある
// （自動計装はモジュールのrequire/importをフックする方式のため、対象より後から読み込むと計装が効かない）。
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { FastifyOtelInstrumentation } from '@fastify/otel'

// エクスポート失敗等のSDK内部エラーはデフォルトでは握りつぶされるため、診断ロガーで可視化する
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR)

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318'

const sdk = new NodeSDK({
  serviceName: 'mymovie-backend',
  traceExporter: new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: `${otlpEndpoint}/v1/metrics` }),
  }),
  logRecordProcessors: [
    new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ url: `${otlpEndpoint}/v1/logs` }) }),
  ],
  instrumentations: [
    getNodeAutoInstrumentations(),
    new FastifyOtelInstrumentation({ registerOnInitialization: true }),
  ],
})

sdk.start()

// プロセス終了時にエクスポーターをflushする（無いとバッファ内のspanが失われる）
process.on('SIGTERM', () => sdk.shutdown().finally(() => process.exit(0)))
process.on('SIGINT', () => sdk.shutdown().finally(() => process.exit(0)))
