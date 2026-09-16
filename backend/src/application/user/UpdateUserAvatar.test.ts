import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { UpdateUserAvatar } from './UpdateUserAvatar.js'
import { AppError } from '../../domain/shared/AppError.js'
import type { IUserRepository } from '../../domain/user/IUserRepository.js'
import type { GcsAvatarSigner } from '../../infrastructure/external/GcsAvatarSigner.js'

describe('UpdateUserAvatar', () => {
  let userRepository: jest.Mocked<IUserRepository>
  let gcsAvatarSigner: jest.Mocked<GcsAvatarSigner>
  let updateUserAvatar: UpdateUserAvatar

  beforeEach(() => {
    userRepository = {
      save: jest.fn<IUserRepository['save']>(),
      findById: jest.fn<IUserRepository['findById']>(),
      findByEmail: jest.fn<IUserRepository['findByEmail']>(),
      findByName: jest.fn<IUserRepository['findByName']>(),
      updateProfile: jest.fn<IUserRepository['updateProfile']>(),
      updateAvatarUrl: jest.fn<IUserRepository['updateAvatarUrl']>(),
    }
    gcsAvatarSigner = {
      createUploadPolicy: jest.fn<GcsAvatarSigner['createUploadPolicy']>(),
      getPublicUrl: jest.fn<GcsAvatarSigner['getPublicUrl']>(),
      objectExists: jest.fn<GcsAvatarSigner['objectExists']>(),
    } as unknown as jest.Mocked<GcsAvatarSigner>
    updateUserAvatar = new UpdateUserAvatar(userRepository, gcsAvatarSigner)
  })

  it('アップロード済みなら公開URLを組み立てて保存する', async () => {
    gcsAvatarSigner.objectExists.mockResolvedValue(true)
    gcsAvatarSigner.getPublicUrl.mockReturnValue('https://storage.googleapis.com/bucket/avatars/user-1?v=123')

    await updateUserAvatar.execute('user-1')

    expect(gcsAvatarSigner.objectExists).toHaveBeenCalledWith('user-1')
    expect(gcsAvatarSigner.getPublicUrl).toHaveBeenCalledWith('user-1', expect.any(Number))
    expect(userRepository.updateAvatarUrl).toHaveBeenCalledWith(
      'user-1',
      'https://storage.googleapis.com/bucket/avatars/user-1?v=123',
    )
  })

  it('アップロードされていなければ AppError(400) を投げ、保存しない', async () => {
    gcsAvatarSigner.objectExists.mockResolvedValue(false)

    const error: unknown = await updateUserAvatar.execute('user-1').catch(e => e)

    expect(error).toBeInstanceOf(AppError)
    expect(error).toMatchObject({ statusCode: 400 })
    expect(userRepository.updateAvatarUrl).not.toHaveBeenCalled()
  })
})
