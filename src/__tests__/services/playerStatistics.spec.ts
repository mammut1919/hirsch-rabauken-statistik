import { describe, expect, it } from 'vitest'
import { normalizeSeasonRoster, type SeasonRosterPlayer } from '../../services/playerRoster'
import { calculatePlayerStatistics } from '../../services/playerStatistics'

const roster: SeasonRosterPlayer[] = [
  { playerId: 'player-a', displayName: 'Alex A', firstname: 'Alex', passNr: '100' },
  { playerId: 'player-b', displayName: 'Bella B', firstname: 'Bella', passNr: '200' },
  { playerId: 'player-zero', displayName: 'No Games', firstname: null, passNr: null },
]

function entry(
  matchTypeCd: string,
  statusCd: string,
  homeName: string | undefined,
  guestName: string | undefined,
  legsHome?: number,
  legsAway?: number,
) {
  return {
    id: `${matchTypeCd}-${statusCd}-${homeName ?? 'none'}`,
    matchTypeCd,
    statusCd,
    legsHome,
    legsAway,
    participantHome: homeName ? { id: 1, displayName: homeName } : undefined,
    participantGuest: guestName ? { id: 2, displayName: guestName } : undefined,
  }
}

describe('player roster and player game statistics', () => {
  it('normalizes the official teamMembers to stable player IDs', () => {
    expect(
      normalizeSeasonRoster({
        participant: {
          teamSeason: {
            teamMembers: [
              {
                id: 44,
                member: {
                  id: 55,
                  player: { id: 66, displayName: 'Alex A', firstname: 'Alex', passNr: 100 },
                },
              },
            ],
          },
        },
      }),
    ).toEqual([{ playerId: '66', displayName: 'Alex A', firstname: 'Alex', passNr: '100' }])
  })

  it('counts singles and doubles, computes win rates and awards full double legs to both players', () => {
    const result = calculatePlayerStatistics(
      { '2026-1': roster },
      [
        {
          seasonKey: '2026-1',
          reports: [
            entry('EZ', 'FINISH', 'Alex A', 'Opponent', 2, 1),
            entry('EZ', 'FINISH', 'Opponent', 'Alex A', 2, 1),
            entry('EZ', 'OPEN', 'Alex A', 'Bella B', 2, 0),
            entry('DP', 'FINISH', 'Alex A & Bella B', 'Opponent C & Opponent D', 2, 1),
            entry('DP', 'FINISH', 'Opponent C & Opponent D', 'Bella B & Alex A', 2, 0),
            entry('TG', 'FINISH', 'Alex A', 'Opponent', 9, 3),
          ],
        },
      ],
    )

    const alex = result.players.find(({ playerId }) => playerId === 'player-a')!
    const bella = result.players.find(({ playerId }) => playerId === 'player-b')!
    const noGames = result.players.find(({ playerId }) => playerId === 'player-zero')!

    expect(alex.singles).toEqual({
      played: 2,
      won: 1,
      winPercentage: 50,
      legsWon: 3,
      legsLost: 3,
      legDifference: 0,
    })
    expect(alex.doubles).toEqual({
      played: 2,
      won: 1,
      winPercentage: 50,
      legsWon: 2,
      legsLost: 3,
      legDifference: -1,
    })
    expect(bella.doubles).toEqual(alex.doubles)
    expect(bella.singles.played).toBe(0)
    expect(bella.singles.winPercentage).toBeNull()
    expect(noGames.singles.winPercentage).toBeNull()
    expect(noGames.doubles.winPercentage).toBeNull()
    expect(result.players).toHaveLength(3)
  })

  it('does not assign an exact name that is ambiguous in the selected roster', () => {
    const result = calculatePlayerStatistics(
      {
        '2026-1': [
          { playerId: 'first', displayName: 'Same Name', firstname: null, passNr: null },
          { playerId: 'second', displayName: 'Same Name', firstname: null, passNr: null },
        ],
      },
      [
        {
          seasonKey: '2026-1',
          reports: [entry('EZ', 'FINISH', 'Same Name', 'Opponent', 2, 0)],
        },
      ],
    )

    expect(result.players.every(({ singles }) => singles.played === 0)).toBe(true)
    expect(result.unmatchedNames).toContainEqual({
      seasonKey: '2026-1',
      displayName: 'Same Name',
      reason: 'mehrdeutig',
      count: 1,
    })
  })

  it('merges H1 and H2 player rows by stable ID and keeps H1-only players', () => {
    const h1Roster: SeasonRosterPlayer[] = [
      { playerId: 'stable-ada', displayName: 'Ada A', firstname: 'Ada', passNr: null },
      { playerId: 'h1-fabian', displayName: 'Fabian Böttcher', firstname: 'Fabian', passNr: null },
    ]
    const h2Roster: SeasonRosterPlayer[] = [
      { playerId: 'stable-ada', displayName: 'Ada A', firstname: 'Ada', passNr: null },
      { playerId: 'h2-only', displayName: 'Alexandra A', firstname: 'Alexandra', passNr: null },
    ]
    const result = calculatePlayerStatistics(
      { '2026-1': h1Roster, '2026-2': h2Roster },
      [
        {
          seasonKey: '2026-1',
          reports: [entry('DP', 'FINISH', 'Ada A & Fabian Böttcher', 'Opponent A & Opponent B', 2, 1)],
        },
        {
          seasonKey: '2026-2',
          reports: [entry('DP', 'FINISH', 'Ada A & Alexandra A', 'Opponent C & Opponent D', 1, 2)],
        },
      ],
    )

    expect(result.players.find(({ playerId }) => playerId === 'stable-ada')?.doubles.played).toBe(2)
    expect(result.players.find(({ playerId }) => playerId === 'h1-fabian')?.doubles.played).toBe(1)
    expect(result.players.find(({ playerId }) => playerId === 'h2-only')?.doubles.played).toBe(1)
    expect(result.players).toHaveLength(3)
  })
})
