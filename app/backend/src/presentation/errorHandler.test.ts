import { describe, it, expect, jest } from '@jest/globals'
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { errorHandler } from './errorHandler.js'
import { AppError } from '../domain/shared/AppError.js'

const buildReply = () => {
  const reply = {
    status: jest.fn(),
    send: jest.fn(),
  } as unknown as FastifyReply
  ;(reply.status as jest.Mock).mockReturnValue(reply)
  return reply
}

const buildRequest = () =>
  ({
    log: { error: jest.fn(), warn: jest.fn() },
  }) as unknown as FastifyRequest

describe('errorHandler', () => {
  it('AppError なら statusCode と message をそのまま返し、WARNでログに残す', () => {
    const reply = buildReply()
    const request = buildRequest()
    const error = new AppError('無効なメールアドレスです', 400) as unknown as FastifyError

    errorHandler(error, request, reply)

    expect(reply.status).toHaveBeenCalledWith(400)
    expect(reply.send).toHaveBeenCalledWith({ message: '無効なメールアドレスです' })
    expect(request.log.warn).toHaveBeenCalledWith({ statusCode: 400 }, '無効なメールアドレスです')
  })

  it('AppError に context があれば、ログにその内容も含める', () => {
    const reply = buildReply()
    const request = buildRequest()
    const error = new AppError('映画が見つかりませんでした', 404, { tmdbId: '999' }) as unknown as FastifyError

    errorHandler(error, request, reply)

    expect(request.log.warn).toHaveBeenCalledWith({ statusCode: 404, tmdbId: '999' }, '映画が見つかりませんでした')
  })

  // Zodバリデーション失敗時の400化は movieRoutes.e2e.test.ts で実際のFastify+Zodの組み合わせとして検証済み
  // （hasZodFastifySchemaValidationErrorsの判定に使うシンボルがパッケージの内部専用でここから作れないため）

  it('Fastify組み込みの4xxエラーなら その statusCode で返し、WARNでログに残す', () => {
    const reply = buildReply()
    const request = buildRequest()
    const error = { statusCode: 400, message: 'FST_ERR_CTP_INVALID_MEDIA_TYPE' } as FastifyError

    errorHandler(error, request, reply)

    expect(reply.status).toHaveBeenCalledWith(400)
    expect(reply.send).toHaveBeenCalledWith({ message: 'FST_ERR_CTP_INVALID_MEDIA_TYPE' })
    expect(request.log.warn).toHaveBeenCalledWith({ statusCode: 400 }, 'FST_ERR_CTP_INVALID_MEDIA_TYPE')
  })

  it('想定外のエラーなら 500 + 汎用メッセージ + ログ出力', () => {
    const reply = buildReply()
    const request = buildRequest()
    const error = new Error('DB接続失敗') as FastifyError

    errorHandler(error, request, reply)

    expect(reply.status).toHaveBeenCalledWith(500)
    expect(reply.send).toHaveBeenCalledWith({ message: 'サーバーエラーが発生しました' })
    expect(request.log.error).toHaveBeenCalledWith(error)
  })
})
