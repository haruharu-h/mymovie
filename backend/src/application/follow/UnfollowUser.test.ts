import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { UnfollowUser } from './UnfollowUser.js'
import type { IFollowRepository } from '../../domain/follow/IFollowRepository.js'

describe('UnfollowUser', () => {
  let followRepository: jest.Mocked<IFollowRepository>
  let unfollowUser: UnfollowUser

  beforeEach(() => {
    followRepository = {
      save: jest.fn<IFollowRepository['save']>(),
      delete: jest.fn<IFollowRepository['delete']>(),
      findFolloweesByFollowerId: jest.fn<IFollowRepository['findFolloweesByFollowerId']>(),
    }
    unfollowUser = new UnfollowUser(followRepository)
  })

  it('follower/followee を指定して delete を呼ぶ', async () => {
    await unfollowUser.execute('user-1', 'user-2')
    expect(followRepository.delete).toHaveBeenCalledWith('user-1', 'user-2')
  })
})
