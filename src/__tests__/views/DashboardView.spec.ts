import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import DashboardView from '../../views/DashboardView.vue'
import { getAvailableSeasons } from '../../services/seasonConfig'
import { usePlayerRosterStore } from '../../stores/playerRoster'
import { useSeasonStore } from '../../stores/season'
import { useTeamStandingsStore } from '../../stores/teamStandings'
import type { SeasonTeamMatch } from '../../services/teamSchedule'
import type { TeamStandingRow } from '../../services/teamStandings'

const match = (
  matchId: number,
  opponent: string,
  teamSide: 'home' | 'guest' = 'home',
  setsHome: number | null = null,
  setsAway: number | null = null,
): SeasonTeamMatch => ({
  matchId,
  datePlanned: '2026-05-01T18:00:00Z',
  participantHome: teamSide === 'home'
    ? { id: 527581, displayName: 'Hirsch-Rabauken' }
    : { id: 1, displayName: opponent },
  participantGuest: teamSide === 'guest'
    ? { id: 527581, displayName: 'Hirsch-Rabauken' }
    : { id: 1, displayName: opponent },
  statusCd: setsHome === null || setsAway === null ? 'OPEN' : 'FINISH',
  setsHome,
  setsAway,
  legsHome: null,
  legsAway: null,
  roundName: null,
})

const standing = (participantName: string, placement: number, participantId = 1): TeamStandingRow => ({
  placement,
  participantName,
  participantId,
  matchCount: 14,
  win: 8,
  lost: 6,
  tie: 0,
  points1: 16,
  points2: 10,
  sets1: 28,
  sets2: 21,
  setDifference: 7,
  legs1: 130,
  legs2: 110,
  legDifference: 20,
})

describe('Dashboard season selection', () => {
  it('shows only the selected half, both for Gesamt, and uses cached store data', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const seasonStore = useSeasonStore()
    const rosterStore = usePlayerRosterStore()
    const standingsStore = useTeamStandingsStore()
    const seasons = getAvailableSeasons()
    const h1 = seasons.find(({ key }) => key === '2026-1')!
    const h2 = seasons.find(({ key }) => key === '2026-2')!
    rosterStore.rosters[h1.key] = []
    rosterStore.rosters[h2.key] = []
    rosterStore.teamMatchesBySeason[h1.key] = [
      match(1, 'H1 Heim', 'home', 3, 2),
      match(3, 'H1 Auswärts', 'guest', 1, 4),
    ]
    rosterStore.teamMatchesBySeason[h2.key] = [match(2, 'H2 Heim')]
    standingsStore.standingsBySeason[h1.key] = [
      standing('Team H1 via ID', 1, 527581),
      standing('Hirsch-Rabauken', 2, 700001),
    ]
    standingsStore.standingsBySeason[h2.key] = [
      standing('Gegner H2', 1),
      standing('Team H2 via ID', 2, 682469),
    ]
    const loadRosters = vi.spyOn(rosterStore, 'loadRosters')
    const loadStandings = vi.spyOn(standingsStore, 'loadStandingsForSeasons')
    seasonStore.selectedSeason = h1.key

    const wrapper = mount(DashboardView, { global: { plugins: [pinia] } })
    await nextTick()
    expect(wrapper.text()).toContain('2026 – 1. Halbjahr')
    expect(wrapper.text()).not.toContain('2026 – 2. Halbjahr')
    expect(loadRosters).toHaveBeenLastCalledWith([h1])
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.findAll('a.ranking-link')).toHaveLength(0)
    expect(wrapper.find('.ranking-table').text()).toContain('28 : 21')
    expect(loadStandings).toHaveBeenLastCalledWith([h1])
    expect(wrapper.find('tbody tr').classes()).not.toContain('team-match-row')
    expect(wrapper.find('td.team-name').text()).toBe('Hirsch-Rabauken')
    const h1Rows = wrapper.findAll('.schedule-panel tbody tr')
    expect(h1Rows[0]?.find('.match-result').text()).toBe('3 : 2')
    expect(h1Rows[0]?.findAll('.team-score')).toHaveLength(1)
    expect(h1Rows[0]?.find('.team-score').text()).toBe('3')
    expect(h1Rows[0]?.find('.match-result > span:last-child').classes()).not.toContain('team-score')
    expect(h1Rows[1]?.find('.match-result').text()).toBe('1 : 4')
    expect(h1Rows[1]?.find('.team-score').text()).toBe('4')
    expect(wrapper.findAll('.schedule-panel td.team-name')).toHaveLength(2)
    expect(wrapper.find('.team-standing-row').text()).toContain('Team H1 via ID')
    expect(wrapper.findAll('.team-standing-row')).toHaveLength(1)

    seasonStore.selectedSeason = 'all'
    await nextTick()
    expect(wrapper.text()).toContain('2026 – 1. Halbjahr')
    expect(wrapper.text()).toContain('2026 – 2. Halbjahr')
    expect(loadRosters).toHaveBeenLastCalledWith([h2, h1])
    expect(wrapper.findAll('.ranking-table')).toHaveLength(2)
    expect(wrapper.findAll('.team-standing-row')).toHaveLength(2)
    expect(loadStandings).toHaveBeenLastCalledWith([h2, h1])

    seasonStore.selectedSeason = h2.key
    await nextTick()
    expect(wrapper.text()).toContain('2026 – 2. Halbjahr')
    expect(wrapper.text()).not.toContain('2026 – 1. Halbjahr')
    expect(loadRosters).toHaveBeenLastCalledWith([h2])
    expect(wrapper.findAll('.ranking-table')).toHaveLength(1)
    expect(wrapper.find('.ranking-table').text()).toContain('Gegner H2')
    expect(wrapper.find('.schedule-panel .match-open').text()).toBe('Offen')
    expect(loadStandings).toHaveBeenLastCalledWith([h2])
    expect(loadRosters).toHaveBeenCalledTimes(3)
  })
})
