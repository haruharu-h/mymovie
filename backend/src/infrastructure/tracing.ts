import { trace } from '@opentelemetry/api'

// 現在アクティブなspanに属性を追加する。OTel未設定（テスト実行中など）でも
// getActiveSpan()はundefinedを返すだけで安全なため、movieRepositoryのような
// DI・インターフェース化は不要（docs/architecture.md「テレメトリ設計」参照）
export function setSpanAttribute(key: string, value: string | number | boolean): void {
  trace.getActiveSpan()?.setAttribute(key, value)
}
