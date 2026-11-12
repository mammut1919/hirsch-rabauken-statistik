import { describe, expect, it } from 'vitest'
import { getAvailableSeasons } from '../../services/seasonConfig'
import { getTeamMatchIds } from '../../services/teamMatches'

describe('getTeamMatchIds', () => {
  const h1 = getAvailableSeasons(new Date(2026, 5, 1)).find(({ key }) => key === '2026-1')!
  const h2 = getAvailableSeasons(new Date(2026, 10, 1)).find(({ key }) => key === '2026-2')!

  it('berücksichtigt Heim- und Auswärtsspiele, aber keine Begegnungen ohne Team', () => {
    expect(
      getTeamMatchIds(
        {
          matches: [
            { id: 1, participantHome: { id: 527581 }, participantGuest: { id: 100 } },
            { id: 2, participantHome: { id: 101 }, participantGuest: { id: 527581 } },
            { id: 3, participantHome: { id: 101 }, participantGuest: { id: 102 } },
          ],
        },
        527581,
      ),
    ).toEqual([1, 2])
  })

  it('lädt in H1 2026 nur die 14 Begegnungen mit der H1-Teamteilnehmer-ID', () => {
    expect(h1).toMatchObject({ eventId: 39389, phaseId: 3010, participantId: 527581 })
    const matches = Array.from({ length: 16 }, (_, index) => ({
      id: index + 1,
      participantHome: { id: index < 7 ? 527581 : 800000 },
      participantGuest: { id: index >= 7 && index < 14 ? 527581 : 800001 },
    }))

    expect(getTeamMatchIds({ matches }, h1.participantId!)).toHaveLength(14)
  })

  it('lädt in H2 2026 nur die 14 Begegnungen mit der H2-Teamteilnehmer-ID', () => {
    expect(h2).toMatchObject({ eventId: 40293, phaseId: 3989, participantId: 682469 })
    const matches = Array.from({ length: 16 }, (_, index) => ({
      id: index + 101,
      participantHome: { id: index < 7 ? 682469 : 800000 },
      participantGuest: { id: index >= 7 && index < 14 ? 682469 : 800001 },
    }))

    expect(getTeamMatchIds({ matches }, h2.participantId!)).toHaveLength(14)
  })
})
