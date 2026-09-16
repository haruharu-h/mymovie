import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../buildApp.js'
import { makeAuthenticate } from '../middleware/authenticate.js'
import { FollowUser } from '../../application/follow/FollowUser.js'
import { UnfollowUser } from '../../application/follow/UnfollowUser.js'
import { GetFollowees } from '../../application/follow/GetFollowees.js'
import { User } from '../../domain/user/User.js'
import type { IFollowRepository } from '../../domain/follow/IFollowRepository.js'
import type { JwtService } from '../../application/shared/JwtService.js'

describe('followRoutes (E2E)', () => {
  let followRepository: jest.Mocked<IFollowRepository>
  let jwtService: jest.Mocked<JwtService>
  let app: FastifyInstance

  const authHeader = { authorization: 'Bearer valid-token' }
  const authenticatedUserId = 'user-1'

  beforeEach(() => {
    followRepository = {
      save: jest.fn<IFollowRepository['save']>(),
      delete: jest.fn<IFollowRepository['delete']>(),
      findFolloweesByFollowerId: jest.fn<IFollowRepository['findFolloweesByFollowerId']>(),
    }
    jwtService = {
      generateAccessToken: jest.fn<JwtService['generateAccessToken']>(),
      verifyAccessToken: jest.fn<JwtService['verifyAccessToken']>(),
      hashToken: jest.fn<JwtService['hashToken']>(),
    } as unknown as jest.Mocked<JwtService>
    jwtService.verifyAccessToken.mockResolvedValue({ userId: authenticatedUserId })

    app = buildApp(
      {
        follow: {
          followUser: new FollowUser(followRepository),
          unfollowUser: new UnfollowUser(followRepository),
          getFollowees: new GetFollowees(followRepository),
          authenticate: makeAuthenticate(jwtService),
        },
      },
      { logger: false, forceFlushTelemetry: false },
    )
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /follows', () => {
    it('201 で保存される', async () => {
      followRepository.save.mockResolvedValue(undefined)

      const res = await app.inject({
        method: 'POST',
        url: '/follows',
        headers: authHeader,
        payload: { followeeId: 'user-2' },
      })

      expect(res.statusCode).toBe(201)
      const savedFollow = followRepository.save.mock.calls[0][0]
      expect(savedFollow.followerId).toBe(authenticatedUserId)
      expect(savedFollow.followeeId).toBe('user-2')
    })

    it('followeeIdが無ければ 400（Zodスキーマによるバリデーション）', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/follows',
        headers: authHeader,
        payload: {},
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ message: 'リクエストの形式が正しくありません' })
      expect(followRepository.save).not.toHaveBeenCalled()
    })

    it('自分自身をフォローしようとすると 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/follows',
        headers: authHeader,
        payload: { followeeId: authenticatedUserId },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ message: '自分自身をフォローできません' })
      expect(followRepository.save).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /follows/:followeeId', () => {
    it('204 で削除される', async () => {
      followRepository.delete.mockResolvedValue(undefined)

      const res = await app.inject({
        method: 'DELETE',
        url: '/follows/user-2',
        headers: authHeader,
      })

      expect(res.statusCode).toBe(204)
      expect(followRepository.delete).toHaveBeenCalledWith(authenticatedUserId, 'user-2')
    })
  })

  describe('GET /follows', () => {
    it('email・snsUrl を含まない形でフォロー中ユーザーを返す', async () => {
      const followee = new User('user-2', 'Bob', 'bob@example.com', '2000-01-01', 'https://x.com/bob', null, new Date())
      followRepository.findFolloweesByFollowerId.mockResolvedValue([followee])

      const res = await app.inject({ method: 'GET', url: '/follows', headers: authHeader })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        users: [{ id: 'user-2', name: 'Bob', birthdate: '2000-01-01' }],
      })
    })
  })
})
