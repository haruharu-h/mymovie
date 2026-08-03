import { apiClient } from '@/lib/apiClient'
import type { CurrentUser, UpdateProfileInput, UserSummary } from '@/types/user'

export function searchUsers(query: string): Promise<{ users: UserSummary[] }> {
  return apiClient(`/api/users/search?q=${encodeURIComponent(query)}`)
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiClient('/api/users/me')
}

export function updateProfile(data: UpdateProfileInput): Promise<void> {
  return apiClient('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}
