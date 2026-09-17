import { UserName } from '../../domain/user/UserName.js'
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
    const name = UserName.create(input.name)

    await this.userRepository.updateProfile(input.userId, {
      name: name.value,
      birthdate: input.birthdate,
      snsUrl: input.snsUrl,
    })
  }
}
