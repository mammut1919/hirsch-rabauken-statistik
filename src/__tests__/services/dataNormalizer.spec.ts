import { describe, expect, it } from 'vitest'
import { normalizeReportGame, normalizeSeasonData } from '../../services/dataNormalizer'

describe('dataNormalizer', () => {
  it('sorts doubles by stable player ID, independent of order', () => {
    const first = normalizeReportGame({
      gameId: 'g1',
      kind: 'double',
      status: 'finished',
      sideOnePlayerIds: ['player-b', 'player-a'],
      sideTwoPlayerIds: ['player-d', 'player-c'],
      winnerSide: 1,
    })
    const second = normalizeReportGame({
      gameId: 'g2',
      kind: 'double',
      status: 'finished',
      sideOnePlayerIds: ['player-a', 'player-b'],
      sideTwoPlayerIds: ['player-c', 'player-d'],
      winnerSide: 2,
    })

    expect(first.sideOnePlayerIds).toEqual(['player-a', 'player-b'])
    expect(second.sideOnePlayerIds).toEqual(first.sideOnePlayerIds)
    expect(first.sideTwoPlayerIds).toEqual(second.sideTwoPlayerIds)
  })

  it('rejects a winner on an open game and malformed player identity lists', () => {
    expect(() =>
      normalizeReportGame({
        gameId: 'g1',
        kind: 'single',
        status: 'open',
        sideOnePlayerIds: ['player-a'],
        sideTwoPlayerIds: ['player-b'],
        winnerSide: 1,
      }),
    ).toThrow('Ein offenes Spiel darf keinen bestätigten Sieger haben.')

    expect(() =>
      normalizeReportGame({
        gameId: 'g2',
        kind: 'double',
        status: 'finished',
        sideOnePlayerIds: ['player-a', 'player-a'],
        sideTwoPlayerIds: ['player-c', 'player-d'],
        winnerSide: 1,
      }),
    ).toThrow('sideOnePlayerIds enthält doppelte Spieler-IDs.')
  })

  it('validates completed team match scores', () => {
    expect(() =>
      normalizeSeasonData({
        teamMatches: [
          {
            matchId: 'm1',
            status: 'finished',
            homeTeamId: 'team-a',
            awayTeamId: 'team-b',
            homeScore: 4,
            awayScore: null,
          },
        ],
        reportGames: [],
      }),
    ).toThrow('Abgeschlossene Mannschaftsspiele benötigen beide Spielstände.')
  })
})
