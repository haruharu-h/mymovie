import { apiClient } from '@/lib/apiClient'
import type { UserSummary } from '@/types/user'

export function getFollowees(): Promise<{ users: UserSummary[] }> {
  return apiClient('/api/follows')
}

export function follow(followeeId: string): Promise<void> {
  return apiClient('/api/follows', {
    method: 'POST',
    body: JSON.stringify({ followeeId }),
  })
}

export function unfollow(followeeId: string): Promise<void> {
  return apiClient(`/api/follows/${followeeId}`, { method: 'DELETE' })
}
