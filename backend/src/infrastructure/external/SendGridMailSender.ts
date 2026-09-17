import sgMail from '@sendgrid/mail'
import type { IMailSender } from '../../domain/shared/IMailSender.js'

export class SendGridMailSender implements IMailSender {
  private readonly fromEmail: string
  private readonly frontendUrl: string

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) throw new Error('SENDGRID_API_KEY is not set')
    sgMail.setApiKey(apiKey)

    const fromEmail = process.env.SENDGRID_FROM_EMAIL
    if (!fromEmail) throw new Error('SENDGRID_FROM_EMAIL is not set')
    this.fromEmail = fromEmail

    const frontendUrl = process.env.FRONTEND_URL
    if (!frontendUrl) throw new Error('FRONTEND_URL is not set')
    this.frontendUrl = frontendUrl
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const url = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`
    await sgMail.send({
      to,
      from: this.fromEmail,
      subject: '【mymovie】パスワード再設定のご案内',
      text: `以下のリンクからパスワードを再設定してください（1時間有効）。\n\n${url}\n\nこのメールに心当たりがない場合は、無視してください。`,
    })
  }

  async sendEmailConfirmation(to: string, token: string): Promise<void> {
    const url = `${this.frontendUrl}/confirm-email?token=${encodeURIComponent(token)}`
    await sgMail.send({
      to,
      from: this.fromEmail,
      subject: '【mymovie】メールアドレスの確認',
      text: `以下のリンクからメールアドレスの確認を完了してください（24時間有効）。\n\n${url}`,
    })
  }
}
