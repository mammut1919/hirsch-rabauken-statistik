import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({ fetchSeasonTable: vi.fn() }))
vi.mock('../../services/threeKDartsApi', () => ({ ...api }))

import { getAvailableSeasons } from '../../services/seasonConfig'
import { useTeamStandingsStore } from '../../stores/teamStandings'
import type { ThreeKDartsTableResponse } from '../../services/threeKDartsApi'

const seasons = getAvailableSeasons(new Date(2026, 10, 1))
const h1 = seasons.find(({ key }) => key === '2026-1')!
const h2 = seasons.find(({ key }) => key === '2026-2')!

const row = (participantName: string, participantId = 1) => ({
  placement: 1,
  participantName,
  participantId,
  matchCount: 14,
  win: 9,
  lost: 5,
  tie: 0,
  points1: 18,
  points2: 10,
  sets1: 31,
  sets2: 22,
  legs1: 140,
  legs2: 119,
})

describe('season team standings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    api.fetchSeasonTable.mockReset()
  })

  afterEach(() => vi.restoreAllMocks())

  it('keeps H1 and H2 standings in separate caches', async () => {
    api.fetchSeasonTable.mockImplementation(async (eventId: number) => ({
      tableEntries: [{
        tableEntries: [row(
          eventId === h1.eventId ? 'H1 Team' : 'H2 Team',
          eventId === h1.eventId ? 527581 : 682469,
        )],
      }],
    }))
    const store = useTeamStandingsStore()

    await store.loadStandingsForSeasons([h1, h2])

    expect(store.standingsBySeason[h1.key]?.[0]?.participantName).toBe('H1 Team')
    expect(store.standingsBySeason[h2.key]?.[0]?.participantName).toBe('H2 Team')
    expect(api.fetchSeasonTable).toHaveBeenCalledTimes(2)
    expect(api.fetchSeasonTable).toHaveBeenNthCalledWith(1, h1.eventId)
    expect(api.fetchSeasonTable).toHaveBeenNthCalledWith(2, h2.eventId)
  })

  it('prevents duplicate parallel requests and reuses a completed cache', async () => {
    let resolveRequest!: (value: ThreeKDartsTableResponse) => void
    api.fetchSeasonTable.mockImplementation(
      () => new Promise((resolve) => { resolveRequest = resolve }),
    )
    const store = useTeamStandingsStore()
    const first = store.loadStandings(h1)
    const second = store.loadStandings(h1)
    expect(api.fetchSeasonTable).toHaveBeenCalledTimes(1)

    resolveRequest({ tableEntries: [{ tableEntries: [row('H1 Team', 527581)] }] })
    await Promise.all([first, second])
    await store.loadStandings(h1)
    expect(api.fetchSeasonTable).toHaveBeenCalledTimes(1)
  })

  it('retains an error after failure and clears it only after a successful retry', async () => {
    api.fetchSeasonTable.mockRejectedValueOnce(new Error('Netzwerkfehler'))
    const store = useTeamStandingsStore()

    await store.loadStandings(h1)
    expect(store.errorsBySeason[h1.key]).toBe('Netzwerkfehler')
    expect(store.standingsBySeason[h1.key]).toBeUndefined()

    api.fetchSeasonTable.mockResolvedValueOnce({
      tableEntries: [{ tableEntries: [row('H1 Team', 527581)] }],
    })
    await store.loadStandings(h1)
    expect(store.errorsBySeason[h1.key]).toBeUndefined()
    expect(store.standingsBySeason[h1.key]?.[0]?.participantName).toBe('H1 Team')
  })
})
