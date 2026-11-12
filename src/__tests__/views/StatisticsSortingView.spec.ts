import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StatisticsView from '../../views/StatisticsView.vue'
import { getAvailableSeasons } from '../../services/seasonConfig'
import type { PlayerStatisticsRow } from '../../services/playerStatistics'
import type { DoublesPairStatisticsRow } from '../../services/doublesPairStatistics'
import { useMatchReportsStore } from '../../stores/matchReports'
import { usePlayerRosterStore } from '../../stores/playerRoster'
import { useSeasonStore } from '../../stores/season'

const statisticsData = vi.hoisted(() => ({
  players: [] as PlayerStatisticsRow[],
  pairs: [] as DoublesPairStatisticsRow[],
}))

vi.mock('../../services/playerStatistics', () => ({
  calculatePlayerStatistics: () => ({ players: statisticsData.players, unmatchedNames: [] }),
}))

vi.mock('../../services/doublesPairStatistics', () => ({
  calculateDoublesPairStatistics: () => ({ pairs: statisticsData.pairs, unmatchedNames: [] }),
  filterDoublesPairsByPlayer: (pairs: DoublesPairStatisticsRow[], playerId: string | null) =>
    playerId === null ? [...pairs] : pairs.filter((pair) => pair.playerIds.includes(playerId)),
}))

const summary = (played: number, won: number, winPercentage: number | null) => ({
  played,
  won,
  winPercentage,
  legsWon: 0,
  legsLost: 0,
  legDifference: 0,
})

function setupSortingView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const matchStore = useMatchReportsStore()
  const rosterStore = usePlayerRosterStore()
  const seasonStore = useSeasonStore()
  const season = getAvailableSeasons().find(({ key }) => key === '2026-1')!
  seasonStore.selectedSeason = season.key
  rosterStore.rosters[season.key] = [
    { playerId: '1', displayName: 'Adam' },
    { playerId: '2', displayName: 'Ben' },
    { playerId: '3', displayName: 'Zoe' },
  ]
  rosterStore.teamMatchesBySeason[season.key] = [
    {
      matchId: 1,
      datePlanned: null,
      participantHome: { id: 527581, displayName: 'Hirsch-Rabauken' },
      participantGuest: { id: 1, displayName: 'Gegner' },
      statusCd: 'FINISH',
      setsHome: 1,
      setsAway: 0,
      legsHome: 1,
      legsAway: 0,
      roundName: null,
    },
  ]
  matchStore.matchIdsBySeason[season.key] = [1]
  matchStore.reportsBySeason[season.key] = { 1: [] }
  matchStore.roundIdsBySeason[season.key] = [1]
  matchStore.roundDataBySeason[season.key] = { 1: { matches: [] } }
  matchStore.failedRoundsBySeason[season.key] = {}
  matchStore.roundErrorsBySeason[season.key] = []
  matchStore.roundCountsBySeason[season.key] = 1
  matchStore.completedRoundsBySeason[season.key] = 1
  matchStore.loadingBySeason[season.key] = false
  matchStore.roundLoadingBySeason[season.key] = false
  matchStore.reportLoadingBySeason[season.key] = false
  matchStore.loadErrorsBySeason[season.key] = ''
  vi.spyOn(matchStore, 'loadReports').mockResolvedValue()
  vi.spyOn(rosterStore, 'loadRosters').mockResolvedValue()

  statisticsData.players = [
    { playerId: '3', displayName: 'Zoe', singles: summary(10, 3, 30), doubles: summary(1, 1, 100) },
    { playerId: '1', displayName: 'Adam', singles: summary(2, 2, 100), doubles: summary(9, 6, 66.666) },
    { playerId: '2', displayName: 'Ben', singles: summary(5, 4, 80), doubles: summary(4, 2, 50) },
  ]
  statisticsData.pairs = [
    { pairKey: '3|2', playerIds: ['3', '2'], displayNames: ['Zoe', 'Ben'], played: 1, won: 1, winPercentage: 100, legsWon: 1, legsLost: 0, legDifference: 1 },
    { pairKey: '1|2', playerIds: ['1', '2'], displayNames: ['Adam', 'Ben'], played: 4, won: 2, winPercentage: 50, legsWon: 2, legsLost: 2, legDifference: 0 },
  ]

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
  return wrapper
}

function rowNames(section: ReturnType<typeof mount>): string[] {
  return section.findAll('tbody tr th[scope="row"]').map((row) => row.text())
}

describe('statistics sorting by column clicks', () => {
  it('sorts independently, toggles direction, and keeps the pair player filter independent', async () => {
    const wrapper = setupSortingView()
    const [singles, doubles] = wrapper.findAll('.stats-kind')
    const pairs = wrapper.find('.pair-statistics')

    expect(rowNames(singles!)).toEqual(['Adam', 'Ben', 'Zoe'])
    expect(rowNames(doubles!)).toEqual(['Adam', 'Ben', 'Zoe'])
    expect(rowNames(pairs)).toEqual(['Adam & Ben', 'Zoe & Ben'])
    expect(singles!.find('th[aria-sort="ascending"] .sort-header').text()).toContain('Spieler')
    expect(pairs.find('th[aria-sort="ascending"] .sort-header').text()).toContain('Paarung')

    const playedHeader = singles!.findAll('button.sort-header')[1]!
    await playedHeader.trigger('click')
    expect(rowNames(singles!)).toEqual(['Zoe', 'Ben', 'Adam'])
    expect(rowNames(doubles!)).toEqual(['Adam', 'Ben', 'Zoe'])
    expect(rowNames(pairs)).toEqual(['Adam & Ben', 'Zoe & Ben'])
    expect(singles!.find('th[aria-sort="descending"] .sort-header').text()).toContain('Gespielt')

    await playedHeader.trigger('click')
    expect(rowNames(singles!)).toEqual(['Adam', 'Ben', 'Zoe'])
    const playerHeader = singles!.findAll('button.sort-header')[0]!
    await playerHeader.trigger('click')
    expect(rowNames(singles!)).toEqual(['Adam', 'Ben', 'Zoe'])
    await playerHeader.trigger('click')
    expect(rowNames(singles!)).toEqual(['Zoe', 'Ben', 'Adam'])
    const wonHeader = singles!.findAll('button.sort-header')[2]!
    await wonHeader.trigger('click')
    expect(rowNames(singles!)).toEqual(['Ben', 'Zoe', 'Adam'])
    await wonHeader.trigger('click')
    expect(rowNames(singles!)).toEqual(['Adam', 'Zoe', 'Ben'])
    const percentageHeader = singles!.findAll('button.sort-header')[3]!
    await percentageHeader.trigger('click')
    expect(rowNames(singles!)).toEqual(['Adam', 'Ben', 'Zoe'])

    const pairFilter = pairs.get('#pair-player-filter')
    const pairPlayedHeader = pairs.findAll('button.sort-header')[1]!
    await pairPlayedHeader.trigger('click')
    expect(rowNames(pairs)).toEqual(['Adam & Ben', 'Zoe & Ben'])
    await pairPlayedHeader.trigger('click')
    expect(rowNames(pairs)).toEqual(['Zoe & Ben', 'Adam & Ben'])
    await pairFilter.setValue('3')
    expect(rowNames(pairs)).toEqual(['Zoe & Ben'])
    expect(rowNames(singles!)).toEqual(['Adam', 'Ben', 'Zoe'])
  })
})
