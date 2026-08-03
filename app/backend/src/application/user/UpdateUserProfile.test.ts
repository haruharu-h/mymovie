import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { UpdateUserProfile } from './UpdateUserProfile.js'
import type { IUserRepository } from '../../domain/user/IUserRepository.js'

describe('UpdateUserProfile', () => {
  let userRepository: jest.Mocked<IUserRepository>
  let updateUserProfile: UpdateUserProfile

  beforeEach(() => {
    userRepository = {
      save: jest.fn<IUserRepository['save']>(),
      findById: jest.fn<IUserRepository['findById']>(),
      findByEmail: jest.fn<IUserRepository['findByEmail']>(),
      findByName: jest.fn<IUserRepository['findByName']>(),
      updateProfile: jest.fn<IUserRepository['updateProfile']>(),
    }
    updateUserProfile = new UpdateUserProfile(userRepository)
  })

  it('userId と profile データをリポジトリに渡す（フィールドのマッピング）', async () => {
    await updateUserProfile.execute({
      userId: 'user-1',
      name: 'Alice',
      birthdate: '1990-01-01',
      snsUrl: 'https://example.com',
    })

    expect(userRepository.updateProfile).toHaveBeenCalledWith('user-1', {
      name: 'Alice',
      birthdate: '1990-01-01',
      snsUrl: 'https://example.com',
    })
  })
})
