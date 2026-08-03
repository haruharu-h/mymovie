import type { Follow } from './Follow.js'
import type { User } from '../user/User.js'

export interface IFollowRepository {
  save(follow: Follow): Promise<void>
  delete(followerId: string, followeeId: string): Promise<void>
  findFolloweesByFollowerId(followerId: string): Promise<User[]>
}
