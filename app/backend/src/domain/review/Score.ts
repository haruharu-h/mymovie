import { AppError } from '../shared/AppError.js'

export class Score {
  private constructor(readonly value: number) {}

  static create(value: number): Score {
    if (value < 0 || value > 5 || Math.abs(value - Math.round(value * 10) / 10) > 0.001) {
      throw new AppError('スコアは0.0〜5.0の0.1刻みで入力してください', 400)
    }
    return new Score(value)
  }

  static reconstruct(value: number): Score {
    return new Score(value)
  }
}
