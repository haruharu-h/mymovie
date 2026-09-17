import { AppError } from '../shared/AppError.js'

export class Follow {
  constructor(
    readonly followerId: string,
    readonly followeeId: string,
    readonly createdAt: Date,
  ) {
    if (followerId === followeeId) {
      throw new AppError('自分自身をフォローできません', 400)
    }
  }
}
