import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchSeasonParticipant } from '../services/threeKDartsApi'
import { normalizeSeasonRoster, type SeasonRosterPlayer } from '../services/playerRoster'
import type { SeasonConfig } from '../services/seasonConfig'

export const usePlayerRosterStore = defineStore('playerRoster', () => {
  const rosters = ref<Record<string, SeasonRosterPlayer[]>>({})
  const loading = ref<Record<string, boolean>>({})
  const errors = ref<Record<string, string>>({})

  async function loadRoster(season: SeasonConfig): Promise<void> {
    if (!season.participantId || rosters.value[season.key] || loading.value[season.key]) return

    loading.value[season.key] = true
    delete errors.value[season.key]
    try {
      const response = await fetchSeasonParticipant(season.participantId, season.eventId ?? 39389)
      rosters.value[season.key] = normalizeSeasonRoster(response)
    } catch (error) {
      errors.value[season.key] =
        error instanceof Error ? error.message : 'Die Teilnehmerliste konnte nicht geladen werden.'
    } finally {
      loading.value[season.key] = false
    }
  }

  async function loadRosters(seasons: SeasonConfig[]): Promise<void> {
    await Promise.all(seasons.map((season) => loadRoster(season)))
  }

  return { rosters, loading, errors, loadRoster, loadRosters }
})
