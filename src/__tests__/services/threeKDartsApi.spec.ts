import { describe, expect, it } from 'vitest'
import { fetchSeasonParticipant, getSeasonParticipantUrl } from '../../services/threeKDartsApi'

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
