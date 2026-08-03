import type { IUserRepository } from '../../domain/user/IUserRepository.js'
import type { User } from '../../domain/user/User.js'

export class SearchUsers {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(name: string): Promise<User[]> {
    return this.userRepository.findByName(name)
  }
}
