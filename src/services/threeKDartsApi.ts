const dsabApiBaseUrl = 'https://backend-dsab.3k-darts.com/2k-backend-dsab/api/v1'
const REQUEST_TIMEOUT_MS = 30_000

export type RequestFailureCategory = 'HTTP-Status' | 'TypeError/NetworkError' | 'Timeout' | 'Sonstiger Fehler'

export interface JsonResponseMetadata {
  data: unknown
  httpStatus: number
  contentType: string
  byteLength: number
}

export class ThreeKDartsApiError extends Error {
  constructor(
    message: string,
    readonly category: RequestFailureCategory = 'Sonstiger Fehler',
    readonly httpStatus?: number,
    readonly originalErrorName?: string,
  ) {
    super(message)
    this.name = 'ThreeKDartsApiError'
  }
}

export interface ThreeKDartsPhase {
  rounds?: Array<{ id?: number; roundId?: number }>
}

export interface ThreeKDartsRound {
  matches?: Array<{
    id?: number
    matchId?: number
    participantHome?: { id?: number | string }
    participantGuest?: { id?: number | string }
  }>
}

export function fetchSeasonParticipant(participantId: number): Promise<unknown> {
  return fetchJson(`${dsabApiBaseUrl}/frontend/participant/${participantId}`)
}

export interface SeasonRequestUrls {
  teamSchedule: URL
  matchReports: URL
}

function classifyTransportError(error: unknown): ThreeKDartsApiError {
  const errorName = error instanceof Error ? error.name : undefined
  const message = error instanceof Error ? error.message : 'Unbekannter Browserfehler.'
  if (errorName === 'TypeError' || errorName === 'NetworkError') {
    return new ThreeKDartsApiError(
      `Browser-Netzwerkfehler: ${message}`,
      'TypeError/NetworkError',
      undefined,
      errorName,
    )
  }
  return new ThreeKDartsApiError(message, 'Sonstiger Fehler', undefined, errorName)
}

async function fetchJsonWithMetadata(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<JsonResponseMetadata> {
  const controller = new AbortController()
  let timedOut = false
  const timeoutHandle = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetcher(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (error) {
    globalThis.clearTimeout(timeoutHandle)
    if (timedOut) {
      throw new ThreeKDartsApiError(
        `Der Abruf überschritt das Zeitlimit von ${REQUEST_TIMEOUT_MS} ms.`,
        'Timeout',
        undefined,
        error instanceof Error ? error.name : undefined,
      )
    }
    throw classifyTransportError(error)
  }

  if (!response.ok) {
    globalThis.clearTimeout(timeoutHandle)
    throw new ThreeKDartsApiError(
      `3K-Frontend antwortete mit HTTP ${response.status}.`,
      'HTTP-Status',
      response.status,
    )
  }

  let responseText: string
  try {
    responseText = await response.text()
  } catch (error) {
    globalThis.clearTimeout(timeoutHandle)
    if (timedOut) {
      throw new ThreeKDartsApiError(
        `Das Lesen der Antwort überschritt das Zeitlimit von ${REQUEST_TIMEOUT_MS} ms.`,
        'Timeout',
        response.status,
        error instanceof Error ? error.name : undefined,
      )
    }
    const classified = classifyTransportError(error)
    throw new ThreeKDartsApiError(
      classified.message,
      classified.category,
      response.status,
      classified.originalErrorName,
    )
  } finally {
    globalThis.clearTimeout(timeoutHandle)
  }

  let data: unknown
  try {
    data = JSON.parse(responseText)
  } catch (error) {
    throw new ThreeKDartsApiError(
      'Die 3K-Frontend-Antwort war kein gültiges JSON.',
      'Sonstiger Fehler',
      response.status,
      error instanceof Error ? error.name : undefined,
    )
  }

  return {
    data,
    httpStatus: response.status,
    contentType: response.headers.get('content-type') ?? '',
    byteLength: new TextEncoder().encode(responseText).byteLength,
  }
}

async function fetchJson(url: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  return (await fetchJsonWithMetadata(url, fetcher)).data
}

export async function fetchThreeKDartsJson(
  url: URL,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  if (url.protocol !== 'https:') {
    throw new ThreeKDartsApiError('3K-Frontend-Aufrufe müssen HTTPS verwenden.')
  }
  return fetchJson(url.href, fetcher)
}

export async function fetchSeasonResponses(
  urls: SeasonRequestUrls,
  fetcher: typeof fetch = fetch,
): Promise<{ teamSchedule: unknown; matchReports: unknown }> {
  const [teamSchedule, matchReports] = await Promise.all([
    fetchThreeKDartsJson(urls.teamSchedule, fetcher),
    fetchThreeKDartsJson(urls.matchReports, fetcher),
  ])
  return { teamSchedule, matchReports }
}

function asRecord(value: unknown, requestName: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ThreeKDartsApiError(`${requestName} lieferte kein JSON-Objekt.`)
  }
  return value as Record<string, unknown>
}

export async function fetchSeasonPhase(eventId: number, phaseId: number): Promise<ThreeKDartsPhase> {
  const data = asRecord(
    await fetchJson(`${dsabApiBaseUrl}/frontend/event/${eventId}/phase/${phaseId}`),
    'Die Phasenabfrage',
  )
  return data as ThreeKDartsPhase
}

export async function fetchSeasonRound(
  eventId: number,
  phaseId: number,
  roundId: number,
): Promise<ThreeKDartsRound> {
  const data = asRecord(
    await fetchJson(
      `${dsabApiBaseUrl}/frontend/event/${eventId}/phase/${phaseId}/round/${roundId}`,
    ),
    `Die Rundenabfrage ${roundId}`,
  )
  return data as ThreeKDartsRound
}

export function fetchMatchReport(eventId: number, matchId: number): Promise<unknown> {
  return fetchJson(`${dsabApiBaseUrl}/frontend/event/${eventId}/match/${matchId}/report`)
}

export function fetchMatchReportWithMetadata(
  eventId: number,
  matchId: number,
): Promise<JsonResponseMetadata> {
  return fetchJsonWithMetadata(
    `${dsabApiBaseUrl}/frontend/event/${eventId}/match/${matchId}/report`,
  )
}
