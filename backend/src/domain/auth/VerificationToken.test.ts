import { describe, it, expect } from '@jest/globals'
import { VerificationToken } from './VerificationToken.js'

type VerificationTokenOverrides = {
  expiresAt?: Date
  consumedAt?: Date | null
}

const buildToken = (
  overrides: VerificationTokenOverrides = {},
): VerificationToken =>
  new VerificationToken(
    'token-1',
    'user-1',
    'password_reset',
    'hash',
    overrides.expiresAt ?? new Date(Date.now() + 60 * 1000),
    overrides.consumedAt ?? null,
    new Date(),
  )

describe('VerificationToken', () => {
  describe('isExpired', () => {
    it('有効期限が過去なら true', () => {
      const token = buildToken({ expiresAt: new Date(Date.now() - 1000) })
      expect(token.isExpired()).toBe(true)
    })

    it('有効期限が未来なら false', () => {
      const token = buildToken({ expiresAt: new Date(Date.now() + 60 * 1000) })
      expect(token.isExpired()).toBe(false)
    })
  })

  describe('isConsumed', () => {
    it('consumedAt があれば true', () => {
      const token = buildToken({ consumedAt: new Date() })
      expect(token.isConsumed()).toBe(true)
    })

    it('consumedAt が null なら false', () => {
      const token = buildToken({ consumedAt: null })
      expect(token.isConsumed()).toBe(false)
    })
  })
})
