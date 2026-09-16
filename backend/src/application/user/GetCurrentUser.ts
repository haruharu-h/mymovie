import { AppError } from '../../domain/shared/AppError.js'
import type { IUserRepository } from '../../domain/user/IUserRepository.js'
import type { User } from '../../domain/user/User.js'

export class GetCurrentUser {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId)
    if (!user) throw new AppError('ユーザーが見つかりません', 404)
    return user
  }
}
