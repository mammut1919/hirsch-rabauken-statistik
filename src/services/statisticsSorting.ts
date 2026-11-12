export type StatisticsSortKey =
  | 'name-asc'
  | 'name-desc'
  | 'played-desc'
  | 'played-asc'
  | 'won-desc'
  | 'won-asc'
  | 'winPercentage-desc'
  | 'winPercentage-asc'

export const DEFAULT_STATISTICS_SORT: StatisticsSortKey = 'name-asc'

export type StatisticsSortColumn = 'name' | 'played' | 'won' | 'winPercentage'

export function getStatisticsSortColumn(sortKey: StatisticsSortKey): StatisticsSortColumn {
  if (sortKey.startsWith('winPercentage')) return 'winPercentage'
  if (sortKey.startsWith('played')) return 'played'
  if (sortKey.startsWith('won')) return 'won'
  return 'name'
}

export function toggleStatisticsSort(
  currentSort: StatisticsSortKey,
  column: StatisticsSortColumn,
): StatisticsSortKey {
  if (getStatisticsSortColumn(currentSort) === column) {
    return `${column}-${currentSort.endsWith('-asc') ? 'desc' : 'asc'}` as StatisticsSortKey
  }
  return `${column}-${column === 'name' ? 'asc' : 'desc'}` as StatisticsSortKey
}

export const STATISTICS_SORT_OPTIONS: ReadonlyArray<{
  value: StatisticsSortKey
  label: string
}> = [
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'played-desc', label: 'Gespielte Spiele absteigend' },
  { value: 'played-asc', label: 'Gespielte Spiele aufsteigend' },
  { value: 'won-desc', label: 'Gewonnene Spiele absteigend' },
  { value: 'won-asc', label: 'Gewonnene Spiele aufsteigend' },
  { value: 'winPercentage-desc', label: 'Gewinnquote absteigend' },
  { value: 'winPercentage-asc', label: 'Gewinnquote aufsteigend' },
]

export interface StatisticsSortValues {
  name: string
  stableId: string
  played: number
  won: number
  winPercentage: number | null
}

export function sortStatisticsRows<T>(
  rows: readonly T[],
  sortKey: StatisticsSortKey,
  getValues: (row: T) => StatisticsSortValues,
): T[] {
  const direction = sortKey.endsWith('-asc') ? 1 : -1
  const criterion = sortKey.startsWith('winPercentage')
    ? 'winPercentage'
    : sortKey.startsWith('played')
      ? 'played'
      : sortKey.startsWith('won')
        ? 'won'
        : 'name'

  return [...rows].sort((a, b) => {
    const left = getValues(a)
    const right = getValues(b)

    if (criterion === 'name') {
      const nameOrder = left.name.localeCompare(right.name, 'de') * direction
      return nameOrder || left.stableId.localeCompare(right.stableId)
    }

    if (criterion === 'winPercentage') {
      if (left.winPercentage === null || right.winPercentage === null) {
        if (left.winPercentage === right.winPercentage) {
          return left.name.localeCompare(right.name, 'de') || left.stableId.localeCompare(right.stableId)
        }
        return left.winPercentage === null ? 1 : -1
      }
    }

    const leftValue = left[criterion]
    const rightValue = right[criterion]
    const valueOrder = ((leftValue as number) - (rightValue as number)) * direction
    return valueOrder || left.name.localeCompare(right.name, 'de') || left.stableId.localeCompare(right.stableId)
  })
}
