import type { Session } from './Session.js'

export interface ISessionRepository {
  save(session: Session): Promise<void>
  findByRefreshTokenHash(hash: string): Promise<Session | null>
  updateRefreshTokenHash(id: string, hash: string): Promise<void>
  delete(id: string): Promise<void>
  deleteAllByUserId(userId: string): Promise<void>
}
