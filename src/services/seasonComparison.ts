import type { ThreeKDartsRound } from './threeKDartsApi'

export const MATCHDAYS_PER_SEASON = 14

export type MatchdayPointState = 'complete' | 'open' | 'incomplete'

export interface MatchdayPoint {
  matchday: number
  cumulativePoints: number | null
  state: MatchdayPointState
  message: string | null
}

export interface SeasonComparisonInput {
  seasonKey: string
  label: string
  participantId: number
  /** In the order supplied by the phase response. */
  roundIds: readonly number[]
  roundData: Readonly<Record<number, ThreeKDartsRound>>
  reports: Readonly<Record<number, unknown>>
  failedRounds?: Readonly<Record<number, string>>
  failedReports?: Readonly<Record<number, unknown>>
}

export interface SeasonComparisonResult {
  seasonKey: string
  label: string
  matchdayCount: number
  points: MatchdayPoint[]
  latestPoints: number | null
  latestMatchday: number | null
  complete: boolean
}

interface ReportGame {
  matchTypeCd?: unknown
  statusCd?: unknown
  legsHome?: unknown
  legsAway?: unknown
  participantHome?: { id?: unknown } | null
  participantGuest?: { id?: unknown } | null
  matchReportBlock?: { matchTypeCd?: unknown } | null
}

interface MatchPoints {
  valid: boolean
  points: number
  message: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function positiveId(value: unknown): number | null {
  const id = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function score(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

function gameType(game: ReportGame): unknown {
  return game.matchTypeCd ?? game.matchReportBlock?.matchTypeCd
}

function invalid(message: string): MatchPoints {
  return { valid: false, points: 0, message }
}

function calculateCompletedMatchPoints(
  match: Record<string, unknown>,
  report: unknown,
  participantId: number,
): MatchPoints {
  if (!Array.isArray(report)) return invalid('Der Matchreport fehlt oder hat ein ungültiges Format.')

  const games = report.map(asRecord).filter((game): game is Record<string, unknown> => game !== null) as ReportGame[]
  if (games.length !== report.length || games.length === 0) {
    return invalid('Der Matchreport enthält ungültige Spieleinträge.')
  }

  const regularGames = games.filter((game) => gameType(game) === 'DP' || gameType(game) === 'EZ')
  const teamGames = games.filter((game) => gameType(game) === 'TG')
  const unknownGames = games.filter((game) => !['DP', 'EZ', 'TG'].includes(String(gameType(game))))
  if (unknownGames.length > 0 || regularGames.length !== 18 || teamGames.length !== 1) {
    return invalid('Der Report enthält nicht die erwarteten 18 regulären Spiele und ein Team-Game.')
  }
  if (regularGames.some((game) => game.statusCd !== 'FINISH')) {
    return invalid('Mindestens ein reguläres Spiel im abgeschlossenen Match ist nicht abgeschlossen.')
  }

  const setsHome = score(match.setsHome)
  const setsAway = score(match.setsAway)
  const homeTeamId = positiveId(asRecord(match.participantHome)?.id)
  const awayTeamId = positiveId(asRecord(match.participantGuest)?.id)
  if (setsHome === null || setsAway === null || homeTeamId === null || awayTeamId === null) {
    return invalid('Im Spielplan fehlen ein gültiger Endstand oder Mannschafts-IDs.')
  }

  const teamGame = teamGames[0]!
  if (teamGame.statusCd === 'FINISH') {
    if (setsHome + setsAway !== 19 || Math.abs(setsHome - setsAway) !== 1) {
      return invalid('Der TG-Report passt nicht zum 19. entscheidenden Spiel im Endstand.')
    }

    const tgHomeId = positiveId(teamGame.participantHome?.id)
    const tgAwayId = positiveId(teamGame.participantGuest?.id)
    const tgHomeLegs = score(teamGame.legsHome)
    const tgAwayLegs = score(teamGame.legsAway)
    if (
      tgHomeId === null ||
      tgAwayId === null ||
      tgHomeLegs === null ||
      tgAwayLegs === null ||
      tgHomeLegs === tgAwayLegs
    ) {
      return invalid('Der abgeschlossene TG-Report enthält keine eindeutige Entscheidung.')
    }

    const sameOrientation = tgHomeId === homeTeamId && tgAwayId === awayTeamId
    const reversedOrientation = tgHomeId === awayTeamId && tgAwayId === homeTeamId
    if (!sameOrientation && !reversedOrientation) {
      return invalid('Die Mannschafts-IDs im TG-Report passen nicht zum Spielplan.')
    }

    const tgWinnerId = tgHomeLegs > tgAwayLegs ? tgHomeId : tgAwayId
    const scheduleWinnerId = setsHome > setsAway ? homeTeamId : awayTeamId
    if (tgWinnerId !== scheduleWinnerId) {
      return invalid('TG-Report und Mannschafts-Endstand widersprechen sich.')
    }

    return {
      valid: true,
      points: tgWinnerId === participantId ? 2 : 1,
      message: tgWinnerId === participantId ? 'Team-Game gewonnen: 2 Punkte.' : 'Team-Game verloren: 1 Punkt.',
    }
  }

  if (teamGame.statusCd !== 'OPEN') {
    return invalid('Der TG-Status ist unbekannt; die Begegnung wird nicht gewertet.')
  }
  if (setsHome + setsAway !== 18 || setsHome === setsAway) {
    return invalid('Der reguläre Endstand passt nicht zu 18 abgeschlossenen Spielen.')
  }

  const winnerId = setsHome > setsAway ? homeTeamId : awayTeamId
  return {
    valid: true,
    points: winnerId === participantId ? 3 : 0,
    message: winnerId === participantId ? 'Regulärer Sieg: 3 Punkte.' : 'Reguläre Niederlage: 0 Punkte.',
  }
}

export function calculateSeasonComparison(input: SeasonComparisonInput): SeasonComparisonResult {
  const matchdayCount = Math.max(MATCHDAYS_PER_SEASON, input.roundIds.length)
  let cumulativePoints = 0
  let validThroughDay = true
  let latestPoints: number | null = 0
  let latestMatchday: number | null = 0
  const points: MatchdayPoint[] = []

  for (let index = 0; index < matchdayCount; index += 1) {
    const matchday = index + 1
    if (!validThroughDay) {
      points.push({ matchday, cumulativePoints: null, state: 'incomplete', message: null })
      continue
    }

    const roundId = input.roundIds[index]
    if (roundId === undefined) {
      validThroughDay = false
      latestPoints = null
      latestMatchday = null
      points.push({ matchday, cumulativePoints: null, state: 'incomplete', message: 'Für diesen Spieltag fehlt die Phasen-/Runden-ID.' })
      continue
    }
    if (input.failedRounds?.[roundId]) {
      validThroughDay = false
      latestPoints = null
      latestMatchday = null
      points.push({ matchday, cumulativePoints: null, state: 'incomplete', message: 'Die Rundendaten konnten nicht geladen werden.' })
      continue
    }

    const round = input.roundData[roundId]
    if (!round) {
      validThroughDay = false
      latestPoints = null
      latestMatchday = null
      points.push({ matchday, cumulativePoints: null, state: 'incomplete', message: 'Die Rundendaten fehlen.' })
      continue
    }

    const teamMatches = (round.matches ?? []).filter(
      (match) =>
        positiveId(match.participantHome?.id) === input.participantId ||
        positiveId(match.participantGuest?.id) === input.participantId,
    )
    if (teamMatches.length !== 1) {
      validThroughDay = false
      latestPoints = null
      latestMatchday = null
      points.push({ matchday, cumulativePoints: null, state: 'incomplete', message: 'Für diesen Spieltag wurde keine eindeutige Mannschaftsbegegnung gefunden.' })
      continue
    }

    const match = teamMatches[0]!
    if (match.statusCd === 'OPEN') {
      points.push({ matchday, cumulativePoints, state: 'open', message: 'Begegnung offen; Punktestand bleibt unverändert.' })
      continue
    }
    if (match.statusCd !== 'FINISH') {
      validThroughDay = false
      latestPoints = null
      latestMatchday = null
      points.push({ matchday, cumulativePoints: null, state: 'incomplete', message: 'Der Begegnungsstatus ist unbekannt.' })
      continue
    }

    const matchId = positiveId(match.id ?? match.matchId)
    if (matchId === null || input.failedReports?.[matchId] || !(matchId in input.reports)) {
      validThroughDay = false
      latestPoints = null
      latestMatchday = null
      points.push({ matchday, cumulativePoints: null, state: 'incomplete', message: 'Der benötigte Matchreport fehlt oder konnte nicht geladen werden.' })
      continue
    }

    const result = calculateCompletedMatchPoints(
      match as unknown as Record<string, unknown>,
      input.reports[matchId],
      input.participantId,
    )
    if (!result.valid) {
      validThroughDay = false
      latestPoints = null
      latestMatchday = null
      points.push({ matchday, cumulativePoints: null, state: 'incomplete', message: result.message })
      continue
    }

    cumulativePoints += result.points
    latestPoints = cumulativePoints
    latestMatchday = matchday
    points.push({ matchday, cumulativePoints, state: 'complete', message: result.message })
  }

  return {
    seasonKey: input.seasonKey,
    label: input.label,
    matchdayCount,
    points,
    latestPoints,
    latestMatchday,
    complete: points.every(({ state }) => state !== 'incomplete'),
  }
}
