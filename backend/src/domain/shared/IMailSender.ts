export interface IMailSender {
  sendPasswordResetEmail(to: string, token: string): Promise<void>
  sendEmailConfirmation(to: string, token: string): Promise<void>
}
