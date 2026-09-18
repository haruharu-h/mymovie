import { apiClient } from '@/lib/apiClient'

export function requestPasswordReset(email: string): Promise<void> {
  return apiClient<void>('/api/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function resetPassword(token: string, newPassword: string): Promise<void> {
  return apiClient<void>('/api/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  })
}
