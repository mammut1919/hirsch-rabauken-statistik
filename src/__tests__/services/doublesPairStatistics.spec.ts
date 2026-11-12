import { describe, expect, it } from 'vitest'
import {
  calculateDoublesPairStatistics,
  filterDoublesPairsByPlayer,
} from '../../services/doublesPairStatistics'
import { calculatePlayerStatistics } from '../../services/playerStatistics'
import type { SeasonRosterPlayer } from '../../services/playerRoster'

const h1Roster: SeasonRosterPlayer[] = [
  { playerId: '10', displayName: 'Ada A', firstname: 'Ada', passNr: null },
  { playerId: '20', displayName: 'Ben B', firstname: 'Ben', passNr: null },
  { playerId: '30', displayName: 'Cem C', firstname: 'Cem', passNr: null },
]
const h2Roster: SeasonRosterPlayer[] = [
  { playerId: '10', displayName: 'Ada A', firstname: 'Ada', passNr: null },
  { playerId: '20', displayName: 'Ben B', firstname: 'Ben', passNr: null },
]

function report(home: string, away = 'Gegner Eins & Gegner Zwei', legsHome = 2, legsAway = 1) {
  return {
    matchTypeCd: 'DP',
    statusCd: 'FINISH',
    legsHome,
    legsAway,
    participantHome: { displayName: home },
    participantGuest: { displayName: away },
  }
}

describe('calculateDoublesPairStatistics', () => {
  it('fasst Namensreihenfolge zusammen, zählt mehrere Einsätze, Siege, Niederlagen und Legs', () => {
    const result = calculateDoublesPairStatistics({ '2026-1': h1Roster }, [
      {
        seasonKey: '2026-1',
        reports: [
          report('Ada A & Ben B', 'Gegner Eins & Gegner Zwei', 2, 1),
          report('Ben B & Ada A', 'Gegner Eins & Gegner Zwei', 0, 2),
        ],
      },
    ])

    expect(result.pairs).toEqual([
      {
        pairKey: '10:20',
        playerIds: ['10', '20'],
        displayNames: ['Ada A', 'Ben B'],
        played: 2,
        won: 1,
        winPercentage: 50,
        legsWon: 2,
        legsLost: 3,
        legDifference: -1,
      },
    ])
  })

  it('zeigt einmalige Paarungen und sortiert gleiche Einsatzanzahlen nach Gewinnquote', () => {
    const result = calculateDoublesPairStatistics({ '2026-1': h1Roster }, [
      {
        seasonKey: '2026-1',
        reports: [
          report('Ada A & Ben B', 'Gegner Eins & Gegner Zwei', 1, 2),
          report('Ada A & Cem C', 'Gegner Eins & Gegner Zwei', 2, 0),
        ],
      },
    ])

    expect(
      result.pairs.map(({ pairKey, played, winPercentage }) => ({
        pairKey,
        played,
        winPercentage,
      })),
    ).toEqual([
      { pairKey: '10:30', played: 1, winPercentage: 100 },
      { pairKey: '10:20', played: 1, winPercentage: 0 },
    ])
  })

  it('führt identische Spieler-IDs aus H1 und H2 trotz Namensreihenfolge zusammen', () => {
    const result = calculateDoublesPairStatistics({ '2026-1': h1Roster, '2026-2': h2Roster }, [
      { seasonKey: '2026-1', reports: [report('Ada A & Ben B')] },
      { seasonKey: '2026-2', reports: [report('Ben B & Ada A')] },
    ])

    expect(result.pairs).toHaveLength(1)
    expect(result.pairs[0]).toMatchObject({
      pairKey: '10:20',
      played: 2,
      won: 2,
      legsWon: 4,
      legsLost: 2,
    })
  })

  it('dokumentiert unvollständige und mehrdeutige Zuordnungen, ignoriert Gegner und offene Spiele', () => {
    const roster = [
      ...h1Roster,
      { playerId: '40', displayName: 'Dani D', firstname: null, passNr: null },
      { playerId: '41', displayName: 'Dani D', firstname: null, passNr: null },
    ]
    const result = calculateDoublesPairStatistics({ '2026-1': roster }, [
      {
        seasonKey: '2026-1',
        reports: [
          report('Ada A & Cem C'),
          report('Ada A'),
          report('Ada A & Dani D'),
          report('Gegner Eins & Gegner Zwei'),
          { ...report('Ada A & Ben B'), statusCd: 'OPEN' },
        ],
      },
    ])

    expect(result.pairs.map(({ pairKey }) => pairKey)).toEqual(['10:30'])
    expect(result.unmatchedNames).toContainEqual({
      seasonKey: '2026-1',
      displayName: 'Ada A',
      reason: 'doppelformat',
      count: 1,
    })
    expect(result.unmatchedNames).toContainEqual({
      seasonKey: '2026-1',
      displayName: 'Dani D',
      reason: 'mehrdeutig',
      count: 1,
    })
    expect(result.unmatchedNames.some(({ displayName }) => displayName.startsWith('Gegner'))).toBe(
      false,
    )
  })

  it('counts guest-side doubles with the correct team-oriented result', () => {
    const result = calculateDoublesPairStatistics({ '2026-1': h1Roster }, [
      {
        seasonKey: '2026-1',
        reports: [
          report('Gegner Eins & Gegner Zwei', 'Ben B & Ada A', 0, 2),
          report('Gegner Eins & Gegner Zwei', 'Cem C & Ada A', 2, 1),
        ],
      },
    ])

    expect(result.pairs.map(({ pairKey, played, won, legsWon, legsLost }) => ({
      pairKey,
      played,
      won,
      legsWon,
      legsLost,
    }))).toEqual([
      { pairKey: '10:20', played: 1, won: 1, legsWon: 2, legsLost: 0 },
      { pairKey: '10:30', played: 1, won: 0, legsWon: 1, legsLost: 2 },
    ])
  })

  it('counts all 28 finished H1 doubles and all 56 player appearances', () => {
    const officialRoster: SeasonRosterPlayer[] = [
      'Bernhard Hauns', 'Raffael Horoba', 'Jenna Oschwald', 'Alexander Bollian',
      'Peter Hubert', 'Ken Oschwald', 'Tove Hauns', 'Marco Deffert', 'Stefan Brandt',
      'Horst Fenske', 'Tino Schmotz', 'Waldemar Link', 'Fabian B\u00f6ttcher', 'Lars Liebold',
    ].map((displayName, index) => ({
      playerId: String(1000 + index),
      displayName,
      firstname: null,
      passNr: null,
    }))
    const officialDoubles: Array<[string, string, number, number]> = [
      ['Peter Hubert & Ken Oschwald', 'Michael Virnich & Marie Sophie Virnich', 2, 0],
      ['Stefan Brandt & Waldemar Link', 'Marco Eisen & Heike Gebhardt', 2, 1],
      ['Stefan Brandt & Marco Deffert', 'Christian Ihle & Conny Ihle', 0, 2],
      ['Ken Oschwald & Tino Schmotz', 'Yves Stroh & J\u00fcrgen Huck', 2, 0],
      ['Patrick Maulbetsch & Lars Brzoska', 'Stefan Brandt & Lars Liebold', 2, 0],
      ['Kirill Bugaev & Kevin Weisgerber', 'Tino Schmotz & Raffael Horoba', 2, 1],
      ['J\u00f6rg Weiland & Norbert Reisky', 'Raffael Horoba & Alexander Bollian', 0, 2],
      ['Martin Breckle & Thomas Zabinsky', 'Ken Oschwald & Jenna Oschwald', 2, 1],
      ['Peter Hubert & Ken Oschwald', 'Frank Sypplie & Matthias Lang', 0, 2],
      ['Alexander Bollian & Stefan Brandt', 'Thorsten Lang & Gaetano Viola', 0, 2],
      ['Gerhard Rundo & Helmut Rosenhoffer', 'Horst Fenske & Peter Hubert', 0, 2],
      ['Christine Rosenhoffer & Thomas Schweigert', 'Fabian B\u00f6ttcher & Stefan Brandt', 0, 2],
      ['Bernhard Hauns & Ken Oschwald', 'Emily Anderson & Anke St\u00fcbs', 2, 1],
      ['Tove Hauns & Stefan Brandt', 'Christian K\u00f6nig & Tanja Hodorff', 0, 2],
      ['Heike Gebhardt & Christoph Geiser', 'Marco Deffert & Stefan Brandt', 1, 2],
      ['Michael Virnich & Dominik Hausmann', 'Jenna Oschwald & Peter Hubert', 0, 2],
      ['Conny Ihle & Christian Ihle', 'Tino Schmotz & Peter Hubert', 0, 2],
      ['Angela Bitterwolf & Tanja Dahringer', 'Marco Deffert & Stefan Brandt', 2, 0],
      ['Ken Oschwald & Raffael Horoba', 'Rocco Mammone & Patrick Maulbetsch', 2, 0],
      ['Stefan Brandt & Peter Hubert', 'Kirill Bugaev & Kevin Weisgerber', 0, 2],
      ['Alexander Bollian & Tino Schmotz', 'Martin Breckle & Thomas Zabinsky', 1, 2],
      ['Stefan Brandt & Peter Hubert', 'Norbert Reisky & Udo S\u00f6ffing', 2, 0],
      ['Frank Sypplie & Matthias Lang', 'Alexander Bollian & Peter Hubert', 2, 1],
      ['Thorsten Lang & Klaus Wanner', 'Lars Liebold & Stefan Brandt', 1, 2],
      ['Horst Fenske & Tino Schmotz', 'Jan Enneker & Sven Schulz', 1, 2],
      ['Ken Oschwald & Stefan Brandt', 'Christine Rosenhoffer & Thomas Schweigert', 2, 0],
      ['Jenny Doll & Azim Y\u00fccel', 'Marco Deffert & Stefan Brandt', 2, 1],
      ['Christian K\u00f6nig & Markus Lohner', 'Jenna Oschwald & Peter Hubert', 0, 2],
    ]
    const reports = officialDoubles.map(([home, guest, legsHome, legsAway]) =>
      report(home, guest, legsHome, legsAway),
    )
    const reportSets = [{ seasonKey: '2026-1', reports }]
    const playerResult = calculatePlayerStatistics({ '2026-1': officialRoster }, reportSets)
    const pairResult = calculateDoublesPairStatistics({ '2026-1': officialRoster }, reportSets)

    expect(reports).toHaveLength(28)
    expect(playerResult.players.reduce((sum, player) => sum + player.doubles.played, 0)).toBe(56)
    expect(pairResult.pairs.reduce((sum, pair) => sum + pair.played, 0)).toBe(28)
  })
})

describe('filterDoublesPairsByPlayer', () => {
  it('shows all pairs by default and filters using stable player IDs', () => {
    const { pairs } = calculateDoublesPairStatistics({ '2026-1': h1Roster }, [
      {
        seasonKey: '2026-1',
        reports: [
          report('Ada A & Ben B'),
          report('Cem C & Ben B'),
        ],
      },
    ])

    expect(filterDoublesPairsByPlayer(pairs, null)).toHaveLength(2)
    expect(filterDoublesPairsByPlayer(pairs, '10').map(({ pairKey }) => pairKey)).toEqual(['10:20'])
    expect(filterDoublesPairsByPlayer(pairs, '20').map(({ pairKey }) => pairKey)).toEqual([
      '10:20',
      '20:30',
    ])
    expect(filterDoublesPairsByPlayer(pairs, 'missing')).toEqual([])
  })
})
