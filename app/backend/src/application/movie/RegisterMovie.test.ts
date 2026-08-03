import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { RegisterMovie } from './RegisterMovie.js'
import { Movie } from '../../domain/movie/Movie.js'
import { AppError } from '../../domain/shared/AppError.js'
import type { IMovieRepository } from '../../domain/movie/IMovieRepository.js'
import type { TmdbApiClient, TmdbMovie } from '../../infrastructure/external/TmdbApiClient.js'

describe('RegisterMovie', () => {
  let movieRepository: jest.Mocked<IMovieRepository>
  let tmdbApiClient: jest.Mocked<TmdbApiClient>
  let registerMovie: RegisterMovie

  beforeEach(() => {
    movieRepository = {
      findById: jest.fn<IMovieRepository['findById']>(),
      save: jest.fn<IMovieRepository['save']>(),
    }
    tmdbApiClient = {
      searchMovies: jest.fn<TmdbApiClient['searchMovies']>(),
      findById: jest.fn<TmdbApiClient['findById']>(),
    } as unknown as jest.Mocked<TmdbApiClient>
    registerMovie = new RegisterMovie(movieRepository, tmdbApiClient)
  })

  it('既に登録済みなら何もしない（TMDb も叩かない・保存もしない）', async () => {
    movieRepository.findById.mockResolvedValue(
      new Movie('1', 'A', '', '2020-01-01', new Date()),
    )

    await registerMovie.execute('1')

    expect(tmdbApiClient.findById).not.toHaveBeenCalled()
    expect(movieRepository.save).not.toHaveBeenCalled()
  })

  it('未登録で TMDb にも無ければ AppError(404)、保存しない', async () => {
    movieRepository.findById.mockResolvedValue(null)
    tmdbApiClient.findById.mockResolvedValue(null)

    expect.assertions(3)
    try {
      await registerMovie.execute('1')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(404)
    }
    expect(movieRepository.save).not.toHaveBeenCalled()
  })

  it('未登録で TMDb に在れば Movie を保存する', async () => {
    movieRepository.findById.mockResolvedValue(null)
    tmdbApiClient.findById.mockResolvedValue({
      id: '1', title: 'A', posterPath: '/p.jpg', releaseDate: '2020-01-01',
    } as TmdbMovie)

    await registerMovie.execute('1')

    expect(movieRepository.save).toHaveBeenCalledTimes(1)
    const saved = movieRepository.save.mock.calls[0][0]
    expect(saved.id).toBe('1')
    expect(saved.title).toBe('A')
    expect(saved.posterPath).toBe('/p.jpg')
  })
})
