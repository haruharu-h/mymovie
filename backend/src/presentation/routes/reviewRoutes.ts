import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { GetReviews } from '../../application/review/GetReviews.js'
import type { CreateReview } from '../../application/review/CreateReview.js'
import type { UpdateReview } from '../../application/review/UpdateReview.js'
import type { DeleteReview } from '../../application/review/DeleteReview.js'
import type { SortOrder } from '../../domain/review/IReviewRepository.js'

// このルートが必要とするユースケースの束
export type ReviewRouteDeps = {
  getReviews: GetReviews
  createReview: CreateReview
  updateReview: UpdateReview
  deleteReview: DeleteReview
  authenticate: preHandlerHookHandler
}

const VALID_SORT_ORDERS: SortOrder[] = ['score', 'releaseDate', 'registeredAt']

// クエリの型・存在チェックのみ担う（sortの妥当な値かどうかは既存のフォールバック処理に任せる）
const GetReviewsQuerySchema = z.object({
  sort: z.string().optional(),
  userId: z.string().optional(),
})

// reviewIdの型・必須チェックのみを担う
const ReviewIdParamsSchema = z.object({
  reviewId: z.string().min(1),
})

// movieId/scoreの型・必須チェックのみを担う（スコアの範囲・精度はScoreバリューオブジェクトに一本化する方針のため書かない）
const CreateReviewBodySchema = z.object({
  movieId: z.string().min(1),
  score: z.number(),
})

const UpdateReviewBodySchema = z.object({
  score: z.number(),
})

export async function reviewRoutes(app: FastifyInstance, deps: ReviewRouteDeps) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/reviews',
    { preHandler: deps.authenticate, schema: { querystring: GetReviewsQuerySchema } },
    async (request, reply) => {
      const { sort, userId } = request.query

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
    },
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/reviews',
    { preHandler: deps.authenticate, schema: { body: CreateReviewBodySchema } },
    async (request, reply) => {
      const { movieId, score } = request.body

      await deps.createReview.execute(request.userId, movieId, score)

      return reply.status(201).send()
    },
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/reviews/:reviewId',
    {
      preHandler: deps.authenticate,
      schema: { params: ReviewIdParamsSchema, body: UpdateReviewBodySchema },
    },
    async (request, reply) => {
      const { reviewId } = request.params
      const { score } = request.body

      await deps.updateReview.execute(reviewId, request.userId, score)

      return reply.status(200).send()
    },
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/reviews/:reviewId',
    { preHandler: deps.authenticate, schema: { params: ReviewIdParamsSchema } },
    async (request, reply) => {
      const { reviewId } = request.params

      await deps.deleteReview.execute(reviewId, request.userId)

      return reply.status(204).send()
    },
  )
}
