import { describe, it, expect } from '@jest/globals'
import { isAlreadyProcessed, PROCESSED_METADATA_KEY } from './selfCheckGuard.js'

describe('isAlreadyProcessed', () => {
  it('処理済みの印が付いていればtrueを返す', () => {
    expect(isAlreadyProcessed({ [PROCESSED_METADATA_KEY]: 'true' })).toBe(true)
  })

  it('メタデータが無ければfalseを返す', () => {
    expect(isAlreadyProcessed(undefined)).toBe(false)
  })

  it('印が無い・別の値ならfalseを返す', () => {
    expect(isAlreadyProcessed({})).toBe(false)
    expect(isAlreadyProcessed({ [PROCESSED_METADATA_KEY]: 'false' })).toBe(false)
    expect(isAlreadyProcessed({ other: 'true' })).toBe(false)
  })
})
