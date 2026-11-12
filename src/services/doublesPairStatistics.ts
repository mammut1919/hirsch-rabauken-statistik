import type { SeasonRosterPlayer } from './playerRoster'
import type { SeasonReportSet, UnmatchedPlayerName } from './playerStatistics'

export interface DoublesPairStatisticsRow {
  pairKey: string
  playerIds: [string, string]
  displayNames: [string, string]
  played: number
  won: number
  winPercentage: number | null
  legsWon: number
  legsLost: number
  legDifference: number
}

export interface DoublesPairStatisticsResult {
  pairs: DoublesPairStatisticsRow[]
  unmatchedNames: UnmatchedPlayerName[]
}

export function filterDoublesPairsByPlayer(
  pairs: readonly DoublesPairStatisticsRow[],
  playerId: string | null,
): DoublesPairStatisticsRow[] {
  return playerId === null ? [...pairs] : pairs.filter((pair) => pair.playerIds.includes(playerId))
}

interface ReportEntry {
  matchTypeCd?: unknown
  statusCd?: unknown
  legsHome?: unknown
  legsAway?: unknown
  participantHome?: { displayName?: unknown } | null
  participantGuest?: { displayName?: unknown } | null
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function validScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

interface ResolvedSide {
  playerIds: string[]
  names: string[]
  valid: boolean
  hasRosterNames: boolean
}

function resolveDoubleSide(
  displayName: unknown,
  namesByName: Map<string, Set<string>>,
): ResolvedSide {
  const names = typeof displayName === 'string'
    ? displayName.split('&').map((name) => name.trim())
    : []
  const hasValidFormat = names.length === 2 && names.every(Boolean)
  const playerIds: string[] = []
  let hasRosterNames = false
  let valid = hasValidFormat

  for (const name of names) {
    const ids = namesByName.get(name)
    if (ids?.size) hasRosterNames = true
    if (!ids || ids.size !== 1) {
      valid = false
    } else {
      playerIds.push([...ids][0]!)
    }
  }

  if (new Set(playerIds).size !== 2) valid = false
  return { playerIds, names, valid, hasRosterNames }
}

export function calculateDoublesPairStatistics(
  rosters: Readonly<Record<string, readonly SeasonRosterPlayer[]>>,
  reportSets: readonly SeasonReportSet[],
): DoublesPairStatisticsResult {
  const namesBySeason = new Map<string, Map<string, Set<string>>>()
  const namesByPlayerId = new Map<string, string>()
  for (const [seasonKey, roster] of Object.entries(rosters)) {
    const names = new Map<string, Set<string>>()
    for (const player of roster) {
      const playerIds = names.get(player.displayName) ?? new Set<string>()
      playerIds.add(player.playerId)
      names.set(player.displayName, playerIds)
      namesByPlayerId.set(player.playerId, player.displayName)
    }
    namesBySeason.set(seasonKey, names)
  }

  const pairs = new Map<string, DoublesPairStatisticsRow>()
  const unmatched = new Map<string, UnmatchedPlayerName>()
  const noteUnmatched = (
    seasonKey: string,
    displayName: string,
    reason: UnmatchedPlayerName['reason'],
  ) => {
    const key = `${seasonKey}\u0000${displayName}\u0000${reason}`
    const existing = unmatched.get(key)
    if (existing) existing.count += 1
    else unmatched.set(key, { seasonKey, displayName, reason, count: 1 })
  }

  for (const reportSet of reportSets) {
    const names = namesBySeason.get(reportSet.seasonKey)
    if (!names) continue
    for (const rawEntry of reportSet.reports) {
      const entry = record(rawEntry) as ReportEntry | null
      if (!entry || entry.matchTypeCd !== 'DP' || entry.statusCd !== 'FINISH') continue
      const homeSide = resolveDoubleSide(entry.participantHome?.displayName, names)
      const guestSide = resolveDoubleSide(entry.participantGuest?.displayName, names)
      const teamSides = [homeSide, guestSide].filter(({ valid }) => valid)

      if (teamSides.length !== 1) {
        for (const side of [homeSide, guestSide]) {
          if (!side.hasRosterNames) continue
          if (side.names.length !== 2 || side.names.some((name) => !name)) {
            noteUnmatched(reportSet.seasonKey, side.names.join(' & ') || '(ohne Namen)', 'doppelformat')
            continue
          }
          for (const name of side.names) {
            const matchingIds = names.get(name)
            if (!matchingIds?.size) {
              noteUnmatched(reportSet.seasonKey, name, 'nicht-im-kader')
            } else if (matchingIds.size > 1) {
              noteUnmatched(reportSet.seasonKey, name, 'mehrdeutig')
            }
          }
        }
        continue
      }

      const teamSide = teamSides[0]!
      const playerIds = teamSide.playerIds

      const sortedIds = [...playerIds].sort((a, b) => a.localeCompare(b)) as [string, string]
      const pairKey = `${sortedIds[0]}:${sortedIds[1]}`
      let pair = pairs.get(pairKey)
      if (!pair) {
        const displayNames = sortedIds.map((id) => namesByPlayerId.get(id) ?? id) as [
          string,
          string,
        ]
        pair = {
          pairKey,
          playerIds: sortedIds,
          displayNames,
          played: 0,
          won: 0,
          winPercentage: null,
          legsWon: 0,
          legsLost: 0,
          legDifference: 0,
        }
        pairs.set(pairKey, pair)
      }
      pair.played += 1
      const homeLegs = validScore(entry.legsHome)
      const awayLegs = validScore(entry.legsAway)
      const teamLegs = teamSide === homeSide ? homeLegs : awayLegs
      const opponentLegs = teamSide === homeSide ? awayLegs : homeLegs
      if (teamLegs !== null && opponentLegs !== null) {
        if (teamLegs > opponentLegs) pair.won += 1
        pair.legsWon += teamLegs
        pair.legsLost += opponentLegs
      }
    }
  }

  const result = [...pairs.values()]
    .map((pair) => ({
      ...pair,
      winPercentage: pair.played === 0 ? null : (pair.won / pair.played) * 100,
      legDifference: pair.legsWon - pair.legsLost,
    }))
    .sort((a, b) => b.played - a.played || (b.winPercentage ?? 0) - (a.winPercentage ?? 0))
  return {
    pairs: result,
    unmatchedNames: [...unmatched.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    ),
  }
}
