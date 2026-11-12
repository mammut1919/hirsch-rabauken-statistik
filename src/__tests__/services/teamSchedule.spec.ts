import { describe, expect, it } from 'vitest'
import { normalizeSeasonTeamMatches } from '../../services/teamSchedule'
import type { ThreeKDartsParticipantResponse } from '../../services/threeKDartsApi'

function makeMatches(participantId: number, startId: number, finishedCount: number) {
  return Array.from({ length: 14 }, (_, index) => {
    const teamIsHome = index % 2 === 0
    const statusCd = index < finishedCount ? 'FINISH' : 'OPEN'
    return {
      id: startId + index,
      datePlanned: `2026-10-${String(index + 1).padStart(2, '0')}T15:00:00.000+0000`,
      participantHome: {
        id: teamIsHome ? participantId : 900000 + index,
        displayName: teamIsHome ? 'Hirsch-Rabauken' : `Gegner ${index + 1}`,
      },
      participantGuest: {
        id: teamIsHome ? 900000 + index : participantId,
        displayName: teamIsHome ? `Gegner ${index + 1}` : 'Hirsch-Rabauken',
      },
      statusCd,
      setsHome: statusCd === 'FINISH' ? 10 : null,
      setsAway: statusCd === 'FINISH' ? 8 : null,
      legsHome: statusCd === 'FINISH' ? 22 : null,
      legsAway: statusCd === 'FINISH' ? 18 : null,
      round: { name: `Spieltag ${index + 1}` },
    }
  })
}

describe('normalizeSeasonTeamMatches', () => {
  it('normalizes 14 H1 matches and identifies both home and away fixtures by participant ID', () => {
    const response: ThreeKDartsParticipantResponse = {
      matches: [
        ...makeMatches(527581, 4652700, 14),
        {
          id: 999999,
          participantHome: { id: 900001, displayName: 'Anderes Team A' },
          participantGuest: { id: 900002, displayName: 'Anderes Team B' },
          statusCd: 'FINISH',
        },
      ],
    }
    const matches = normalizeSeasonTeamMatches(response, 527581)

    expect(matches).toHaveLength(14)
    expect(matches.filter(({ participantHome }) => participantHome.id === 527581)).toHaveLength(7)
    expect(matches.filter(({ participantGuest }) => participantGuest.id === 527581)).toHaveLength(7)
    expect(matches[0]).toMatchObject({
      matchId: 4652700,
      roundName: 'Spieltag 1',
      statusCd: 'FINISH',
      setsHome: 10,
      setsAway: 8,
    })
  })

  it('retains all 14 H2 fixtures including six finished and eight open games with null scores', () => {
    const response: ThreeKDartsParticipantResponse = {
      matches: makeMatches(682469, 6354400, 6),
    }
    const matches = normalizeSeasonTeamMatches(response, 682469)

    expect(matches).toHaveLength(14)
    expect(matches.filter(({ statusCd }) => statusCd === 'FINISH')).toHaveLength(6)
    const openMatches = matches.filter(({ statusCd }) => statusCd === 'OPEN')
    expect(openMatches).toHaveLength(8)
    expect(openMatches[0]).toMatchObject({
      setsHome: null,
      setsAway: null,
      legsHome: null,
      legsAway: null,
    })
    expect(() => normalizeSeasonTeamMatches({ matches: null }, 682469)).not.toThrow()
    expect(normalizeSeasonTeamMatches({ matches: null }, 682469)).toEqual([])
  })
})
