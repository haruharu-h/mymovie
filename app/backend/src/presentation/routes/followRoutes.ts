import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { FollowUser } from '../../application/follow/FollowUser.js'
import type { UnfollowUser } from '../../application/follow/UnfollowUser.js'
import type { GetFollowees } from '../../application/follow/GetFollowees.js'

// followeeIdの型・必須チェックのみを担う
const FolloweeIdBodySchema = z.object({
  followeeId: z.string().min(1),
})

const FolloweeIdParamsSchema = z.object({
  followeeId: z.string().min(1),
})

// follow ルートが必要とするユースケースの束
export type FollowRouteDeps = {
  followUser: FollowUser
  unfollowUser: UnfollowUser
  getFollowees: GetFollowees
  authenticate: preHandlerHookHandler
}

export async function followRoutes(app: FastifyInstance, deps: FollowRouteDeps) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/follows',
    { preHandler: deps.authenticate, schema: { body: FolloweeIdBodySchema } },
    async (request, reply) => {
      const { followeeId } = request.body

      await deps.followUser.execute(request.userId, followeeId)

      return reply.status(201).send()
    },
  )

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/follows/:followeeId',
    { preHandler: deps.authenticate, schema: { params: FolloweeIdParamsSchema } },
    async (request, reply) => {
      const { followeeId } = request.params

      await deps.unfollowUser.execute(request.userId, followeeId)

      return reply.status(204).send()
    },
  )

  app.get('/follows', { preHandler: deps.authenticate }, async (request, reply) => {
    const followees = await deps.getFollowees.execute(request.userId)

    return reply.send({
      users: followees.map(user => ({
        id: user.id,
        name: user.name,
        birthdate: user.birthdate,
      })),
    })
  })
}
