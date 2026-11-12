import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getAvailableSeasons } from '../services/seasonConfig'
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
  const season = getAvailableSeasons().find(({ key }) => key === '2026-1')
  const eventId = season?.eventId ?? null
  const phaseId = season?.phaseId ?? null

  // Raw report responses stay in this in-memory Pinia state; no persistence plugin is used.
  const reports = ref<Record<number, unknown>>({})
  const matchIds = ref<number[]>([])
  const failedReports = ref<Record<number, ReportAttemptRecord>>({})
  const attemptCounts = ref<Record<number, number>>({})
  const attemptLog = ref<ReportAttemptRecord[]>([])
  const roundErrors = ref<string[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const roundCount = ref(0)
  const completedRounds = ref(0)

  const loadedReportCount = computed(
    () => matchIds.value.filter((id) => id in reports.value).length,
  )
  const failedReportCount = computed(
    () => matchIds.value.filter((id) => id in failedReports.value).length,
  )
  const completedReportCount = computed(() => loadedReportCount.value + failedReportCount.value)
  const progressPercent = computed(() =>
    matchIds.value.length === 0
      ? 0
      : Math.floor((completedReportCount.value / matchIds.value.length) * 100),
  )
  const cachedReportCount = computed(() => Object.keys(reports.value).length)
  const requestAttemptCount = computed(() => attemptLog.value.length)

  async function requestReport(matchId: number): Promise<void> {
    for (let localAttempt = 1; localAttempt <= MAX_REPORT_ATTEMPTS; localAttempt += 1) {
      const attemptNumber = (attemptCounts.value[matchId] ?? 0) + 1
      attemptCounts.value[matchId] = attemptNumber
      const attemptedAt = new Date().toISOString()

      try {
        const response = await fetchMatchReportWithMetadata(eventId!, matchId)
        reports.value[matchId] = response.data
        delete failedReports.value[matchId]
        attemptLog.value.push({
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
        failedReports.value[matchId] = record
        attemptLog.value.push(record)
      }

      if (localAttempt < MAX_REPORT_ATTEMPTS) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, REPORT_REQUEST_PAUSE_MS))
      }
    }
  }

  async function loadReports(): Promise<void> {
    if (loading.value) return
    if (eventId === null || phaseId === null) {
      loadError.value = 'Für H1 2026 sind keine Event- und Phase-IDs konfiguriert.'
      return
    }

    loading.value = true
    loadError.value = ''
    roundErrors.value = []
    failedReports.value = {}
    roundCount.value = 0
    completedRounds.value = 0

    try {
      const phase = await fetchSeasonPhase(eventId, phaseId)
      const rounds = Array.isArray(phase.rounds) ? phase.rounds : []
      const roundIds = [...new Set(
        rounds
          .map((round) => positiveId(round.id ?? round.roundId))
          .filter((id): id is number => id !== null),
      )]

      if (roundIds.length === 0) {
        throw new Error('Die Phasenantwort enthält keine gültigen Runden-IDs.')
      }

      roundCount.value = roundIds.length
      const allMatchIds = new Set<number>()

      await forEachConcurrent(roundIds, ROUND_CONCURRENCY, async (roundId) => {
        try {
          const round: ThreeKDartsRound = await fetchSeasonRound(eventId, phaseId, roundId)
          const matches = Array.isArray(round.matches) ? round.matches : []
          for (const match of matches) {
            const matchId = positiveId(match.id ?? match.matchId)
            if (matchId !== null) allMatchIds.add(matchId)
          }
        } catch (error) {
          roundErrors.value.push(
            `Runde ${roundId}: ${error instanceof Error ? error.message : 'Unbekannter Fehler.'}`,
          )
        } finally {
          completedRounds.value += 1
        }
      })

      matchIds.value = [...allMatchIds].sort((a, b) => a - b)
      if (matchIds.value.length === 0) {
        throw new Error('Aus den Rundendaten konnten keine Match-IDs ermittelt werden.')
      }

      const uncachedIds = matchIds.value.filter((id) => !(id in reports.value))
      await forEachConcurrent(uncachedIds, REPORT_CONCURRENCY, async (matchId, index) => {
        await requestReport(matchId)
        if (index < uncachedIds.length - 1) {
          await new Promise((resolve) => globalThis.setTimeout(resolve, REPORT_REQUEST_PAUSE_MS))
        }
      })
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Unbekannter Ladefehler.'
    } finally {
      loading.value = false
    }
  }

  function clearCache(): void {
    reports.value = {}
    matchIds.value = []
    failedReports.value = {}
    attemptCounts.value = {}
    attemptLog.value = []
    roundErrors.value = []
    loadError.value = ''
    roundCount.value = 0
    completedRounds.value = 0
  }

  async function runReportDiagnostics(failedMatchIds: number[], controlMatchId: number): Promise<void> {
    if (loading.value || eventId === null) return

    loading.value = true
    loadError.value = ''
    roundErrors.value = []
    attemptLog.value = []
    failedReports.value = {}
    const diagnosticIds = [...new Set([...failedMatchIds, controlMatchId])]
    matchIds.value = diagnosticIds

    try {
      for (const [index, matchId] of diagnosticIds.entries()) {
        await requestReport(matchId)
        if (index < diagnosticIds.length - 1) {
          await new Promise((resolve) => globalThis.setTimeout(resolve, REPORT_REQUEST_PAUSE_MS))
        }
      }
    } finally {
      loading.value = false
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
    loadReports,
    runReportDiagnostics,
    clearCache,
    clearAndReload,
  }
})
