import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import DashboardView from '../../views/DashboardView.vue'
import { getAvailableSeasons } from '../../services/seasonConfig'
import { usePlayerRosterStore } from '../../stores/playerRoster'
import { useSeasonStore } from '../../stores/season'
import type { SeasonTeamMatch } from '../../services/teamSchedule'

const match = (matchId: number, home: string): SeasonTeamMatch => ({
  matchId,
  datePlanned: '2026-05-01T18:00:00Z',
  participantHome: { id: 527581, displayName: home },
  participantGuest: { id: 1, displayName: 'Gegner' },
  statusCd: 'OPEN',
  setsHome: null,
  setsAway: null,
  legsHome: null,
  legsAway: null,
  roundName: null,
})

describe('Dashboard season selection', () => {
  it('shows only the selected half, both for Gesamt, and uses cached store data', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const seasonStore = useSeasonStore()
    const rosterStore = usePlayerRosterStore()
    const seasons = getAvailableSeasons()
    const h1 = seasons.find(({ key }) => key === '2026-1')!
    const h2 = seasons.find(({ key }) => key === '2026-2')!
    rosterStore.rosters[h1.key] = []
    rosterStore.rosters[h2.key] = []
    rosterStore.teamMatchesBySeason[h1.key] = [match(1, 'H1 Heim')]
    rosterStore.teamMatchesBySeason[h2.key] = [match(2, 'H2 Heim')]
    const loadRosters = vi.spyOn(rosterStore, 'loadRosters')
    seasonStore.selectedSeason = h1.key

    const wrapper = mount(DashboardView, { global: { plugins: [pinia] } })
    await nextTick()
    expect(wrapper.text()).toContain('2026 – 1. Halbjahr')
    expect(wrapper.text()).not.toContain('2026 – 2. Halbjahr')
    expect(loadRosters).toHaveBeenLastCalledWith([h1])

    seasonStore.selectedSeason = 'all'
    await nextTick()
    expect(wrapper.text()).toContain('2026 – 1. Halbjahr')
    expect(wrapper.text()).toContain('2026 – 2. Halbjahr')
    expect(loadRosters).toHaveBeenLastCalledWith([h2, h1])

    seasonStore.selectedSeason = h2.key
    await nextTick()
    expect(wrapper.text()).toContain('2026 – 2. Halbjahr')
    expect(wrapper.text()).not.toContain('2026 – 1. Halbjahr')
    expect(loadRosters).toHaveBeenLastCalledWith([h2])
    expect(loadRosters).toHaveBeenCalledTimes(3)
  })
})
