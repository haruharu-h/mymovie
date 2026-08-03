import { SignJWT, jwtVerify } from 'jose'
import { createHash } from 'crypto'

export class JwtService {
  private readonly secret: Uint8Array

  constructor() {
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) throw new Error('JWT_SECRET が設定されていません')
    this.secret = new TextEncoder().encode(jwtSecret)
  }

  async generateAccessToken(userId: string): Promise<string> {
    return new SignJWT({ userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(this.secret)
  }

  async verifyAccessToken(token: string): Promise<{ userId: string }> {
    const { payload } = await jwtVerify(token, this.secret)
    return { userId: payload.userId as string }
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
