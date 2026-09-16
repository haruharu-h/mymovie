import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { SearchMovies } from './SearchMovies.js'
import type { TmdbApiClient, TmdbMovie } from '../../infrastructure/external/TmdbApiClient.js'

describe('SearchMovies', () => {
  let tmdbApiClient: jest.Mocked<TmdbApiClient>
  let searchMovies: SearchMovies

  beforeEach(() => {
    tmdbApiClient = {
      searchMovies: jest.fn<TmdbApiClient['searchMovies']>(),
      findById: jest.fn<TmdbApiClient['findById']>(),
    } as unknown as jest.Mocked<TmdbApiClient>
    searchMovies = new SearchMovies(tmdbApiClient)
  })

  it('空白のみのクエリは API を叩かず空配列を返す', async () => {
    const result = await searchMovies.execute('   ')
    expect(result).toEqual([])
    expect(tmdbApiClient.searchMovies).not.toHaveBeenCalled()
  })

  it('クエリがあれば TMDb に委譲して結果を返す', async () => {
    const movies = [{ id: '1', title: 'A', posterPath: '', releaseDate: '2020-01-01' }] as TmdbMovie[]
    tmdbApiClient.searchMovies.mockResolvedValue(movies)

    const result = await searchMovies.execute('matrix')

    expect(tmdbApiClient.searchMovies).toHaveBeenCalledWith('matrix')
    expect(result).toBe(movies)
  })
})
