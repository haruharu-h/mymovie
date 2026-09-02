import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../buildApp.js'
import { makeAuthenticate } from '../middleware/authenticate.js'
import { GetCurrentUser } from '../../application/user/GetCurrentUser.js'
import { SearchUsers } from '../../application/user/SearchUsers.js'
import { UpdateUserProfile } from '../../application/user/UpdateUserProfile.js'
import { RequestAvatarUploadUrl } from '../../application/user/RequestAvatarUploadUrl.js'
import { UpdateUserAvatar } from '../../application/user/UpdateUserAvatar.js'
import { User } from '../../domain/user/User.js'
import type { IUserRepository } from '../../domain/user/IUserRepository.js'
import type { JwtService } from '../../application/shared/JwtService.js'
import type { GcsAvatarSigner } from '../../infrastructure/external/GcsAvatarSigner.js'

describe('userRoutes (E2E)', () => {
  let userRepository: jest.Mocked<IUserRepository>
  let jwtService: jest.Mocked<JwtService>
  let gcsAvatarSigner: jest.Mocked<GcsAvatarSigner>
  let app: FastifyInstance

  const authHeader = { authorization: 'Bearer valid-token' }
  const authenticatedUserId = 'user-1'

  beforeEach(() => {
    userRepository = {
      save: jest.fn<IUserRepository['save']>(),
      findById: jest.fn<IUserRepository['findById']>(),
      findByEmail: jest.fn<IUserRepository['findByEmail']>(),
      findByName: jest.fn<IUserRepository['findByName']>(),
      updateProfile: jest.fn<IUserRepository['updateProfile']>(),
      updateAvatarUrl: jest.fn<IUserRepository['updateAvatarUrl']>(),
    }
    jwtService = {
      generateAccessToken: jest.fn<JwtService['generateAccessToken']>(),
      verifyAccessToken: jest.fn<JwtService['verifyAccessToken']>(),
      hashToken: jest.fn<JwtService['hashToken']>(),
    } as unknown as jest.Mocked<JwtService>
    jwtService.verifyAccessToken.mockResolvedValue({ userId: authenticatedUserId })
    gcsAvatarSigner = {
      createUploadPolicy: jest.fn<GcsAvatarSigner['createUploadPolicy']>(),
      getPublicUrl: jest.fn<GcsAvatarSigner['getPublicUrl']>(),
      objectExists: jest.fn<GcsAvatarSigner['objectExists']>(),
    } as unknown as jest.Mocked<GcsAvatarSigner>

    app = buildApp(
      {
        user: {
          getCurrentUser: new GetCurrentUser(userRepository),
          searchUsers: new SearchUsers(userRepository),
          updateUserProfile: new UpdateUserProfile(userRepository),
          requestAvatarUploadUrl: new RequestAvatarUploadUrl(gcsAvatarSigner),
          updateUserAvatar: new UpdateUserAvatar(userRepository, gcsAvatarSigner),
          authenticate: makeAuthenticate(jwtService),
        },
      },
      { logger: false, forceFlushTelemetry: false },
    )
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /users/me', () => {
    it('200 で自分の情報を返す（email含む）', async () => {
      const user = new User(authenticatedUserId, 'Alice', 'alice@example.com', '1990-01-01', 'https://x.com/alice', null, new Date())
      userRepository.findById.mockResolvedValue(user)

      const res = await app.inject({ method: 'GET', url: '/users/me', headers: authHeader })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        id: authenticatedUserId,
        name: 'Alice',
        email: 'alice@example.com',
        birthdate: '1990-01-01',
        snsUrl: 'https://x.com/alice',
        avatarUrl: null,
      })
    })

    it('見つからなければ 404', async () => {
      userRepository.findById.mockResolvedValue(null)

      const res = await app.inject({ method: 'GET', url: '/users/me', headers: authHeader })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({ message: 'ユーザーが見つかりません' })
    })
  })

  describe('GET /users/search', () => {
    it('q が無ければ 400', async () => {
      const res = await app.inject({ method: 'GET', url: '/users/search', headers: authHeader })

      expect(res.statusCode).toBe(400)
    })

    it('q が重複クエリパラメータ（配列）なら 400（Zodスキーマによるバリデーション）', async () => {
      const res = await app.inject({ method: 'GET', url: '/users/search?q=a&q=b', headers: authHeader })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ message: 'リクエストの形式が正しくありません' })
      expect(userRepository.findByName).not.toHaveBeenCalled()
    })

    it('q があれば email・snsUrl を含まない形で返す', async () => {
      const user = new User('user-2', 'Bob', 'bob@example.com', '2000-01-01', 'https://x.com/bob', null, new Date())
      userRepository.findByName.mockResolvedValue([user])

      const res = await app.inject({ method: 'GET', url: '/users/search?q=Bob', headers: authHeader })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        users: [{ id: 'user-2', name: 'Bob', birthdate: '2000-01-01' }],
      })
    })
  })

  describe('PATCH /users/me', () => {
    it('204 で更新され、名前の前後の空白は trim される', async () => {
      userRepository.updateProfile.mockResolvedValue(undefined)

      const res = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: authHeader,
        payload: { name: '  Alice  ', birthdate: '1990-01-01', snsUrl: null },
      })

      expect(res.statusCode).toBe(204)
      expect(userRepository.updateProfile).toHaveBeenCalledWith(authenticatedUserId, {
        name: 'Alice',
        birthdate: '1990-01-01',
        snsUrl: null,
      })
    })

    it('名前が空白のみなら 400', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: authHeader,
        payload: { name: '   ', birthdate: null, snsUrl: null },
      })

      expect(res.statusCode).toBe(400)
      expect(userRepository.updateProfile).not.toHaveBeenCalled()
    })
  })

  describe('POST /users/me/avatar-upload-url', () => {
    it('許可された形式なら署名済みポリシーを返す', async () => {
      const policy = { uploadUrl: 'https://storage.googleapis.com/bucket', fields: { key: 'avatars/user-1' } }
      gcsAvatarSigner.createUploadPolicy.mockResolvedValue(policy)

      const res = await app.inject({
        method: 'POST',
        url: '/users/me/avatar-upload-url',
        headers: authHeader,
        payload: { contentType: 'image/jpeg' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual(policy)
      expect(gcsAvatarSigner.createUploadPolicy).toHaveBeenCalledWith(authenticatedUserId, 'image/jpeg')
    })

    it('許可されていない形式なら 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/users/me/avatar-upload-url',
        headers: authHeader,
        payload: { contentType: 'image/svg+xml' },
      })

      expect(res.statusCode).toBe(400)
      expect(gcsAvatarSigner.createUploadPolicy).not.toHaveBeenCalled()
    })

    it('contentTypeが無ければ 400（Zodスキーマによるバリデーション）', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/users/me/avatar-upload-url',
        headers: authHeader,
        payload: {},
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ message: 'リクエストの形式が正しくありません' })
    })
  })

  describe('PATCH /users/me/avatar', () => {
    it('アップロード済みなら 204 で公開URLを保存する', async () => {
      gcsAvatarSigner.objectExists.mockResolvedValue(true)
      gcsAvatarSigner.getPublicUrl.mockReturnValue('https://storage.googleapis.com/bucket/avatars/user-1')

      const res = await app.inject({ method: 'PATCH', url: '/users/me/avatar', headers: authHeader })

      expect(res.statusCode).toBe(204)
      expect(userRepository.updateAvatarUrl).toHaveBeenCalledWith(
        authenticatedUserId,
        'https://storage.googleapis.com/bucket/avatars/user-1',
      )
    })

    it('アップロードされていなければ 400', async () => {
      gcsAvatarSigner.objectExists.mockResolvedValue(false)

      const res = await app.inject({ method: 'PATCH', url: '/users/me/avatar', headers: authHeader })

      expect(res.statusCode).toBe(400)
      expect(userRepository.updateAvatarUrl).not.toHaveBeenCalled()
    })
  })
})
