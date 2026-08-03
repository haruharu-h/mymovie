import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { GetFollowees } from './GetFollowees.js'
import type { IFollowRepository } from '../../domain/follow/IFollowRepository.js'
import type { User } from '../../domain/user/User.js'

describe('GetFollowees', () => {
  let followRepository: jest.Mocked<IFollowRepository>
  let getFollowees: GetFollowees

  beforeEach(() => {
    followRepository = {
      save: jest.fn<IFollowRepository['save']>(),
      delete: jest.fn<IFollowRepository['delete']>(),
      findFolloweesByFollowerId: jest.fn<IFollowRepository['findFolloweesByFollowerId']>(),
    }
    getFollowees = new GetFollowees(followRepository)
  })

  it('followerId でフォロー中ユーザーを取得し、結果をそのまま返す', async () => {
    const users = [] as User[]
    followRepository.findFolloweesByFollowerId.mockResolvedValue(users)

    const result = await getFollowees.execute('user-1')

    expect(followRepository.findFolloweesByFollowerId).toHaveBeenCalledWith('user-1')
    expect(result).toBe(users)
  })
})
