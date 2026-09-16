// 無限ループ対策の自己チェックガード。ワーカーが処理済みオブジェクトに上書きすると
// そのオブジェクト自身への書き込みでEventarcが再度発火するため、自分が既に書き込んだ
// ものかをカスタムメタデータの印で判定し、該当すれば即終了する
// （docs/decisions.md「決定: トリガー方式はEventarcに変更」参照）
export const PROCESSED_METADATA_KEY = 'mymovie-avatar-processed'

// GCSのカスタムメタデータは`@google-cloud/storage`の型上string以外の値も許容するが
// （実際にはGCS自体は常に文字列として保存する）、呼び出し側の型を素直に受け取る
export function isAlreadyProcessed(metadata: Record<string, unknown> | undefined): boolean {
  return metadata?.[PROCESSED_METADATA_KEY] === 'true'
}
