export type SeasonHalf = 1 | 2

export interface SeasonConfig {
  key: string
  year: number
  half: SeasonHalf
  label: string
  /** Confirmed event ID; null when not yet known for a later season. */
  eventId: number | null
  /** Unknown until confirmed against the official 3K frontend. */
  phaseId: number | null
  /** Official team participant ID used to load the seasonal roster. */
  participantId: number | null
}

export const FIRST_SEASON_YEAR = 2026

export function getAvailableSeasons(now = new Date()): SeasonConfig[] {
  const currentYear = now.getFullYear()
  const currentHalf: SeasonHalf = now.getMonth() < 6 ? 1 : 2
  const seasons: SeasonConfig[] = []

  for (let year = FIRST_SEASON_YEAR; year <= currentYear; year += 1) {
    const lastHalf: SeasonHalf = year === currentYear ? currentHalf : 2
    for (let half: SeasonHalf = 1; half <= lastHalf; half = (half + 1) as SeasonHalf) {
      seasons.push({
        key: `${year}-${half}`,
        year,
        half,
        label: `${year} · ${half}. Halbjahr`,
        eventId: year === 2026 ? (half === 1 ? 39389 : 40293) : null,
        phaseId: year === 2026 ? (half === 1 ? 3010 : 3989) : null,
        participantId: year === 2026 ? (half === 1 ? 527581 : 682469) : null,
      })
    }
  }

  return seasons
}

export function getCurrentSeasonKey(now = new Date()): string {
  return `${now.getFullYear()}-${now.getMonth() < 6 ? 1 : 2}`
}
