import type { ThreeKDartsTableResponse, ThreeKDartsTableTeamEntry } from './threeKDartsApi'

export interface TeamStandingRow extends ThreeKDartsTableTeamEntry {
  setDifference: number | null
  legDifference: number | null
}

function difference(
  first: number | null | undefined,
  second: number | null | undefined,
): number | null {
  return first == null || second == null ? null : first - second
}

export function normalizeTeamStandings(response: ThreeKDartsTableResponse): TeamStandingRow[] {
  if (!Array.isArray(response.tableEntries) || response.tableEntries.length === 0) {
    throw new Error('Die Ranglistenantwort enthält keine Tabelleninformationen.')
  }

  const rows: ThreeKDartsTableTeamEntry[] | null | undefined =
    response.tableEntries[0]?.tableEntries
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Die Ranglistenantwort enthält keine Mannschaftseinträge.')
  }

  return rows.map((row) => ({
    placement: row.placement,
    participantName: row.participantName,
    participantId: row.participantId,
    matchCount: row.matchCount,
    win: row.win,
    lost: row.lost,
    tie: row.tie,
    points1: row.points1,
    points2: row.points2,
    sets1: row.sets1,
    sets2: row.sets2,
    setDifference: difference(row.sets1, row.sets2),
    legs1: row.legs1,
    legs2: row.legs2,
    legDifference: difference(row.legs1, row.legs2),
  }))
}
