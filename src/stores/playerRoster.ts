import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchSeasonParticipant } from '../services/threeKDartsApi'
import { normalizeSeasonRoster, type SeasonRosterPlayer } from '../services/playerRoster'
import { normalizeSeasonTeamMatches, type SeasonTeamMatch } from '../services/teamSchedule'
import type { SeasonConfig } from '../services/seasonConfig'

export const usePlayerRosterStore = defineStore('playerRoster', () => {
  const rosters = ref<Record<string, SeasonRosterPlayer[]>>({})
  const teamMatchesBySeason = ref<Record<string, SeasonTeamMatch[]>>({})
  const loading = ref<Record<string, boolean>>({})
  const errors = ref<Record<string, string>>({})

  async function loadRoster(season: SeasonConfig): Promise<void> {
    if (!season.participantId) return
    if (rosters.value[season.key] && season.key in teamMatchesBySeason.value) return
    if (loading.value[season.key]) return

    loading.value[season.key] = true
    delete errors.value[season.key]
    try {
      const response = await fetchSeasonParticipant(season.participantId, season.eventId ?? 39389)
      teamMatchesBySeason.value[season.key] = normalizeSeasonTeamMatches(
        response,
        season.participantId,
      )
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

  return { rosters, teamMatchesBySeason, loading, errors, loadRoster, loadRosters }
})
