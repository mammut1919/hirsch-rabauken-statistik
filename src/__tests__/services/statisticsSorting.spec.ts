import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STATISTICS_SORT,
  sortStatisticsRows,
  toggleStatisticsSort,
  type StatisticsSortKey,
} from '../../services/statisticsSorting'

const rows = [
  { id: 'z', name: 'Zoe', played: 10, won: 5, winPercentage: 50 },
  { id: 'a', name: 'Adam', played: 2, won: 2, winPercentage: 100 },
  { id: 'b', name: 'Ben', played: 2, won: 1, winPercentage: 50 },
  { id: 'c', name: 'Cara', played: 10, won: 8, winPercentage: 80 },
  { id: 'd', name: 'Dora', played: 2, won: 1, winPercentage: 45.14 },
  { id: 'e', name: 'Eli', played: 2, won: 1, winPercentage: 45.11 },
  { id: 'n', name: 'Zero', played: 0, won: 0, winPercentage: null },
]

function sortedIds(sortKey: StatisticsSortKey): string[] {
  return sortStatisticsRows(rows, sortKey, (row) => row).map(({ id }) => id)
}

describe('statistics table sorting', () => {
  it('defaults to player name ascending', () => {
    expect(DEFAULT_STATISTICS_SORT).toBe('name-asc')
    expect(sortedIds(DEFAULT_STATISTICS_SORT)).toEqual(['a', 'b', 'c', 'd', 'e', 'n', 'z'])
  })

  it.each([
    ['name-asc', ['a', 'b', 'c', 'd', 'e', 'n', 'z']],
    ['name-desc', ['z', 'n', 'e', 'd', 'c', 'b', 'a']],
    ['played-desc', ['c', 'z', 'a', 'b', 'd', 'e', 'n']],
    ['played-asc', ['n', 'a', 'b', 'd', 'e', 'c', 'z']],
    ['won-desc', ['c', 'z', 'a', 'b', 'd', 'e', 'n']],
    ['won-asc', ['n', 'b', 'd', 'e', 'a', 'z', 'c']],
    ['winPercentage-desc', ['a', 'c', 'b', 'z', 'd', 'e', 'n']],
    ['winPercentage-asc', ['e', 'd', 'b', 'z', 'c', 'a', 'n']],
  ] as const)('sorts by %s with its requested direction and stable name ties', (key, expected) => {
    expect(sortedIds(key)).toEqual(expected)
  })

  it('sorts by the unrounded percentage and leaves input rows untouched', () => {
    const originalOrder = rows.map(({ id }) => id)
    expect(sortedIds('winPercentage-desc').indexOf('d')).toBeLessThan(
      sortedIds('winPercentage-desc').indexOf('e'),
    )
    expect(rows.map(({ id }) => id)).toEqual(originalOrder)
  })

  it('uses column defaults and reverses direction on repeated column clicks', () => {
    expect(toggleStatisticsSort('played-desc', 'name')).toBe('name-asc')
    expect(toggleStatisticsSort('name-asc', 'name')).toBe('name-desc')
    expect(toggleStatisticsSort('name-desc', 'name')).toBe('name-asc')
    expect(toggleStatisticsSort('name-desc', 'played')).toBe('played-desc')
    expect(toggleStatisticsSort('played-desc', 'played')).toBe('played-asc')
    expect(toggleStatisticsSort('won-asc', 'winPercentage')).toBe('winPercentage-desc')
  })
})
