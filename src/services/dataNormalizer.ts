/**
 * Internal domain contracts. They are intentionally not presented as the 3K
 * response schema: the project has no captured 3K responses or field mapping.
 */
export type MatchStatus = 'open' | 'finished'
export type SideNumber = 1 | 2
export type MatchKind = 'single' | 'double'

export interface TeamMatchRecord {
  matchId: string
  status: MatchStatus
  homeTeamId: string
  awayTeamId: string
  homeScore: number | null
  awayScore: number | null
}

export interface ReportGameRecord {
  gameId: string
  kind: MatchKind
  status: MatchStatus
  sideOnePlayerIds: string[]
  sideTwoPlayerIds: string[]
  winnerSide: SideNumber | null
}

export interface NormalizedSeasonData {
  teamMatches: TeamMatchRecord[]
  reportGames: ReportGameRecord[]
}

function assertId(value: string, field: string): void {
  if (value.trim().length === 0) throw new TypeError(`${field} darf nicht leer sein.`)
}

function normalizeSide(playerIds: readonly string[], field: string, expectedSize: number): string[] {
  if (playerIds.length !== expectedSize) {
    throw new TypeError(`${field} muss genau ${expectedSize} Spieler enthalten.`)
  }
  playerIds.forEach((id) => assertId(id, field))
  if (new Set(playerIds).size !== playerIds.length) {
    throw new TypeError(`${field} enthält doppelte Spieler-IDs.`)
  }
  return [...playerIds].sort((a, b) => a.localeCompare(b))
}

export function normalizeTeamMatch(match: TeamMatchRecord): TeamMatchRecord {
  assertId(match.matchId, 'matchId')
  assertId(match.homeTeamId, 'homeTeamId')
  assertId(match.awayTeamId, 'awayTeamId')
  if (match.homeTeamId === match.awayTeamId) {
    throw new TypeError('Heim- und Auswärtsteam müssen unterschiedliche IDs haben.')
  }
  if (match.status === 'finished' && (match.homeScore === null || match.awayScore === null)) {
    throw new TypeError('Abgeschlossene Mannschaftsspiele benötigen beide Spielstände.')
  }
  return { ...match }
}

export function normalizeReportGame(game: ReportGameRecord): ReportGameRecord {
  assertId(game.gameId, 'gameId')
  const expectedSize = game.kind === 'single' ? 1 : 2
  const sideOnePlayerIds = normalizeSide(game.sideOnePlayerIds, 'sideOnePlayerIds', expectedSize)
  const sideTwoPlayerIds = normalizeSide(game.sideTwoPlayerIds, 'sideTwoPlayerIds', expectedSize)
  if (sideOnePlayerIds.some((id) => sideTwoPlayerIds.includes(id))) {
    throw new TypeError('Ein Spieler darf nicht auf beiden Seiten desselben Spiels stehen.')
  }
  if (game.winnerSide !== null && game.status === 'open') {
    throw new TypeError('Ein offenes Spiel darf keinen bestätigten Sieger haben.')
  }
  return { ...game, sideOnePlayerIds, sideTwoPlayerIds }
}

export function normalizeSeasonData(data: NormalizedSeasonData): NormalizedSeasonData {
  return {
    teamMatches: data.teamMatches.map(normalizeTeamMatch),
    reportGames: data.reportGames.map(normalizeReportGame),
  }
}
