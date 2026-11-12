import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../services/threeKDartsApi', () => {
  class ThreeKDartsApiError extends Error {
    category = 'Sonstiger Fehler' as const
    httpStatus?: number
    originalErrorName?: string
  }

  return {
    ThreeKDartsApiError,
    fetchSeasonPhase: vi.fn(async () => ({
      rounds: Array.from({ length: 14 }, (_, index) => ({ id: index + 1 })),
    })),
    fetchSeasonRound: vi.fn(async (eventId: number, _phaseId: number, roundId: number) => ({
      matches: [
        {
          id: roundId + 1000,
          participantHome: { id: eventId === 39389 ? 527581 : 682469 },
          participantGuest: { id: 900000 + roundId },
        },
        {
          id: roundId + 2000,
          participantHome: { id: 900000 + roundId },
          participantGuest: { id: 800000 + roundId },
        },
      ],
    })),
    fetchMatchReportWithMetadata: vi.fn(async (eventId: number, matchId: number) => ({
      data: [{ eventId, matchId }],
      httpStatus: 200,
      contentType: 'application/json',
      byteLength: 1,
    })),
  }
})

import { fetchMatchReportWithMetadata } from '../../services/threeKDartsApi'
import { getAvailableSeasons } from '../../services/seasonConfig'
import { useMatchReportsStore } from '../../stores/matchReports'

describe('seasonal match report caches', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads 14 team matches per half-year without cache collisions', async () => {
    const store = useMatchReportsStore()
    const seasons = getAvailableSeasons(new Date(2026, 10, 1)).filter(({ key }) =>
      key === '2026-1' || key === '2026-2',
    )
    const loadPromise = store.loadReports(seasons)
    await vi.runAllTimersAsync()
    await loadPromise

    expect(store.matchIdsBySeason['2026-1']).toEqual(
      Array.from({ length: 14 }, (_, index) => index + 1001),
    )
    expect(store.matchIdsBySeason['2026-2']).toEqual(
      Array.from({ length: 14 }, (_, index) => index + 1001),
    )
    expect(store.loadedReportCounts).toMatchObject({ '2026-1': 14, '2026-2': 14 })
    expect(store.reportsBySeason['2026-1'][1001]).toEqual([{ eventId: 39389, matchId: 1001 }])
    expect(store.reportsBySeason['2026-2'][1001]).toEqual([{ eventId: 40293, matchId: 1001 }])
    expect(fetchMatchReportWithMetadata).toHaveBeenCalledTimes(28)
  })
})
