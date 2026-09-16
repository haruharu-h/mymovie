import { Follow } from '../../domain/follow/Follow.js'
import { AppError } from '../../domain/shared/AppError.js'
import type { IFollowRepository } from '../../domain/follow/IFollowRepository.js'

export class FollowUser {
  constructor(private readonly followRepository: IFollowRepository) {}

  async execute(followerId: string, followeeId: string): Promise<void> {
    if (followerId === followeeId) {
      throw new AppError('自分自身をフォローできません', 400)
    }

    const follow = new Follow(followerId, followeeId, new Date())
    await this.followRepository.save(follow)
  }
}
