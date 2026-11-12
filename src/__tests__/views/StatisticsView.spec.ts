import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StatisticsView from '../../views/StatisticsView.vue'
import { getAvailableSeasons } from '../../services/seasonConfig'
import { useMatchReportsStore } from '../../stores/matchReports'
import { usePlayerRosterStore } from '../../stores/playerRoster'
import { useSeasonStore } from '../../stores/season'

function setupView(options: { roundFailed?: boolean; reportFailed?: boolean; loading?: boolean; allLoaded?: boolean } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const matchStore = useMatchReportsStore()
  const rosterStore = usePlayerRosterStore()
  const seasonStore = useSeasonStore()
  const season = getAvailableSeasons().find(({ key }) => key === '2026-1')!
  seasonStore.selectedSeason = season.key
  rosterStore.rosters[season.key] = []
  rosterStore.teamMatchesBySeason[season.key] = [
    { matchId: 101, datePlanned: null, participantHome: { id: 527581, displayName: 'Hirsch-Rabauken' }, participantGuest: { id: 1, displayName: 'Gegner A' }, statusCd: 'FINISH', setsHome: 2, setsAway: 1, legsHome: null, legsAway: null, roundName: null },
    { matchId: 102, datePlanned: null, participantHome: { id: 527581, displayName: 'Hirsch-Rabauken' }, participantGuest: { id: 2, displayName: 'Gegner B' }, statusCd: 'OPEN', setsHome: null, setsAway: null, legsHome: null, legsAway: null, roundName: null },
  ]
  matchStore.matchIdsBySeason[season.key] = [101, 102]
  matchStore.reportsBySeason[season.key] = options.allLoaded ? { 101: [], 102: [] } : { 101: [] }
  matchStore.failedReportsBySeason[season.key] = options.reportFailed
    ? { 102: { matchId: 102, attemptedAt: '', attemptNumber: 3, outcome: 'Fehler' } }
    : {}
  matchStore.roundIdsBySeason[season.key] = [301]
  matchStore.roundDataBySeason[season.key] = options.roundFailed ? {} : { 301: { matches: [] } }
  matchStore.failedRoundsBySeason[season.key] = options.roundFailed ? { 301: 'Runde 301: Netzwerkfehler' } : {}
  matchStore.roundErrorsBySeason[season.key] = options.roundFailed ? ['Runde 301: Netzwerkfehler'] : []
  matchStore.roundCountsBySeason[season.key] = 1
  matchStore.completedRoundsBySeason[season.key] = 1
  matchStore.loadingBySeason[season.key] = options.loading ?? false
  matchStore.roundLoadingBySeason[season.key] = false
  matchStore.reportLoadingBySeason[season.key] = false
  matchStore.loadErrorsBySeason[season.key] = ''
  vi.spyOn(matchStore, 'loadReports').mockResolvedValue()
  vi.spyOn(rosterStore, 'loadRosters').mockResolvedValue()

  const wrapper = mount(StatisticsView, {
    global: {
      plugins: [pinia],
      stubs: {
        Message: { template: '<div><slot /></div>' },
        Tag: { template: '<span>{{ value }}<slot /></span>', props: ['value'] },
        ToggleSwitch: true,
      },
    },
  })
  return { wrapper, matchStore, season }
}

describe('StatisticsView loading controls', () => {
  it('uses the simplified section headings and has no sort dropdowns', () => {
    const { wrapper } = setupView({ allLoaded: true })

    expect(wrapper.find('#singles-heading').text()).toBe('Einzel')
    expect(wrapper.find('#doubles-heading').text()).toBe('Doppel')
    expect(wrapper.find('#pair-heading').text()).toBe('Doppel-Paarungen')
    expect(wrapper.text()).not.toContain('Einzel- und Doppelstatistik')
    expect(wrapper.text()).not.toContain('(EZ)')
    expect(wrapper.text()).not.toContain('(DP)')
    expect(wrapper.findAll('select')).toHaveLength(1)
    expect(wrapper.find('#pair-player-filter').exists()).toBe(true)
  })

  it('shows a retry button on failures and retries the currently selected season', async () => {
    const { wrapper, matchStore, season } = setupView({ roundFailed: true, reportFailed: true })

    const button = wrapper.get('button.retry-button')
    expect(button.text()).toBe('Erneut versuchen')
    expect(button.attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('1/2 Matchreports im Cache')
    await button.trigger('click')
    expect(matchStore.loadReports).toHaveBeenCalledWith([season])
  })

  it('disables retry while the selected season is loading', () => {
    const { wrapper } = setupView({ roundFailed: true, loading: true })
    expect(wrapper.get('button.retry-button').attributes('disabled')).toBeDefined()
  })

  it('hides both progress sections when expected rounds and reports loaded successfully', () => {
    const { wrapper } = setupView({ allLoaded: true })
    expect(wrapper.text()).toContain('2/2 Matchreports im Cache')
    expect(wrapper.text()).not.toContain('Saisonrunden')
    expect(wrapper.text()).not.toContain('Ladezustand der Matchreports')
  })
})
