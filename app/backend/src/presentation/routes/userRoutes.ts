import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { SearchUsers } from '../../application/user/SearchUsers.js'
import type { GetCurrentUser } from '../../application/user/GetCurrentUser.js'
import type { UpdateUserProfile } from '../../application/user/UpdateUserProfile.js'

// qの型チェックのみを担う（未指定時の具体的な日本語メッセージはルート側の分岐に残す）
const SearchUsersQuerySchema = z.object({
  q: z.string().optional(),
})

// name/birthdate/snsUrlの型チェックのみを担う（未指定・空白のみの場合の具体的な日本語メッセージは
// User側にバリューオブジェクトが無いため、このルート側の分岐に残す）
const UpdateProfileBodySchema = z.object({
  name: z.string().optional(),
  birthdate: z.string().nullable().optional(),
  snsUrl: z.string().nullable().optional(),
})

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

  app.withTypeProvider<ZodTypeProvider>().get(
    '/users/search',
    { preHandler: deps.authenticate, schema: { querystring: SearchUsersQuerySchema } },
    async (request, reply) => {
      const { q } = request.query

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
    },
  )

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/users/me',
    { preHandler: deps.authenticate, schema: { body: UpdateProfileBodySchema } },
    async (request, reply) => {
      const { name, birthdate, snsUrl } = request.body

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
    },
  )
}
