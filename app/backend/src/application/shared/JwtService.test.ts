import { describe, it, expect, afterEach, beforeEach } from '@jest/globals'
import { JwtService } from './JwtService.js'

describe('JwtService', () => {
  describe('constructor', () => {
    const original = process.env.JWT_SECRET

    afterEach(() => {
      process.env.JWT_SECRET = original
    })

    it('JWT_SECRET が未設定なら Error を投げる', () => {
      delete process.env.JWT_SECRET
      expect(() => new JwtService()).toThrow(Error)
    })
  })

  describe('hashToken', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret'
    })

    it('同じトークンなら常に同じハッシュ値になる', () => {
      const service = new JwtService()

      const hash1 = service.hashToken('raw-refresh-token')
      const hash2 = service.hashToken('raw-refresh-token')

      expect(hash1).toBe(hash2)
    })

    it('異なるトークンなら異なるハッシュ値になる', () => {
      const service = new JwtService()

      const hash1 = service.hashToken('token-a')
      const hash2 = service.hashToken('token-b')

      expect(hash1).not.toBe(hash2)
    })
  })

  // ESM移行(item S)完了により本物のjoseが動くようになったため、
  // 生成・検証を本物のjoseで通しで検証する（decisions.md参照）
  describe('generateAccessToken / verifyAccessToken', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret'
    })

    it('生成したトークンをverifyAccessTokenで検証でき、userIdを取り出せる', async () => {
      const service = new JwtService()

      const token = await service.generateAccessToken('user-1')
      const result = await service.verifyAccessToken(token)

      expect(result.userId).toBe('user-1')
    })

    it('有効期限は15分後に設定される', async () => {
      const service = new JwtService()
      const beforeSec = Math.floor(Date.now() / 1000)

      const token = await service.generateAccessToken('user-1')

      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
      expect(payload.exp).toBeGreaterThanOrEqual(beforeSec + 15 * 60 - 2)
      expect(payload.exp).toBeLessThanOrEqual(beforeSec + 15 * 60 + 2)
    })

    it('異なるJWT_SECRETで生成されたトークンは検証に失敗する', async () => {
      const issuer = new JwtService()
      const token = await issuer.generateAccessToken('user-1')

      process.env.JWT_SECRET = 'different-secret'
      const verifier = new JwtService()

      await expect(verifier.verifyAccessToken(token)).rejects.toThrow()
    })

    it('改ざんされたトークンは検証に失敗する', async () => {
      const service = new JwtService()
      const token = await service.generateAccessToken('user-1')
      const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')

      await expect(service.verifyAccessToken(tampered)).rejects.toThrow()
    })
  })
})
