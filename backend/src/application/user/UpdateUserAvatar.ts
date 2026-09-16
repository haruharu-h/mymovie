import { AppError } from '../../domain/shared/AppError.js'
import type { IUserRepository } from '../../domain/user/IUserRepository.js'
import type { GcsAvatarSigner } from '../../infrastructure/external/GcsAvatarSigner.js'

export class UpdateUserAvatar {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly gcsAvatarSigner: GcsAvatarSigner,
  ) {}

  // avatarUrlはクライアントから受け取らない。userIdは呼び出し元（route）が認証済みJWTから
  // 渡す前提で、そこから決まる公開URLをここで自分で組み立てる（クライアントが任意の
  // 外部URLを送り込める抜け穴を作らないため）
  async execute(userId: string): Promise<void> {
    const uploaded = await this.gcsAvatarSigner.objectExists(userId)
    if (!uploaded) {
      throw new AppError('画像がアップロードされていません', 400)
    }

    const avatarUrl = this.gcsAvatarSigner.getPublicUrl(userId, Date.now())
    await this.userRepository.updateAvatarUrl(userId, avatarUrl)
  }
}
