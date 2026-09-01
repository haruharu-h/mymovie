import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { SearchMovies } from '../../application/movie/SearchMovies.js'
import type { RegisterMovie } from '../../application/movie/RegisterMovie.js'
import type { GetMovieDetail } from '../../application/movie/GetMovieDetail.js'

// tmdbIdの型・必須チェックのみを担う（メール形式等のビジネスルールは値オブジェクトに一本化する方針のため書かない）
const RegisterMovieBodySchema = z.object({
  tmdbId: z.string().min(1),
})

// qの型チェックのみを担う（未指定時の具体的な日本語メッセージはルート側の分岐に残す）
const SearchMoviesQuerySchema = z.object({
  q: z.string().optional(),
})

const MovieParamsSchema = z.object({
  tmdbId: z.string().min(1),
})

// movie ルートが必要とするユースケースの束
export type MovieRouteDeps = {
  searchMovies: SearchMovies
  registerMovie: RegisterMovie
  getMovieDetail: GetMovieDetail
  authenticate: preHandlerHookHandler
}

export async function movieRoutes(app: FastifyInstance, deps: MovieRouteDeps) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/movies/search',
    { preHandler: deps.authenticate, schema: { querystring: SearchMoviesQuerySchema } },
    async (request, reply) => {
      const { q } = request.query

      if (!q) {
        return reply.status(400).send({ message: '検索キーワードを入力してください' })
      }

      const movies = await deps.searchMovies.execute(q)
      return reply.send({ movies })
    },
  )

  app.withTypeProvider<ZodTypeProvider>().post(
    '/movies',
    { preHandler: deps.authenticate, schema: { body: RegisterMovieBodySchema } },
    async (request, reply) => {
      const { tmdbId } = request.body

      await deps.registerMovie.execute(tmdbId)

      return reply.status(201).send()
    },
  )

  app.withTypeProvider<ZodTypeProvider>().get(
    '/movies/:tmdbId',
    { preHandler: deps.authenticate, schema: { params: MovieParamsSchema } },
    async (request, reply) => {
      const { tmdbId } = request.params

      const result = await deps.getMovieDetail.execute(tmdbId)
      return reply.send({
        movie: {
          id: result.movie.id,
          title: result.movie.title,
          posterPath: result.movie.posterPath,
          releaseDate: result.movie.releaseDate,
        },
        averageScore: result.averageScore,
        reviews: result.reviews.map(({ review, user }) => ({
          id: review.id,
          score: review.score.value,
          registeredAt: review.registeredAt,
          user: { id: user.id, name: user.name },
        })),
      })
    },
  )
}
