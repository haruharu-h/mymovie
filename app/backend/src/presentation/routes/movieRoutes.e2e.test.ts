import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../buildApp.js'
import { makeAuthenticate } from '../middleware/authenticate.js'
import { SearchMovies } from '../../application/movie/SearchMovies.js'
import { RegisterMovie } from '../../application/movie/RegisterMovie.js'
import { GetMovieDetail } from '../../application/movie/GetMovieDetail.js'
import { Movie } from '../../domain/movie/Movie.js'
import { Review } from '../../domain/review/Review.js'
import { Score } from '../../domain/review/Score.js'
import { User } from '../../domain/user/User.js'
import type { IMovieRepository } from '../../domain/movie/IMovieRepository.js'
import type { IReviewRepository } from '../../domain/review/IReviewRepository.js'
import type { TmdbApiClient, TmdbMovie } from '../../infrastructure/external/TmdbApiClient.js'
import type { JwtService } from '../../application/shared/JwtService.js'
import type { Logger } from 'pino'

describe('movieRoutes (E2E)', () => {
  let movieRepository: jest.Mocked<IMovieRepository>
  let reviewRepository: jest.Mocked<IReviewRepository>
  let tmdbApiClient: jest.Mocked<TmdbApiClient>
  let jwtService: jest.Mocked<JwtService>
  let logger: jest.Mocked<Logger>
  let app: FastifyInstance

  const authHeader = { authorization: 'Bearer valid-token' }

  beforeEach(() => {
    movieRepository = {
      findById: jest.fn<IMovieRepository['findById']>(),
      save: jest.fn<IMovieRepository['save']>(),
    }
    reviewRepository = {
      findAllByUserId: jest.fn<IReviewRepository['findAllByUserId']>(),
      findAllByMovieId: jest.fn<IReviewRepository['findAllByMovieId']>(),
      findById: jest.fn<IReviewRepository['findById']>(),
      save: jest.fn<IReviewRepository['save']>(),
      update: jest.fn<IReviewRepository['update']>(),
      delete: jest.fn<IReviewRepository['delete']>(),
    }
    tmdbApiClient = {
      searchMovies: jest.fn<TmdbApiClient['searchMovies']>(),
      findById: jest.fn<TmdbApiClient['findById']>(),
    } as unknown as jest.Mocked<TmdbApiClient>
    jwtService = {
      generateAccessToken: jest.fn<JwtService['generateAccessToken']>(),
      verifyAccessToken: jest.fn<JwtService['verifyAccessToken']>(),
      hashToken: jest.fn<JwtService['hashToken']>(),
    } as unknown as jest.Mocked<JwtService>
    jwtService.verifyAccessToken.mockResolvedValue({ userId: 'user-1' })
    logger = { info: jest.fn() } as unknown as jest.Mocked<Logger>

    app = buildApp(
      {
        movie: {
          searchMovies: new SearchMovies(tmdbApiClient),
          registerMovie: new RegisterMovie(movieRepository, tmdbApiClient, logger),
          getMovieDetail: new GetMovieDetail(movieRepository, reviewRepository),
          authenticate: makeAuthenticate(jwtService),
        },
      },
      { logger: false },
    )
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /movies/search', () => {
    it('q が無ければ 400', async () => {
      const res = await app.inject({ method: 'GET', url: '/movies/search', headers: authHeader })

      expect(res.statusCode).toBe(400)
    })

    it('q があれば検索結果を返す', async () => {
      const tmdbMovie: TmdbMovie = { id: '603', title: 'The Matrix', posterPath: '/x.jpg', releaseDate: '1999-03-31' }
      tmdbApiClient.searchMovies.mockResolvedValue([tmdbMovie])

      const res = await app.inject({ method: 'GET', url: '/movies/search?q=matrix', headers: authHeader })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ movies: [tmdbMovie] })
    })
  })

  describe('POST /movies', () => {
    it('新規登録なら 201 で保存される', async () => {
      const tmdbMovie: TmdbMovie = { id: '603', title: 'The Matrix', posterPath: '/x.jpg', releaseDate: '1999-03-31' }
      movieRepository.findById.mockResolvedValue(null)
      tmdbApiClient.findById.mockResolvedValue(tmdbMovie)

      const res = await app.inject({
        method: 'POST',
        url: '/movies',
        headers: authHeader,
        payload: { tmdbId: '603' },
      })

      expect(res.statusCode).toBe(201)
      expect(movieRepository.save).toHaveBeenCalledTimes(1)
    })

    it('登録済みなら 201 のまま TMDB 呼び出し・保存はしない', async () => {
      const existing = new Movie('603', 'The Matrix', '/x.jpg', '1999-03-31', new Date())
      movieRepository.findById.mockResolvedValue(existing)

      const res = await app.inject({
        method: 'POST',
        url: '/movies',
        headers: authHeader,
        payload: { tmdbId: '603' },
      })

      expect(res.statusCode).toBe(201)
      expect(tmdbApiClient.findById).not.toHaveBeenCalled()
      expect(movieRepository.save).not.toHaveBeenCalled()
    })

    it('TMDBに存在しなければ 404', async () => {
      movieRepository.findById.mockResolvedValue(null)
      tmdbApiClient.findById.mockResolvedValue(null)

      const res = await app.inject({
        method: 'POST',
        url: '/movies',
        headers: authHeader,
        payload: { tmdbId: 'unknown' },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({ message: '映画が見つかりませんでした' })
    })
  })

  describe('GET /movies/:tmdbId', () => {
    it('見つかれば movie/averageScore/reviews の形で 200', async () => {
      const movie = new Movie('603', 'The Matrix', '/x.jpg', '1999-03-31', new Date())
      const review = new Review('review-1', 'user-1', '603', Score.create(4.5), new Date('2026-01-01'))
      const user = new User('user-1', 'Alice', null, null, null, new Date())
      movieRepository.findById.mockResolvedValue(movie)
      reviewRepository.findAllByMovieId.mockResolvedValue([{ review, user }])

      const res = await app.inject({ method: 'GET', url: '/movies/603', headers: authHeader })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        movie: { id: '603', title: 'The Matrix', posterPath: '/x.jpg', releaseDate: '1999-03-31' },
        averageScore: 5,
        reviews: [
          {
            id: 'review-1',
            score: 4.5,
            registeredAt: review.registeredAt.toISOString(),
            user: { id: 'user-1', name: 'Alice' },
          },
        ],
      })
    })

    it('見つからなければ 404', async () => {
      movieRepository.findById.mockResolvedValue(null)

      const res = await app.inject({ method: 'GET', url: '/movies/999', headers: authHeader })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({ message: '映画が見つかりません' })
    })
  })
})
