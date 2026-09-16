import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { SearchUsers } from './SearchUsers.js'
import type { IUserRepository } from '../../domain/user/IUserRepository.js'
import type { User } from '../../domain/user/User.js'

describe('SearchUsers', () => {
  let userRepository: jest.Mocked<IUserRepository>
  let searchUsers: SearchUsers

  beforeEach(() => {
    userRepository = {
      save: jest.fn<IUserRepository['save']>(),
      findById: jest.fn<IUserRepository['findById']>(),
      findByEmail: jest.fn<IUserRepository['findByEmail']>(),
      findByName: jest.fn<IUserRepository['findByName']>(),
      updateProfile: jest.fn<IUserRepository['updateProfile']>(),
      updateAvatarUrl: jest.fn<IUserRepository['updateAvatarUrl']>(),
    }
    searchUsers = new SearchUsers(userRepository)
  })

  it('name でユーザーを検索し、結果をそのまま返す', async () => {
    const users = [] as User[]
    userRepository.findByName.mockResolvedValue(users)

    const result = await searchUsers.execute('Alice')

    expect(userRepository.findByName).toHaveBeenCalledWith('Alice')
    expect(result).toBe(users)
  })
})
