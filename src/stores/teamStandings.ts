import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { SeasonConfig } from '../services/seasonConfig'
import { fetchSeasonTable } from '../services/threeKDartsApi'
import { normalizeTeamStandings, type TeamStandingRow } from '../services/teamStandings'

export const useTeamStandingsStore = defineStore('teamStandings', () => {
  const standingsBySeason = ref<Record<string, TeamStandingRow[]>>({})
  const loadingBySeason = ref<Record<string, boolean>>({})
  const errorsBySeason = ref<Record<string, string>>({})

  async function loadStandings(season: SeasonConfig): Promise<void> {
    if (season.eventId === null) {
      errorsBySeason.value[season.key] = `Für ${season.label} ist keine Event-ID verfügbar.`
      return
    }
    if (season.key in standingsBySeason.value || loadingBySeason.value[season.key]) return

    loadingBySeason.value[season.key] = true
    try {
      const response = await fetchSeasonTable(season.eventId)
      standingsBySeason.value[season.key] = normalizeTeamStandings(response)
      delete errorsBySeason.value[season.key]
    } catch (error) {
      errorsBySeason.value[season.key] =
        error instanceof Error ? error.message : 'Die Mannschaftsrangliste konnte nicht geladen werden.'
    } finally {
      loadingBySeason.value[season.key] = false
    }
  }

  async function loadStandingsForSeasons(seasons: SeasonConfig[]): Promise<void> {
    await Promise.all(seasons.map((season) => loadStandings(season)))
  }

  return { standingsBySeason, loadingBySeason, errorsBySeason, loadStandings, loadStandingsForSeasons }
})
