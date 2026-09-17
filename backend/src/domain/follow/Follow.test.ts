import { describe, it, expect } from '@jest/globals'
import { Follow } from './Follow.js'
import { AppError } from '../shared/AppError.js'

describe('Follow', () => {
  it('followerId と followeeId が同じだと AppError(400)', () => {
    expect(() => new Follow('user-1', 'user-1', new Date())).toThrow(AppError)
    try {
      new Follow('user-1', 'user-1', new Date())
    } catch (e) {
      expect((e as AppError).statusCode).toBe(400)
    }
  })

  it('followerId と followeeId が異なれば作成できる', () => {
    const follow = new Follow('user-1', 'user-2', new Date())
    expect(follow.followerId).toBe('user-1')
    expect(follow.followeeId).toBe('user-2')
  })
})
