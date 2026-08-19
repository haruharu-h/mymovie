import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { GetReviews } from '../../application/review/GetReviews.js'
import type { CreateReview } from '../../application/review/CreateReview.js'
import type { UpdateReview } from '../../application/review/UpdateReview.js'
import type { DeleteReview } from '../../application/review/DeleteReview.js'
import type { SortOrder } from '../../domain/review/IReviewRepository.js'
import { setSpanAttribute } from '../../infrastructure/tracing.js'

// このルートが必要とするユースケースの束
export type ReviewRouteDeps = {
  getReviews: GetReviews
  createReview: CreateReview
  updateReview: UpdateReview
  deleteReview: DeleteReview
  authenticate: preHandlerHookHandler
}

const VALID_SORT_ORDERS: SortOrder[] = ['score', 'releaseDate', 'registeredAt']

export async function reviewRoutes(app: FastifyInstance, deps: ReviewRouteDeps) {
  app.get('/reviews', { preHandler: deps.authenticate }, async (request, reply) => {
    // コールドスタート判別用（docs/decisions.md「SLI・SLO・SLAの学習とmymovieへの当てはめ」参照）
    setSpanAttribute('app.process_uptime_seconds', process.uptime())

    const { sort, userId } = request.query as { sort?: string; userId?: string }

    const sortOrder: SortOrder = VALID_SORT_ORDERS.includes(sort as SortOrder)
      ? (sort as SortOrder)
      : 'registeredAt'

    const targetUserId = userId ?? request.userId

    const reviewsWithMovies = await deps.getReviews.execute(targetUserId, sortOrder)

    return reply.send({
      reviews: reviewsWithMovies.map(({ review, movie }) => ({
        id: review.id,
        score: review.score.value,
        registeredAt: review.registeredAt,
        movie: {
          id: movie.id,
          title: movie.title,
          posterPath: movie.posterPath,
          releaseDate: movie.releaseDate,
        },
      })),
    })
  })

  app.post('/reviews', { preHandler: deps.authenticate }, async (request, reply) => {
    const { movieId, score } = request.body as { movieId: string; score: number }

    await deps.createReview.execute(request.userId, movieId, score)

    return reply.status(201).send()
  })

  app.patch('/reviews/:reviewId', { preHandler: deps.authenticate }, async (request, reply) => {
    const { reviewId } = request.params as { reviewId: string }
    const { score } = request.body as { score: number }

    await deps.updateReview.execute(reviewId, request.userId, score)

    return reply.status(200).send()
  })

  app.delete('/reviews/:reviewId', { preHandler: deps.authenticate }, async (request, reply) => {
    const { reviewId } = request.params as { reviewId: string }

    await deps.deleteReview.execute(reviewId, request.userId)

    return reply.status(204).send()
  })
}
