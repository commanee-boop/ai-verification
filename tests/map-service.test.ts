import { afterEach, describe, expect, it, vi } from 'vitest'
import { groundReferenceHeight, mapRequest } from '../src/services/mapService'
afterEach(() => vi.useRealTimers())
describe('Online map failure handling', () => {
  it('bounds an unresponsive service request without accepting a late success', async () => {
    vi.useFakeTimers()
    let finish: (value: string) => void = () => {}
    const pending = new Promise<string>(resolve => { finish = resolve })
    const request = mapRequest(pending)
    const rejected = expect(request).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(20000)
    await rejected
    finish('late provider')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('clears its timeout after a service returns or rejects', async () => {
    vi.useFakeTimers()
    expect(await mapRequest(Promise.resolve('provider'))).toBe('provider')
    await expect(mapRequest(Promise.reject(new Error('offline')))).rejects.toThrow('offline')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('keeps unavailable terrain heights unknown, including invalid samples', () => {
    expect(groundReferenceHeight(true, undefined)).toBeUndefined()
    expect(groundReferenceHeight(true, NaN)).toBeUndefined()
    expect(groundReferenceHeight(true, -15)).toBe(-15)
    expect(groundReferenceHeight(false, 999)).toBe(0)
  })
})
