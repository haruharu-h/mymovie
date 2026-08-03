import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { SearchUsers } from '../../application/user/SearchUsers.js'
import type { GetCurrentUser } from '../../application/user/GetCurrentUser.js'
import type { UpdateUserProfile } from '../../application/user/UpdateUserProfile.js'

// user ルートが必要とするユースケースの束
export type UserRouteDeps = {
  getCurrentUser: GetCurrentUser
  searchUsers: SearchUsers
  updateUserProfile: UpdateUserProfile
  authenticate: preHandlerHookHandler
}

export async function userRoutes(app: FastifyInstance, deps: UserRouteDeps) {
  app.get('/users/me', { preHandler: deps.authenticate }, async (request, reply) => {
    const user = await deps.getCurrentUser.execute(request.userId)
    return reply.send({
      id: user.id,
      name: user.name,
      email: user.email,
      birthdate: user.birthdate,
      snsUrl: user.snsUrl,
    })
  })

  app.get('/users/search', { preHandler: deps.authenticate }, async (request, reply) => {
    const { q } = request.query as { q?: string }

    if (!q) {
      return reply.status(400).send({ message: '検索キーワードを入力してください' })
    }

    const users = await deps.searchUsers.execute(q)

    return reply.send({
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        birthdate: user.birthdate,
      })),
    })
  })

  app.patch('/users/me', { preHandler: deps.authenticate }, async (request, reply) => {
    const { name, birthdate, snsUrl } = request.body as {
      name: string
      birthdate: string | null
      snsUrl: string | null
    }

    if (!name || name.trim() === '') {
      return reply.status(400).send({ message: '名前を入力してください' })
    }

    await deps.updateUserProfile.execute({
      userId: request.userId,
      name: name.trim(),
      birthdate: birthdate ?? null,
      snsUrl: snsUrl ?? null,
    })

    return reply.status(204).send()
  })
}
