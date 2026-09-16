import { apiClient } from '@/lib/apiClient'
import type { ReviewItem, SortOrder } from '@/types/review'

export function getReviews(sortOrder: SortOrder, userId?: string): Promise<{ reviews: ReviewItem[] }> {
  const query = userId ? `sort=${sortOrder}&userId=${userId}` : `sort=${sortOrder}`
  return apiClient(`/api/reviews?${query}`)
}

export function createReview(movieId: string, score: number): Promise<void> {
  return apiClient('/api/reviews', {
    method: 'POST',
    body: JSON.stringify({ movieId, score }),
  })
}

export function updateReviewScore(reviewId: string, score: number): Promise<void> {
  return apiClient(`/api/reviews/${reviewId}`, {
    method: 'PATCH',
    body: JSON.stringify({ score }),
  })
}

export function deleteReview(reviewId: string): Promise<void> {
  return apiClient(`/api/reviews/${reviewId}`, { method: 'DELETE' })
}
