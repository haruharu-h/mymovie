import { describe, it, expect } from '@jest/globals'
import { Session } from './Session.js'

const buildSession = (expiresAt: Date): Session =>
  new Session('session-1', 'user-1', 'hash', expiresAt, new Date())

describe('Session', () => {
  describe('isExpired', () => {
    it('有効期限が過去なら true', () => {
      const session = buildSession(new Date(Date.now() - 1000))
      expect(session.isExpired()).toBe(true)
    })

    it('有効期限が未来なら false', () => {
      const session = buildSession(new Date(Date.now() + 60 * 1000))
      expect(session.isExpired()).toBe(false)
    })
  })
})
