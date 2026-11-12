import type { NormalizedSeasonData } from './dataNormalizer'

export interface RecordStats {
  wins: number
  losses: number
  draws: number
}

export interface TeamStats extends RecordStats {
  teamId: string
}

export interface PlayerStats extends RecordStats {
  playerId: string
}

export interface DoublesStats extends RecordStats {
  playerIds: [string, string]
  pairKey: string
}

function emptyRecord(): RecordStats {
  return { wins: 0, losses: 0, draws: 0 }
}

export function calculateTeamStatistics(data: NormalizedSeasonData): TeamStats[] {
  const stats = new Map<string, TeamStats>()
  const ensure = (teamId: string) => {
    let entry = stats.get(teamId)
    if (!entry) {
      entry = { teamId, ...emptyRecord() }
      stats.set(teamId, entry)
    }
    return entry
  }

  for (const match of data.teamMatches) {
    if (match.status === 'open' || match.homeScore === null || match.awayScore === null) continue
    const home = ensure(match.homeTeamId)
    const away = ensure(match.awayTeamId)
    if (match.homeScore > match.awayScore) {
      home.wins += 1
      away.losses += 1
    } else if (match.homeScore < match.awayScore) {
      away.wins += 1
      home.losses += 1
    } else {
      home.draws += 1
      away.draws += 1
    }
  }

  return [...stats.values()].sort((a, b) => a.teamId.localeCompare(b.teamId))
}

function calculatePlayerRecords(data: NormalizedSeasonData, kind: 'single' | 'double') {
  const records = new Map<string, RecordStats>()
  for (const game of data.reportGames) {
    if (game.kind !== kind || game.status === 'open' || game.winnerSide === null) continue
    const sides = [game.sideOnePlayerIds, game.sideTwoPlayerIds] as const
    sides.forEach((playerIds, sideIndex) => {
      const won = sideIndex + 1 === game.winnerSide
      for (const playerId of playerIds) {
        const entry = records.get(playerId) ?? emptyRecord()
        if (won) entry.wins += 1
        else entry.losses += 1
        records.set(playerId, entry)
      }
    })
  }
  return records
}

export function calculatePlayerStatistics(data: NormalizedSeasonData): PlayerStats[] {
  return [...calculatePlayerRecords(data, 'single')]
    .map(([playerId, record]) => ({ playerId, ...record }))
    .sort((a, b) => a.playerId.localeCompare(b.playerId))
}

export function calculateDoublesStatistics(data: NormalizedSeasonData): DoublesStats[] {
  const records = new Map<string, RecordStats>()
  for (const game of data.reportGames) {
    if (game.kind !== 'double' || game.status === 'open' || game.winnerSide === null) continue
    const pairKeys = [game.sideOnePlayerIds, game.sideTwoPlayerIds].map((ids) =>
      [...ids].sort((a, b) => a.localeCompare(b)).join('|'),
    )
    pairKeys.forEach((pairKey, sideIndex) => {
      const record = records.get(pairKey) ?? emptyRecord()
      if (sideIndex + 1 === game.winnerSide) record.wins += 1
      else record.losses += 1
      records.set(pairKey, record)
    })
  }

  return [...records]
    .map(([pairKey, record]) => {
      const [first = '', second = ''] = pairKey.split('|')
      return { pairKey, playerIds: [first, second], ...record } as DoublesStats
    })
    .sort((a, b) => a.pairKey.localeCompare(b.pairKey))
}
