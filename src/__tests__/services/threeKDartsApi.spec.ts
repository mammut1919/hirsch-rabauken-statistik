import { describe, expect, it } from 'vitest'
import {
  fetchSeasonParticipant,
  fetchSeasonTable,
  getSeasonParticipantUrl,
  getSeasonTableUrl,
} from '../../services/threeKDartsApi'

describe('season participant endpoints', () => {
  it('keeps the H1 endpoint and uses the official H2 endpoint', () => {
    expect(getSeasonParticipantUrl(39389, 527581)).toBe(
      'https://backend-dsab.3k-darts.com/2k-backend-dsab/api/v1/frontend/participant/527581',
    )
    expect(getSeasonParticipantUrl(40293, 682469)).toBe(
      'https://backend-dsab.3k-darts.com/2k-backend-dsab/api/v1/frontend/events/9/event/40293/participants/682469',
    )
  })

  it('falls back to the existing H2 participant route only when the official route returns 404', async () => {
    const requestedUrls: string[] = []
    const fetcher: typeof fetch = async (input) => {
      const url = String(input)
      requestedUrls.push(url)
      if (requestedUrls.length === 1) return new Response('', { status: 404 })
      return new Response(JSON.stringify({ participant: { teamSeason: { teamMembers: [] } } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    await expect(fetchSeasonParticipant(682469, 40293, fetcher)).resolves.toEqual({
      participant: { teamSeason: { teamMembers: [] } },
    })
    expect(requestedUrls).toEqual([
      getSeasonParticipantUrl(40293, 682469),
      'https://backend-dsab.3k-darts.com/2k-backend-dsab/api/v1/frontend/participant/682469',
    ])
  })
})

describe('season table endpoints', () => {
  const response = (teamId: number) => ({
    tableEntries: [{
      tableEntries: Array.from({ length: 8 }, (_, index) => ({
        placement: index + 1,
        participantName: index === 0 ? 'Hirsch-Rabauken' : `Team ${index + 1}`,
        participantId: index === 0 ? teamId : 700000 + index,
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
      })),
    }],
  })

  it('uses the shared table endpoint shape for H1 and H2', async () => {
    const requestedUrls: string[] = []
    const fetcher: typeof fetch = async (input) => {
      const url = String(input)
      requestedUrls.push(url)
      const payload = response(url.includes('/event/40293/') ? 682469 : 527581)
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    await expect(fetchSeasonTable(39389, fetcher)).resolves.toEqual(response(527581))
    await expect(fetchSeasonTable(40293, fetcher)).resolves.toEqual(response(682469))
    expect(requestedUrls).toEqual([getSeasonTableUrl(39389), getSeasonTableUrl(40293)])
    expect(requestedUrls).toEqual([
      'https://backend-dsab.3k-darts.com/2k-backend-dsab/api/v1/frontend/event/39389/phase/0/round/0/table',
      'https://backend-dsab.3k-darts.com/2k-backend-dsab/api/v1/frontend/event/40293/phase/0/round/0/table',
    ])
  })

  it('rejects a non-object table response', async () => {
    const fetcher: typeof fetch = async () => new Response('[]', { status: 200 })
    await expect(fetchSeasonTable(39389, fetcher)).rejects.toThrow(
      'Die Ranglistenabfrage lieferte kein JSON-Objekt.',
    )
  })
})
