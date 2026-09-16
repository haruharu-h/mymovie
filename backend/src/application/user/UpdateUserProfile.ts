import type { IUserRepository } from '../../domain/user/IUserRepository.js'

type UpdateUserProfileInput = {
  userId: string
  name: string
  birthdate: string | null
  snsUrl: string | null
}

export class UpdateUserProfile {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: UpdateUserProfileInput): Promise<void> {
    await this.userRepository.updateProfile(input.userId, {
      name: input.name,
      birthdate: input.birthdate,
      snsUrl: input.snsUrl,
    })
  }
}
