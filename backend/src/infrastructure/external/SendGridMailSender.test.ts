import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'

// @sendgrid/mailは`global.fetch`のような差し替え可能な標準APIを使わないため、
// TmdbApiClientのfetchスパイ方式ではモックできない。ESM前提のこのプロジェクトでは
// jest.unstable_mockModule + 動的importでモジュール自体を差し替える
const send = jest.fn()
const setApiKey = jest.fn()

jest.unstable_mockModule('@sendgrid/mail', () => ({
  default: { send, setApiKey },
}))

describe('SendGridMailSender', () => {
  const originalApiKey = process.env.SENDGRID_API_KEY
  const originalFromEmail = process.env.SENDGRID_FROM_EMAIL
  const originalFrontendUrl = process.env.FRONTEND_URL

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SENDGRID_API_KEY = 'test-api-key'
    process.env.SENDGRID_FROM_EMAIL = 'noreply@example.com'
    process.env.FRONTEND_URL = 'https://example.com'
  })

  afterEach(() => {
    process.env.SENDGRID_API_KEY = originalApiKey
    process.env.SENDGRID_FROM_EMAIL = originalFromEmail
    process.env.FRONTEND_URL = originalFrontendUrl
  })

  describe('constructor', () => {
    it('SENDGRID_API_KEY が未設定なら Error を投げる', async () => {
      delete process.env.SENDGRID_API_KEY
      const { SendGridMailSender } = await import('./SendGridMailSender.js')
      expect(() => new SendGridMailSender()).toThrow(Error)
    })

    it('SENDGRID_FROM_EMAIL が未設定なら Error を投げる', async () => {
      delete process.env.SENDGRID_FROM_EMAIL
      const { SendGridMailSender } = await import('./SendGridMailSender.js')
      expect(() => new SendGridMailSender()).toThrow(Error)
    })

    it('FRONTEND_URL が未設定なら Error を投げる', async () => {
      delete process.env.FRONTEND_URL
      const { SendGridMailSender } = await import('./SendGridMailSender.js')
      expect(() => new SendGridMailSender()).toThrow(Error)
    })
  })

  describe('sendPasswordResetEmail', () => {
    it('パスワードリセット用のURLを組み立ててsgMail.sendを呼ぶ', async () => {
      const { SendGridMailSender } = await import('./SendGridMailSender.js')
      const sender = new SendGridMailSender()

      await sender.sendPasswordResetEmail('user@example.com', 'raw-token')

      expect(setApiKey).toHaveBeenCalledWith('test-api-key')
      expect(send).toHaveBeenCalledWith(expect.objectContaining({
        to: 'user@example.com',
        from: 'noreply@example.com',
        text: expect.stringContaining('https://example.com/reset-password?token=raw-token'),
      }))
    })
  })

  describe('sendEmailConfirmation', () => {
    it('メール確認用のURLを組み立ててsgMail.sendを呼ぶ', async () => {
      const { SendGridMailSender } = await import('./SendGridMailSender.js')
      const sender = new SendGridMailSender()

      await sender.sendEmailConfirmation('user@example.com', 'raw-token')

      expect(send).toHaveBeenCalledWith(expect.objectContaining({
        to: 'user@example.com',
        text: expect.stringContaining('https://example.com/confirm-email?token=raw-token'),
      }))
    })
  })
})
