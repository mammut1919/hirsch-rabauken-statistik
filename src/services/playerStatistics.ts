import type { SeasonRosterPlayer } from './playerRoster'

export type PlayerGameKind = 'EZ' | 'DP'
export type UnmatchedReason = 'nicht-im-kader' | 'mehrdeutig' | 'doppelformat'

export interface PlayerGameSummary {
  played: number
  won: number
  winPercentage: number | null
  legsWon: number
  legsLost: number
  legDifference: number
}

export interface PlayerStatisticsRow {
  playerId: string
  displayName: string
  singles: PlayerGameSummary
  doubles: PlayerGameSummary
}

export interface UnmatchedPlayerName {
  seasonKey: string
  displayName: string
  reason: UnmatchedReason
  count: number
}

export interface SeasonReportSet {
  seasonKey: string
  reports: readonly unknown[]
}

export interface PlayerStatisticsResult {
  players: PlayerStatisticsRow[]
  unmatchedNames: UnmatchedPlayerName[]
}

interface ReportSide {
  displayName?: unknown
}

interface ReportEntry {
  id?: unknown
  matchTypeCd?: unknown
  statusCd?: unknown
  legsHome?: unknown
  legsAway?: unknown
  participantHome?: ReportSide | null
  participantGuest?: ReportSide | null
  matchReportBlock?: { matchTypeCd?: unknown } | null
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function finiteScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return value
}

function emptySummary(): PlayerGameSummary {
  return { played: 0, won: 0, winPercentage: null, legsWon: 0, legsLost: 0, legDifference: 0 }
}

function finishSummary(summary: PlayerGameSummary): PlayerGameSummary {
  return {
    ...summary,
    winPercentage: summary.played === 0 ? null : (summary.won / summary.played) * 100,
    legDifference: summary.legsWon - summary.legsLost,
  }
}

function rawGameKind(entry: ReportEntry): PlayerGameKind | null {
  const block = record(entry.matchReportBlock)
  const value = entry.matchTypeCd ?? block?.matchTypeCd
  return value === 'EZ' || value === 'DP' ? value : null
}

function displayNames(value: unknown, kind: PlayerGameKind): string[] {
  if (typeof value !== 'string' || value.trim() === '') return []
  const text = value.trim()
  if (kind === 'EZ') return [text]
  return text.split('&').map((name) => name.trim()).filter(Boolean)
}

function namesFromSide(side: ReportSide | null | undefined, kind: PlayerGameKind): string[] {
  return displayNames(side?.displayName, kind)
}

export function calculatePlayerStatistics(
  rosters: Readonly<Record<string, readonly SeasonRosterPlayer[]>>,
  reportSets: readonly SeasonReportSet[],
): PlayerStatisticsResult {
  const rows = new Map<string, PlayerStatisticsRow>()
  const namesBySeason = new Map<string, Map<string, Set<string>>>()

  for (const [seasonKey, roster] of Object.entries(rosters)) {
    const names = new Map<string, Set<string>>()
    for (const player of roster) {
      const existing = rows.get(player.playerId)
      if (!existing) {
        rows.set(player.playerId, {
          playerId: player.playerId,
          displayName: player.displayName,
          singles: emptySummary(),
          doubles: emptySummary(),
        })
      }
      const ids = names.get(player.displayName) ?? new Set<string>()
      ids.add(player.playerId)
      names.set(player.displayName, ids)
    }
    namesBySeason.set(seasonKey, names)
  }

  const unmatched = new Map<string, UnmatchedPlayerName>()
  const noteUnmatched = (
    seasonKey: string,
    displayName: string,
    reason: UnmatchedReason,
  ): void => {
    const key = `${seasonKey}\u0000${displayName}\u0000${reason}`
    const current = unmatched.get(key)
    if (current) current.count += 1
    else unmatched.set(key, { seasonKey, displayName, reason, count: 1 })
  }

  for (const reportSet of reportSets) {
    const names = namesBySeason.get(reportSet.seasonKey)
    if (!names) continue

    for (const rawEntry of reportSet.reports) {
      const entry = record(rawEntry) as ReportEntry | null
      if (!entry || entry.statusCd !== 'FINISH') continue
      const kind = rawGameKind(entry)
      if (!kind) continue

      const homeNames = namesFromSide(entry.participantHome, kind)
      const guestNames = namesFromSide(entry.participantGuest, kind)
      if (kind === 'DP' && (homeNames.length !== 2 || guestNames.length !== 2)) {
        for (const displayName of [...homeNames, ...guestNames]) {
          noteUnmatched(reportSet.seasonKey, displayName, 'doppelformat')
        }
        continue
      }

      const resolveSide = (sideNames: string[]): string[] => {
        const resolved: string[] = []
        for (const displayName of sideNames) {
          const ids = names.get(displayName)
          if (!ids || ids.size === 0) {
            noteUnmatched(reportSet.seasonKey, displayName, 'nicht-im-kader')
          } else if (ids.size > 1) {
            noteUnmatched(reportSet.seasonKey, displayName, 'mehrdeutig')
          } else {
            resolved.push([...ids][0]!)
          }
        }
        return [...new Set(resolved)]
      }

      const homePlayerIds = resolveSide(homeNames)
      const guestPlayerIds = resolveSide(guestNames)
      const homeLegs = finiteScore(entry.legsHome)
      const guestLegs = finiteScore(entry.legsAway)
      const hasLegResult = homeLegs !== null && guestLegs !== null
      const homeWon = hasLegResult && homeLegs > guestLegs
      const guestWon = hasLegResult && guestLegs > homeLegs
      const summaryKey = kind === 'EZ' ? 'singles' : 'doubles'

      for (const playerId of homePlayerIds) {
        const player = rows.get(playerId)
        if (!player) continue
        const stats = player[summaryKey]
        stats.played += 1
        if (homeWon) stats.won += 1
        if (hasLegResult) {
          stats.legsWon += homeLegs
          stats.legsLost += guestLegs
        }
      }
      for (const playerId of guestPlayerIds) {
        const player = rows.get(playerId)
        if (!player) continue
        const stats = player[summaryKey]
        stats.played += 1
        if (guestWon) stats.won += 1
        if (hasLegResult) {
          stats.legsWon += guestLegs
          stats.legsLost += homeLegs
        }
      }
    }
  }

  return {
    players: [...rows.values()]
      .map((player) => ({
        ...player,
        singles: finishSummary(player.singles),
        doubles: finishSummary(player.doubles),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    unmatchedNames: [...unmatched.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    ),
  }
}
