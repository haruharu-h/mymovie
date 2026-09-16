export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    // errorHandler.ts のログにそのまま乗せる追加情報（例: { tmdbId }）。
    // ここに乗せた分だけログが増えるわけではない（1箇所に集約されたログが厚くなるだけ）
    readonly context?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}
