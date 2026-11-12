import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({
  fetchSeasonPhase: vi.fn(),
  fetchSeasonRound: vi.fn(),
  fetchMatchReportWithMetadata: vi.fn(),
}))

vi.mock('../../services/threeKDartsApi', () => {
  class ThreeKDartsApiError extends Error {
    category = 'Sonstiger Fehler' as const
  }
  return { ...api, ThreeKDartsApiError }
})

import { fetchSeasonRound } from '../../services/threeKDartsApi'
import { getAvailableSeasons } from '../../services/seasonConfig'
import { useMatchReportsStore } from '../../stores/matchReports'

const h1 = getAvailableSeasons(new Date(2026, 10, 1)).find(({ key }) => key === '2026-1')!

function roundResponse(roundId: number) {
  return {
    matches: [{
      id: roundId + 1000,
      participantHome: { id: h1.participantId },
      participantGuest: { id: 900000 + roundId },
    }],
  }
}

describe('match report round loading resilience', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    api.fetchSeasonPhase.mockReset().mockImplementation(async () => ({
      rounds: Array.from({ length: 14 }, (_, index) => ({ id: index + 1 })),
    }))
    api.fetchSeasonRound.mockReset().mockImplementation(async (_eventId: number, _phaseId: number, roundId: number) =>
      roundResponse(roundId),
    )
    api.fetchMatchReportWithMetadata.mockReset().mockImplementation(async (_eventId: number, matchId: number) => ({
      data: [{ matchId }],
      httpStatus: 200,
      contentType: 'application/json',
      byteLength: 1,
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function load(): Promise<ReturnType<typeof useMatchReportsStore>> {
    const store = useMatchReportsStore()
    const promise = store.loadReports(h1)
    await vi.runAllTimersAsync()
    await promise
    return store
  }

  it('retries a failed round once, then succeeds without repeating successful rounds', async () => {
    const calls = new Map<number, number>()
    api.fetchSeasonRound.mockImplementation(async (_eventId: number, _phaseId: number, roundId: number) => {
      const count = (calls.get(roundId) ?? 0) + 1
      calls.set(roundId, count)
      if (roundId === 1 && count === 1) throw new TypeError('transient network error')
      return roundResponse(roundId)
    })

    const store = await load()

    expect(calls.get(1)).toBe(2)
    expect([...calls.entries()].filter(([roundId]) => roundId !== 1).every(([, count]) => count === 1)).toBe(true)
    expect(store.successfulRoundCountsBySeason[h1.key]).toBe(14)
    expect(store.failedRoundCountsBySeason[h1.key]).toBe(0)
    expect(store.loadedReportCounts[h1.key]).toBe(14)
  })

  it('keeps a round error after three attempts while counting other rounds and reports', async () => {
    const calls = new Map<number, number>()
    api.fetchSeasonRound.mockImplementation(async (_eventId: number, _phaseId: number, roundId: number) => {
      const count = (calls.get(roundId) ?? 0) + 1
      calls.set(roundId, count)
      if (roundId === 1) throw new TypeError('persistent network error')
      return roundResponse(roundId)
    })

    const store = await load()

    expect(calls.get(1)).toBe(3)
    expect([...calls.entries()].filter(([roundId]) => roundId !== 1).every(([, count]) => count === 1)).toBe(true)
    expect(store.roundErrorsBySeason[h1.key]).toEqual([
      'Runde 1: persistent network error',
    ])
    expect(store.successfulRoundCountsBySeason[h1.key]).toBe(13)
    expect(store.failedRoundCountsBySeason[h1.key]).toBe(1)
    expect(store.loadedReportCounts[h1.key]).toBe(13)
    expect(store.progressPercentsBySeason[h1.key]).toBe(100)
    expect(store.matchIdsBySeason[h1.key]).not.toContain(1001)
  })

  it('limits simultaneous round requests to two', async () => {
    let activeRequests = 0
    let maximumActiveRequests = 0
    api.fetchSeasonRound.mockImplementation(async (_eventId: number, _phaseId: number, roundId: number) => {
      activeRequests += 1
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests)
      await new Promise((resolve) => globalThis.setTimeout(resolve, 25))
      activeRequests -= 1
      return roundResponse(roundId)
    })

    await load()

    expect(maximumActiveRequests).toBe(2)
  })

  it('retries failed rounds on a later load and reuses successful match reports', async () => {
    let shouldFail = true
    api.fetchSeasonRound.mockImplementation(async (_eventId: number, _phaseId: number, roundId: number) => {
      if (roundId === 1 && shouldFail) throw new TypeError('temporary failure')
      return roundResponse(roundId)
    })
    const store = useMatchReportsStore()
    const firstLoad = store.loadReports(h1)
    await vi.runAllTimersAsync()
    await firstLoad
    const reportCallsAfterFirstLoad = api.fetchMatchReportWithMetadata.mock.calls.length
    const roundCallsAfterFirstLoad = api.fetchSeasonRound.mock.calls.length
    expect(store.failedRoundCountsBySeason[h1.key]).toBe(1)

    shouldFail = false
    const secondLoad = store.loadReports(h1)
    await vi.runAllTimersAsync()
    await secondLoad

    expect(store.failedRoundCountsBySeason[h1.key]).toBe(0)
    expect(store.loadedReportCounts[h1.key]).toBe(14)
    expect(api.fetchSeasonRound).toHaveBeenCalledTimes(roundCallsAfterFirstLoad + 1)
    expect(api.fetchMatchReportWithMetadata).toHaveBeenCalledTimes(reportCallsAfterFirstLoad + 1)
    expect(api.fetchMatchReportWithMetadata).toHaveBeenCalledWith(h1.eventId, 1001)
  })

  it('does not start duplicate parallel loads for the same season', async () => {
    const store = useMatchReportsStore()
    const firstLoad = store.loadReports(h1)
    const secondLoad = store.loadReports(h1)
    await vi.runAllTimersAsync()
    await Promise.all([firstLoad, secondLoad])

    expect(api.fetchSeasonPhase).toHaveBeenCalledTimes(1)
    expect(fetchSeasonRound).toHaveBeenCalledTimes(14)
    expect(store.loadedReportCounts[h1.key]).toBe(14)
  })
})
