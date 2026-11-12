import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getAvailableSeasons, getCurrentSeasonKey } from '../services/seasonConfig'

export interface SeasonOption {
  label: string
  value: string
}

export const useSeasonStore = defineStore('season', () => {
  const seasons = ref<SeasonOption[]>([
    { label: 'Gesamt', value: 'all' },
    ...getAvailableSeasons().map(({ label, key }) => ({ label, value: key })),
  ])
  const selectedSeason = ref(getCurrentSeasonKey())
  const selectedSeasonLabel = computed(
    () => seasons.value.find(({ value }) => value === selectedSeason.value)?.label ?? 'Gesamt',
  )

  return { seasons, selectedSeason, selectedSeasonLabel }
})
