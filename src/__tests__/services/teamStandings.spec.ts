import { describe, expect, it } from 'vitest'
import { normalizeTeamStandings } from '../../services/teamStandings'
import type { ThreeKDartsTableResponse, ThreeKDartsTableTeamEntry } from '../../services/threeKDartsApi'

function standingsResponse(): ThreeKDartsTableResponse {
  const entries: ThreeKDartsTableTeamEntry[] = Array.from({ length: 8 }, (_, index) => ({
    placement: index === 0 ? 2 : index === 1 ? 1 : index + 1,
    participantName: index === 0 ? 'Hirsch-Rabauken' : `Team ${index + 1}`,
    participantId: index === 0 ? 527581 : 800000 + index,
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
  }))
  entries[0] = {
    ...entries[0],
    placement: 2,
    participantName: 'Hirsch-Rabauken',
    participantId: 527581,
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
  }
  return { tableEntries: [{ tableEntries: entries }] }
}

describe('team standing normalization', () => {
  it('reads all eight entries from the nested response and preserves API order and fields', () => {
    const normalized = normalizeTeamStandings(standingsResponse())

    expect(normalized).toHaveLength(8)
    expect(normalized.map(({ placement }) => placement)).toEqual([2, 1, 3, 4, 5, 6, 7, 8])
    expect(normalized[0]).toEqual({
      placement: 2,
      participantName: 'Hirsch-Rabauken',
      participantId: 527581,
      matchCount: 14,
      win: 9,
      lost: 5,
      tie: 0,
      points1: 18,
      points2: 10,
      sets1: 31,
      sets2: 22,
      setDifference: 9,
      legs1: 140,
      legs2: 119,
      legDifference: 21,
    })
  })

  it('handles missing result values when calculating differences', () => {
    const [normalized] = normalizeTeamStandings({
      tableEntries: [{
        tableEntries: [{
          placement: 1,
          participantName: 'Team',
          participantId: 4,
          matchCount: 1,
          win: 1,
          lost: 0,
          tie: 0,
          points1: 2,
          points2: 0,
          sets1: null,
          sets2: 1,
          legs1: 3,
          legs2: null,
        }],
      }],
    })

    expect(normalized?.setDifference).toBeNull()
    expect(normalized?.legDifference).toBeNull()
  })

  it('reports missing and empty table arrays clearly', () => {
    expect(() => normalizeTeamStandings({})).toThrow(
      'Die Ranglistenantwort enthält keine Tabelleninformationen.',
    )
    expect(() => normalizeTeamStandings({ tableEntries: [] })).toThrow(
      'Die Ranglistenantwort enthält keine Tabelleninformationen.',
    )
    expect(() => normalizeTeamStandings({ tableEntries: [{ tableEntries: [] }] })).toThrow(
      'Die Ranglistenantwort enthält keine Mannschaftseinträge.',
    )
  })
})
