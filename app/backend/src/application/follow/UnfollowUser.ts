import type { IFollowRepository } from '../../domain/follow/IFollowRepository.js'

export class UnfollowUser {
  constructor(private readonly followRepository: IFollowRepository) {}

  async execute(followerId: string, followeeId: string): Promise<void> {
    await this.followRepository.delete(followerId, followeeId)
  }
}
