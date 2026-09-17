import { Follow } from '../../domain/follow/Follow.js'
import type { IFollowRepository } from '../../domain/follow/IFollowRepository.js'

export class FollowUser {
  constructor(private readonly followRepository: IFollowRepository) {}

  async execute(followerId: string, followeeId: string): Promise<void> {
    const follow = new Follow(followerId, followeeId, new Date())
    await this.followRepository.save(follow)
  }
}
