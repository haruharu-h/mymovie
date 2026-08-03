import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { FollowUser } from '../../application/follow/FollowUser.js'
import type { UnfollowUser } from '../../application/follow/UnfollowUser.js'
import type { GetFollowees } from '../../application/follow/GetFollowees.js'

// follow ルートが必要とするユースケースの束
export type FollowRouteDeps = {
  followUser: FollowUser
  unfollowUser: UnfollowUser
  getFollowees: GetFollowees
  authenticate: preHandlerHookHandler
}

export async function followRoutes(app: FastifyInstance, deps: FollowRouteDeps) {
  app.post('/follows', { preHandler: deps.authenticate }, async (request, reply) => {
    const { followeeId } = request.body as { followeeId: string }

    await deps.followUser.execute(request.userId, followeeId)

    return reply.status(201).send()
  })

  app.delete('/follows/:followeeId', { preHandler: deps.authenticate }, async (request, reply) => {
    const { followeeId } = request.params as { followeeId: string }

    await deps.unfollowUser.execute(request.userId, followeeId)

    return reply.status(204).send()
  })

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
