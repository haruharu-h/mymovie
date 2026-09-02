import type { User } from './User.js'

export type UpdateProfileData = {
  name: string
  birthdate: string | null
  snsUrl: string | null
}

export interface IUserRepository {
  save(user: User): Promise<void>
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  findByName(name: string): Promise<User[]>
  updateProfile(userId: string, data: UpdateProfileData): Promise<void>
  updateAvatarUrl(userId: string, avatarUrl: string): Promise<void>
}
