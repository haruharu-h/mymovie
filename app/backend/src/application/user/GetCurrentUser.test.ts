import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { GetCurrentUser } from './GetCurrentUser.js'
import { User } from '../../domain/user/User.js'
import { AppError } from '../../domain/shared/AppError.js'
import type { IUserRepository } from '../../domain/user/IUserRepository.js'

const buildUserRepository = (): jest.Mocked<IUserRepository> => ({
  save: jest.fn<IUserRepository['save']>(),
  findById: jest.fn<IUserRepository['findById']>(),
  findByEmail: jest.fn<IUserRepository['findByEmail']>(),
  findByName: jest.fn<IUserRepository['findByName']>(),
  updateProfile: jest.fn<IUserRepository['updateProfile']>(),
  updateAvatarUrl: jest.fn<IUserRepository['updateAvatarUrl']>(),
})

describe('GetCurrentUser', () => {
  let userRepository: jest.Mocked<IUserRepository>
  let getCurrentUser: GetCurrentUser

  beforeEach(() => {
    userRepository = buildUserRepository()
    getCurrentUser = new GetCurrentUser(userRepository)
  })

  it('ユーザーが見つかれば返す', async () => {
    const user = new User('user-1', 'Alice', 'a@example.com', null, null, null, new Date())
    userRepository.findById.mockResolvedValue(user)

    const result = await getCurrentUser.execute('user-1')
    expect(result).toBe(user)
  })

  it('見つからなければ AppError(404)', async () => {
    userRepository.findById.mockResolvedValue(null)
    expect.assertions(2)
    try {
      await getCurrentUser.execute('user-1')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(404)
    }
  })
})
