import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { FollowUser } from './FollowUser.js'
import { AppError } from '../../domain/shared/AppError.js'
import type { IFollowRepository } from '../../domain/follow/IFollowRepository.js'

describe('FollowUser', () => {
  let followRepository: jest.Mocked<IFollowRepository>
  let followUser: FollowUser

  beforeEach(() => {
    followRepository = {
      save: jest.fn<IFollowRepository['save']>(),
      delete: jest.fn<IFollowRepository['delete']>(),
      findFolloweesByFollowerId: jest.fn<IFollowRepository['findFolloweesByFollowerId']>(),
    }
    followUser = new FollowUser(followRepository)
  })

  it('自分自身をフォローしようとすると AppError(400)、保存しない', async () => {
    expect.assertions(3)
    try {
      await followUser.execute('user-1', 'user-1')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(400)
    }
    expect(followRepository.save).not.toHaveBeenCalled()
  })

  it('他人をフォローすると Follow を保存する', async () => {
    await followUser.execute('user-1', 'user-2')

    expect(followRepository.save).toHaveBeenCalledTimes(1)
    const saved = followRepository.save.mock.calls[0][0]
    expect(saved.followerId).toBe('user-1')
    expect(saved.followeeId).toBe('user-2')
  })
})
