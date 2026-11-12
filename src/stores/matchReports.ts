import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getAvailableSeasons, type SeasonConfig } from '../services/seasonConfig'
import { getTeamMatchIds } from '../services/teamMatches'
import {
  fetchMatchReportWithMetadata,
  fetchSeasonPhase,
  fetchSeasonRound,
  ThreeKDartsApiError,
  type RequestFailureCategory,
  type ThreeKDartsRound,
} from '../services/threeKDartsApi'

const REPORT_CONCURRENCY = 1
const ROUND_CONCURRENCY = 4
const MAX_REPORT_ATTEMPTS = 3
const REPORT_REQUEST_PAUSE_MS = 500
const H1_SEASON_KEY = '2026-1'

export interface ReportAttemptRecord {
  matchId: number
  attemptedAt: string
  attemptNumber: number
  outcome: 'Erfolg' | 'Fehler'
  category?: RequestFailureCategory
  httpStatus?: number
  errorName?: string
  errorMessage?: string
  contentType?: string
  byteLength?: number
}

async function forEachConcurrent<T>(
  values: T[],
  concurrency: number,
  action: (value: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      await action(values[index]!, index)
    }
  })
  await Promise.all(workers)
}

function positiveId(value: unknown): number | null {
  const id = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export const useMatchReportsStore = defineStore('matchReports', () => {
  const defaultSeason = getAvailableSeasons().find(({ key }) => key === H1_SEASON_KEY)
  const eventId = defaultSeason?.eventId ?? null
  const phaseId = defaultSeason?.phaseId ?? null

  // Each season owns an independent report cache and request state, even if match IDs overlap.
  const reportsBySeason = ref<Record<string, Record<number, unknown>>>({})
  const matchIdsBySeason = ref<Record<string, number[]>>({})
  const failedReportsBySeason = ref<Record<string, Record<number, ReportAttemptRecord>>>({})
  const attemptCountsBySeason = ref<Record<string, Record<number, number>>>({})
  const attemptLogsBySeason = ref<Record<string, ReportAttemptRecord[]>>({})
  const roundErrorsBySeason = ref<Record<string, string[]>>({})
  const loadErrorsBySeason = ref<Record<string, string>>({})
  const loadingBySeason = ref<Record<string, boolean>>({})
  const roundCountsBySeason = ref<Record<string, number>>({})
  const completedRoundsBySeason = ref<Record<string, number>>({})

  function ensureSeasonState(seasonKey: string): void {
    reportsBySeason.value[seasonKey] ??= {}
    matchIdsBySeason.value[seasonKey] ??= []
    failedReportsBySeason.value[seasonKey] ??= {}
    attemptCountsBySeason.value[seasonKey] ??= {}
    attemptLogsBySeason.value[seasonKey] ??= []
    roundErrorsBySeason.value[seasonKey] ??= []
    loadingBySeason.value[seasonKey] ??= false
    roundCountsBySeason.value[seasonKey] ??= 0
    completedRoundsBySeason.value[seasonKey] ??= 0
  }

  const loadedReportCounts = computed(() =>
    Object.fromEntries(
      Object.entries(matchIdsBySeason.value).map(([seasonKey, matchIds]) => [
        seasonKey,
        matchIds.filter((id) => id in (reportsBySeason.value[seasonKey] ?? {})).length,
      ]),
    ),
  )
  const failedReportCounts = computed(() =>
    Object.fromEntries(
      Object.entries(matchIdsBySeason.value).map(([seasonKey, matchIds]) => [
        seasonKey,
        matchIds.filter((id) => id in (failedReportsBySeason.value[seasonKey] ?? {})).length,
      ]),
    ),
  )
  const completedReportCounts = computed(() =>
    Object.fromEntries(
      Object.keys(matchIdsBySeason.value).map((seasonKey) => [
        seasonKey,
        (loadedReportCounts.value[seasonKey] ?? 0) + (failedReportCounts.value[seasonKey] ?? 0),
      ]),
    ),
  )
  const progressPercentsBySeason = computed(() =>
    Object.fromEntries(
      Object.entries(matchIdsBySeason.value).map(([seasonKey, matchIds]) => [
        seasonKey,
        matchIds.length === 0
          ? 0
          : Math.floor(((completedReportCounts.value[seasonKey] ?? 0) / matchIds.length) * 100),
      ]),
    ),
  )

  // H1 aliases preserve the existing diagnostic view and its controls.
  const reports = computed(() => reportsBySeason.value[H1_SEASON_KEY] ?? {})
  const matchIds = computed(() => matchIdsBySeason.value[H1_SEASON_KEY] ?? [])
  const failedReports = computed(() => failedReportsBySeason.value[H1_SEASON_KEY] ?? {})
  const attemptCounts = computed(() => attemptCountsBySeason.value[H1_SEASON_KEY] ?? {})
  const attemptLog = computed(() => attemptLogsBySeason.value[H1_SEASON_KEY] ?? [])
  const roundErrors = computed(() => roundErrorsBySeason.value[H1_SEASON_KEY] ?? [])
  const loading = computed(() => Object.values(loadingBySeason.value).some(Boolean))
  const loadError = computed(() => loadErrorsBySeason.value[H1_SEASON_KEY] ?? '')
  const roundCount = computed(() => roundCountsBySeason.value[H1_SEASON_KEY] ?? 0)
  const completedRounds = computed(() => completedRoundsBySeason.value[H1_SEASON_KEY] ?? 0)
  const loadedReportCount = computed(() => loadedReportCounts.value[H1_SEASON_KEY] ?? 0)
  const failedReportCount = computed(() => failedReportCounts.value[H1_SEASON_KEY] ?? 0)
  const completedReportCount = computed(() => completedReportCounts.value[H1_SEASON_KEY] ?? 0)
  const progressPercent = computed(() => progressPercentsBySeason.value[H1_SEASON_KEY] ?? 0)
  const cachedReportCount = computed(() => Object.keys(reports.value).length)
  const requestAttemptCount = computed(() => attemptLog.value.length)

  async function requestReport(season: SeasonConfig, matchId: number): Promise<void> {
    const seasonKey = season.key
    ensureSeasonState(seasonKey)
    for (let localAttempt = 1; localAttempt <= MAX_REPORT_ATTEMPTS; localAttempt += 1) {
      const attemptNumber = (attemptCountsBySeason.value[seasonKey]![matchId] ?? 0) + 1
      attemptCountsBySeason.value[seasonKey]![matchId] = attemptNumber
      const attemptedAt = new Date().toISOString()

      try {
        const response = await fetchMatchReportWithMetadata(season.eventId!, matchId)
        reportsBySeason.value[seasonKey]![matchId] = response.data
        delete failedReportsBySeason.value[seasonKey]![matchId]
        attemptLogsBySeason.value[seasonKey]!.push({
          matchId,
          attemptedAt,
          attemptNumber,
          outcome: 'Erfolg',
          httpStatus: response.httpStatus,
          contentType: response.contentType,
          byteLength: response.byteLength,
        })
        return
      } catch (error) {
        const category =
          error instanceof ThreeKDartsApiError ? error.category : 'Sonstiger Fehler'
        const record: ReportAttemptRecord = {
          matchId,
          attemptedAt,
          attemptNumber,
          outcome: 'Fehler',
          category,
          httpStatus: error instanceof ThreeKDartsApiError ? error.httpStatus : undefined,
          errorName:
            error instanceof ThreeKDartsApiError
              ? error.originalErrorName ?? error.name
              : error instanceof Error
                ? error.name
                : 'Unbekannter Fehler',
          errorMessage: error instanceof Error ? error.message : 'Unbekannter Fehler.',
        }
        failedReportsBySeason.value[seasonKey]![matchId] = record
        attemptLogsBySeason.value[seasonKey]!.push(record)
      }

      if (localAttempt < MAX_REPORT_ATTEMPTS) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, REPORT_REQUEST_PAUSE_MS))
      }
    }
  }

  async function loadSeasonReports(season: SeasonConfig): Promise<void> {
    ensureSeasonState(season.key)
    if (loadingBySeason.value[season.key]) return
    if (season.eventId === null || season.phaseId === null || season.participantId === null) {
      loadErrorsBySeason.value[season.key] = `F\u00fcr ${season.label} fehlen Event-, Phase- oder Teilnehmer-ID.`
      return
    }

    loadingBySeason.value[season.key] = true
    loadErrorsBySeason.value[season.key] = ''
    roundErrorsBySeason.value[season.key] = []
    failedReportsBySeason.value[season.key] = {}
    roundCountsBySeason.value[season.key] = 0
    completedRoundsBySeason.value[season.key] = 0

    try {
      const phase = await fetchSeasonPhase(season.eventId, season.phaseId)
      const rounds = Array.isArray(phase.rounds) ? phase.rounds : []
      const roundIds = [...new Set(
        rounds
          .map((round) => positiveId(round.id ?? round.roundId))
          .filter((id): id is number => id !== null),
      )]

      if (roundIds.length === 0) {
        throw new Error('Die Phasenantwort enth\u00e4lt keine g\u00fcltigen Runden-IDs.')
      }

      roundCountsBySeason.value[season.key] = roundIds.length
      const allMatchIds = new Set<number>()

      await forEachConcurrent(roundIds, ROUND_CONCURRENCY, async (roundId) => {
        try {
          const round: ThreeKDartsRound = await fetchSeasonRound(
            season.eventId!,
            season.phaseId!,
            roundId,
          )
          for (const matchId of getTeamMatchIds(round, season.participantId!)) {
            allMatchIds.add(matchId)
          }
        } catch (error) {
          roundErrorsBySeason.value[season.key]!.push(
            `Runde ${roundId}: ${error instanceof Error ? error.message : 'Unbekannter Fehler.'}`,
          )
        } finally {
          completedRoundsBySeason.value[season.key] =
            (completedRoundsBySeason.value[season.key] ?? 0) + 1
        }
      })

      matchIdsBySeason.value[season.key] = [...allMatchIds].sort((a, b) => a - b)
      if (matchIdsBySeason.value[season.key]!.length === 0) {
        throw new Error('Aus den Rundendaten konnten keine Match-IDs ermittelt werden.')
      }

      const uncachedIds = matchIdsBySeason.value[season.key]!.filter(
        (id) => !(id in reportsBySeason.value[season.key]!),
      )
      await forEachConcurrent(uncachedIds, REPORT_CONCURRENCY, async (matchId, index) => {
        await requestReport(season, matchId)
        if (index < uncachedIds.length - 1) {
          await new Promise((resolve) => globalThis.setTimeout(resolve, REPORT_REQUEST_PAUSE_MS))
        }
      })
    } catch (error) {
      loadErrorsBySeason.value[season.key] =
        error instanceof Error ? error.message : 'Unbekannter Ladefehler.'
    } finally {
      loadingBySeason.value[season.key] = false
    }
  }

  async function loadReports(seasons: SeasonConfig | SeasonConfig[] = defaultSeason ?? []): Promise<void> {
    const requestedSeasons = Array.isArray(seasons) ? seasons : [seasons]
    const uniqueSeasons = [...new Map(requestedSeasons.map((season) => [season.key, season])).values()]
    for (const season of uniqueSeasons) {
      if (season.eventId === null || season.phaseId === null || season.participantId === null) continue
      await loadSeasonReports(season)
    }
  }

  function clearCache(): void {
    reportsBySeason.value = {}
    matchIdsBySeason.value = {}
    failedReportsBySeason.value = {}
    attemptCountsBySeason.value = {}
    attemptLogsBySeason.value = {}
    roundErrorsBySeason.value = {}
    loadErrorsBySeason.value = {}
    loadingBySeason.value = {}
    roundCountsBySeason.value = {}
    completedRoundsBySeason.value = {}
  }

  async function runReportDiagnostics(failedMatchIds: number[], controlMatchId: number): Promise<void> {
    const season = defaultSeason
    if (!season || loading.value) return
    ensureSeasonState(season.key)
    loadingBySeason.value[season.key] = true
    loadErrorsBySeason.value[season.key] = ''
    roundErrorsBySeason.value[season.key] = []
    attemptLogsBySeason.value[season.key] = []
    failedReportsBySeason.value[season.key] = {}
    const diagnosticIds = [...new Set([...failedMatchIds, controlMatchId])]
    matchIdsBySeason.value[season.key] = diagnosticIds

    try {
      for (const [index, matchId] of diagnosticIds.entries()) {
        await requestReport(season, matchId)
        if (index < diagnosticIds.length - 1) {
          await new Promise((resolve) => globalThis.setTimeout(resolve, REPORT_REQUEST_PAUSE_MS))
        }
      }
    } finally {
      loadingBySeason.value[season.key] = false
    }
  }

  async function clearAndReload(): Promise<void> {
    if (loading.value) return
    clearCache()
    await loadReports()
  }

  return {
    eventId,
    phaseId,
    reports,
    matchIds,
    failedReports,
    attemptCounts,
    attemptLog,
    roundErrors,
    loading,
    loadError,
    roundCount,
    completedRounds,
    loadedReportCount,
    failedReportCount,
    completedReportCount,
    progressPercent,
    cachedReportCount,
    requestAttemptCount,
    reportsBySeason,
    matchIdsBySeason,
    failedReportsBySeason,
    attemptCountsBySeason,
    attemptLogsBySeason,
    roundErrorsBySeason,
    loadErrorsBySeason,
    loadingBySeason,
    roundCountsBySeason,
    completedRoundsBySeason,
    loadedReportCounts,
    failedReportCounts,
    completedReportCounts,
    progressPercentsBySeason,
    loadReports,
    runReportDiagnostics,
    clearCache,
    clearAndReload,
  }
})
