import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { RequestAvatarUploadUrl } from './RequestAvatarUploadUrl.js'
import { AppError } from '../../domain/shared/AppError.js'
import type { GcsAvatarSigner } from '../../infrastructure/external/GcsAvatarSigner.js'

describe('RequestAvatarUploadUrl', () => {
  let gcsAvatarSigner: jest.Mocked<GcsAvatarSigner>
  let requestAvatarUploadUrl: RequestAvatarUploadUrl

  beforeEach(() => {
    gcsAvatarSigner = {
      createUploadPolicy: jest.fn<GcsAvatarSigner['createUploadPolicy']>(),
      getPublicUrl: jest.fn<GcsAvatarSigner['getPublicUrl']>(),
      objectExists: jest.fn<GcsAvatarSigner['objectExists']>(),
    } as unknown as jest.Mocked<GcsAvatarSigner>
    requestAvatarUploadUrl = new RequestAvatarUploadUrl(gcsAvatarSigner)
  })

  it('許可された形式なら署名済みポリシーを返す', async () => {
    const policy = { uploadUrl: 'https://storage.googleapis.com/bucket', fields: { key: 'avatars/user-1' } }
    gcsAvatarSigner.createUploadPolicy.mockResolvedValue(policy)

    const result = await requestAvatarUploadUrl.execute('user-1', 'image/jpeg')

    expect(gcsAvatarSigner.createUploadPolicy).toHaveBeenCalledWith('user-1', 'image/jpeg')
    expect(result).toBe(policy)
  })

  it('許可されていない形式なら AppError(400) を投げ、署名は生成しない', async () => {
    await expect(requestAvatarUploadUrl.execute('user-1', 'image/svg+xml')).rejects.toThrow(AppError)
    expect(gcsAvatarSigner.createUploadPolicy).not.toHaveBeenCalled()
  })
})
