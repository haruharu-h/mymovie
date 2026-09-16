import type { IFollowRepository } from '../../domain/follow/IFollowRepository.js'
import type { User } from '../../domain/user/User.js'

export class GetFollowees {
  constructor(private readonly followRepository: IFollowRepository) {}

  async execute(followerId: string): Promise<User[]> {
    return this.followRepository.findFolloweesByFollowerId(followerId)
  }
}
