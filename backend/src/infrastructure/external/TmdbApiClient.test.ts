import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { TmdbApiClient } from './TmdbApiClient.js'

describe('TmdbApiClient', () => {
  describe('constructor', () => {
    const original = process.env.TMDB_READ_ACCESS_TOKEN

    afterEach(() => {
      process.env.TMDB_READ_ACCESS_TOKEN = original
    })

    it('TMDB_READ_ACCESS_TOKEN が未設定なら Error を投げる', () => {
      delete process.env.TMDB_READ_ACCESS_TOKEN
      expect(() => new TmdbApiClient()).toThrow(Error)
    })
  })

  describe('searchMovies', () => {
    beforeEach(() => {
      process.env.TMDB_READ_ACCESS_TOKEN = 'test-token'
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('正しいURL・Authorizationヘッダーでfetchを呼び、poster_pathがnullなら空文字にフォールバックして整形する', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        json: async () => ({
          results: [
            { id: 603, title: 'The Matrix', poster_path: '/x.jpg', release_date: '1999-03-31' },
            { id: 604, title: 'No Poster', poster_path: null, release_date: '2000-01-01' },
          ],
        }),
      } as Response)

      const client = new TmdbApiClient()
      const result = await client.searchMovies('matrix')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/search/movie?query=matrix&language=ja-JP',
        { headers: { Authorization: 'Bearer test-token' } },
      )
      expect(result).toEqual([
        { id: '603', title: 'The Matrix', posterPath: '/x.jpg', releaseDate: '1999-03-31' },
        { id: '604', title: 'No Poster', posterPath: '', releaseDate: '2000-01-01' },
      ])
    })
  })

  describe('findById', () => {
    beforeEach(() => {
      process.env.TMDB_READ_ACCESS_TOKEN = 'test-token'
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('正しいURL・Authorizationヘッダーでfetchを呼び、見つかれば整形して返す', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ id: 603, title: 'The Matrix', poster_path: '/x.jpg', release_date: '1999-03-31' }),
      } as Response)

      const client = new TmdbApiClient()
      const result = await client.findById('603')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/movie/603?language=ja-JP',
        { headers: { Authorization: 'Bearer test-token' } },
      )
      expect(result).toEqual({ id: '603', title: 'The Matrix', posterPath: '/x.jpg', releaseDate: '1999-03-31' })
    })

    it('404（本当に存在しない）なら null を返す', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 404 } as Response)

      const client = new TmdbApiClient()
      const result = await client.findById('unknown')

      expect(result).toBeNull()
    })

    it('404以外の非成功レスポンス（レート制限・障害等）は Error を投げ、null と区別する', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 429 } as Response)

      const client = new TmdbApiClient()

      await expect(client.findById('603')).rejects.toThrow(Error)
    })
  })
})
