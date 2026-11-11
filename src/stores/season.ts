import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export interface SeasonOption {
  label: string
  value: string
}

function getCurrentSeason(): string {
  const now = new Date()
  return `${now.getFullYear()}-${now.getMonth() < 6 ? 1 : 2}`
}

function getAvailableSeasons(): SeasonOption[] {
  const currentYear = new Date().getFullYear()
  const seasons: SeasonOption[] = [{ label: 'Gesamt', value: 'all' }]

  for (let year = 2026; year <= currentYear; year += 1) {
    const halfYears = year === currentYear && new Date().getMonth() < 6 ? [1] : [1, 2]
    for (const half of halfYears) {
      seasons.push({ label: `${year} · ${half}. Halbjahr`, value: `${year}-${half}` })
    }
  }

  return seasons
}

export const useSeasonStore = defineStore('season', () => {
  const seasons = ref(getAvailableSeasons())
  const selectedSeason = ref(getCurrentSeason())
  const selectedSeasonLabel = computed(
    () => seasons.value.find(({ value }) => value === selectedSeason.value)?.label ?? 'Gesamt',
  )

  return { seasons, selectedSeason, selectedSeasonLabel }
})
