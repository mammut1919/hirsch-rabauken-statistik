import { describe, expect, it } from 'vitest'
import { normalizeSeasonData } from '../../services/dataNormalizer'
import {
  calculateDoublesStatistics,
  calculatePlayerStatistics,
  calculateTeamStatistics,
} from '../../services/statistics'

const seasonData = normalizeSeasonData({
  teamMatches: [
    {
      matchId: 'team-win',
      status: 'finished',
      homeTeamId: 'rabauken',
      awayTeamId: 'opponent-a',
      homeScore: 5,
      awayScore: 3,
    },
    {
      matchId: 'team-loss',
      status: 'finished',
      homeTeamId: 'opponent-b',
      awayTeamId: 'rabauken',
      homeScore: 4,
      awayScore: 2,
    },
    {
      matchId: 'team-draw',
      status: 'finished',
      homeTeamId: 'rabauken',
      awayTeamId: 'opponent-c',
      homeScore: 3,
      awayScore: 3,
    },
    {
      matchId: 'team-open',
      status: 'open',
      homeTeamId: 'rabauken',
      awayTeamId: 'opponent-d',
      homeScore: null,
      awayScore: null,
    },
  ],
  reportGames: [
    {
      gameId: 'single-win',
      kind: 'single',
      status: 'finished',
      sideOnePlayerIds: ['player-1'],
      sideTwoPlayerIds: ['player-2'],
      winnerSide: 1,
    },
    {
      gameId: 'single-open',
      kind: 'single',
      status: 'open',
      sideOnePlayerIds: ['player-1'],
      sideTwoPlayerIds: ['player-3'],
      winnerSide: null,
    },
    {
      gameId: 'double-win',
      kind: 'double',
      status: 'finished',
      sideOnePlayerIds: ['player-2', 'player-1'],
      sideTwoPlayerIds: ['player-3', 'player-4'],
      winnerSide: 1,
    },
    {
      gameId: 'double-reversed',
      kind: 'double',
      status: 'finished',
      sideOnePlayerIds: ['player-4', 'player-3'],
      sideTwoPlayerIds: ['player-1', 'player-2'],
      winnerSide: 2,
    },
    {
      gameId: 'double-open',
      kind: 'double',
      status: 'open',
      sideOnePlayerIds: ['player-1', 'player-2'],
      sideTwoPlayerIds: ['player-3', 'player-4'],
      winnerSide: null,
    },
  ],
})

describe('statistics', () => {
  it('counts team wins, losses and draws but ignores open matches', () => {
    expect(calculateTeamStatistics(seasonData).find(({ teamId }) => teamId === 'rabauken')).toEqual({
      teamId: 'rabauken',
      wins: 1,
      losses: 1,
      draws: 1,
    })
  })

  it('identifies singles by player ID and ignores open games', () => {
    expect(calculatePlayerStatistics(seasonData)).toEqual([
      { playerId: 'player-1', wins: 1, losses: 0, draws: 0 },
      { playerId: 'player-2', wins: 0, losses: 1, draws: 0 },
    ])
  })

  it('merges doubles regardless of player order and ignores open games', () => {
    expect(calculateDoublesStatistics(seasonData)).toEqual([
      {
        pairKey: 'player-1|player-2',
        playerIds: ['player-1', 'player-2'],
        wins: 2,
        losses: 0,
        draws: 0,
      },
      {
        pairKey: 'player-3|player-4',
        playerIds: ['player-3', 'player-4'],
        wins: 0,
        losses: 2,
        draws: 0,
      },
    ])
  })
})
