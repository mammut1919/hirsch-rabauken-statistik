<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import { getAvailableSeasons } from '../services/seasonConfig'
import {
  calculatePlayerStatistics,
  type PlayerGameSummary,
  type PlayerStatisticsRow,
} from '../services/playerStatistics'
import {
  calculateDoublesPairStatistics,
  filterDoublesPairsByPlayer,
} from '../services/doublesPairStatistics'
import {
  DEFAULT_STATISTICS_SORT,
  getStatisticsSortColumn,
  sortStatisticsRows,
  toggleStatisticsSort,
  type StatisticsSortColumn,
  type StatisticsSortKey,
} from '../services/statisticsSorting'
import { useMatchReportsStore } from '../stores/matchReports'
import { usePlayerRosterStore } from '../stores/playerRoster'
import { useSeasonStore } from '../stores/season'

const matchReportsStore = useMatchReportsStore()
const rosterStore = usePlayerRosterStore()
const seasonStore = useSeasonStore()
const {
  reportsBySeason,
  matchIdsBySeason,
  loadingBySeason: seasonLoadingBySeason,
  roundLoadingBySeason,
  reportLoadingBySeason,
  roundCountsBySeason,
  completedRoundsBySeason,
  successfulRoundCountsBySeason,
  failedRoundCountsBySeason,
  loadErrorsBySeason: reportErrorsBySeason,
  roundErrorsBySeason,
  loadedReportCounts,
  failedReportCounts,
  completedReportCounts,
} = storeToRefs(matchReportsStore)
const {
  rosters,
  teamMatchesBySeason,
  loading: rosterLoading,
  errors: rosterErrors,
} = storeToRefs(rosterStore)
const { selectedSeason, selectedSeasonLabel } = storeToRefs(seasonStore)
const showLegs = ref(false)
const singlesSort = ref<StatisticsSortKey>(DEFAULT_STATISTICS_SORT)
const doublesSort = ref<StatisticsSortKey>(DEFAULT_STATISTICS_SORT)
const pairSort = ref<StatisticsSortKey>(DEFAULT_STATISTICS_SORT)
const selectedPairPlayerId = ref('')
const availableSeasons = getAvailableSeasons()

const selectedSeasonConfigs = computed(() => {
  if (selectedSeason.value === 'all') return availableSeasons
  return availableSeasons.filter(({ key }) => key === selectedSeason.value)
})

watch(
  selectedSeason,
  () => {
    selectedPairPlayerId.value = ''
    void rosterStore.loadRosters(selectedSeasonConfigs.value)
    void matchReportsStore.loadReports(selectedSeasonConfigs.value)
  },
  { immediate: true },
)

const visibleRosters = computed(() =>
  Object.fromEntries(
    selectedSeasonConfigs.value
      .filter(({ key }) => rosters.value[key])
      .map(({ key }) => [key, rosters.value[key]!]),
  ),
)

const reportSets = computed(() => {
  return selectedSeasonConfigs.value.flatMap(({ key }) => {
    const reports = reportsBySeason.value[key]
    if (!reports || !(loadedReportCounts.value[key] ?? 0)) return []
    return [{
      seasonKey: key,
      reports: Object.values(reports).flatMap((report) => Array.isArray(report) ? report : []),
    }]
  })
})

const selectedLoadedReportCount = computed(() =>
  selectedSeasonConfigs.value.reduce(
    (total, { key }) => total + (loadedReportCounts.value[key] ?? 0),
    0,
  ),
)
const selectedReportTotal = computed(() =>
  selectedSeasonConfigs.value.reduce(
    (total, { key }) => total + (matchIdsBySeason.value[key]?.length ?? 0),
    0,
  ),
)
const selectedExpectedReportCount = computed(() =>
  selectedSeasonConfigs.value.reduce(
    (total, { key }) => total + (teamMatchesBySeason.value[key]?.length ?? matchIdsBySeason.value[key]?.length ?? 0),
    0,
  ),
)
const selectedFailedReportCount = computed(() =>
  selectedSeasonConfigs.value.reduce(
    (total, { key }) => total + (failedReportCounts.value[key] ?? 0),
    0,
  ),
)
const relevantReportsLoading = computed(() =>
  selectedSeasonConfigs.value.some(({ key }) => reportLoadingBySeason.value[key]),
)
const relevantRoundsLoading = computed(() =>
  selectedSeasonConfigs.value.some(({ key }) => roundLoadingBySeason.value[key]),
)
const relevantSeasonLoading = computed(() =>
  selectedSeasonConfigs.value.some(({ key }) => seasonLoadingBySeason.value[key]),
)
const selectedRoundTotal = computed(() =>
  selectedSeasonConfigs.value.reduce((total, { key }) => total + (roundCountsBySeason.value[key] ?? 0), 0),
)
const selectedSuccessfulRoundCount = computed(() =>
  selectedSeasonConfigs.value.reduce(
    (total, { key }) => total + (successfulRoundCountsBySeason.value[key] ?? 0),
    0,
  ),
)
const selectedCompletedRoundCount = computed(() =>
  selectedSeasonConfigs.value.reduce(
    (total, { key }) => total + (completedRoundsBySeason.value[key] ?? 0),
    0,
  ),
)
const selectedFailedRoundCount = computed(() =>
  selectedSeasonConfigs.value.reduce(
    (total, { key }) => total + (failedRoundCountsBySeason.value[key] ?? 0),
    0,
  ),
)
const selectedRoundLoadHasError = computed(() =>
  selectedSeasonConfigs.value.some(({ key }) => Boolean(reportErrorsBySeason.value[key])),
)
const hasRetryableErrors = computed(
  () => selectedFailedRoundCount.value > 0 || selectedFailedReportCount.value > 0 || selectedRoundLoadHasError.value,
)
const roundProgressPercent = computed(() =>
  selectedRoundTotal.value === 0
    ? 0
    : Math.floor((selectedCompletedRoundCount.value / selectedRoundTotal.value) * 100),
)
const allExpectedDataLoaded = computed(
  () =>
    !relevantSeasonLoading.value &&
    selectedRoundTotal.value > 0 &&
    selectedSuccessfulRoundCount.value === selectedRoundTotal.value &&
    selectedFailedRoundCount.value === 0 &&
    selectedExpectedReportCount.value > 0 &&
    selectedLoadedReportCount.value === selectedExpectedReportCount.value &&
    selectedFailedReportCount.value === 0,
)

function retryFailedLoads(): void {
  void matchReportsStore.loadReports(selectedSeasonConfigs.value)
}
const reportProgressPercent = computed(() => {
  const total = selectedSeasonConfigs.value.reduce(
    (sum, { key }) => sum + (matchIdsBySeason.value[key]?.length ?? 0),
    0,
  )
  if (total === 0) return 0
  const completed = selectedSeasonConfigs.value.reduce(
    (sum, { key }) => sum + (completedReportCounts.value[key] ?? 0),
    0,
  )
  return Math.floor((completed / total) * 100)
})

const statistics = computed(() => calculatePlayerStatistics(visibleRosters.value, reportSets.value))
const doublesPairStatistics = computed(() =>
  calculateDoublesPairStatistics(visibleRosters.value, reportSets.value),
)
const pairFilterPlayers = computed(() => {
  const playersById = new Map<string, string>()
  for (const season of selectedSeasonConfigs.value) {
    for (const player of rosters.value[season.key] ?? []) {
      if (!playersById.has(player.playerId)) playersById.set(player.playerId, player.displayName)
    }
  }
  return [...playersById.entries()]
    .map(([playerId, displayName]) => ({ playerId, displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'))
})
const filteredPairs = computed(() =>
  filterDoublesPairsByPlayer(
    doublesPairStatistics.value.pairs,
    selectedPairPlayerId.value || null,
  ),
)
const sortedSingles = computed(() =>
  sortStatisticsRows(statistics.value.players, singlesSort.value, (player) => ({
    name: player.displayName,
    stableId: player.playerId,
    ...player.singles,
  })),
)
const sortedPlayerDoubles = computed(() =>
  sortStatisticsRows(statistics.value.players, doublesSort.value, (player) => ({
    name: player.displayName,
    stableId: player.playerId,
    ...player.doubles,
  })),
)
const sortedPairs = computed(() =>
  sortStatisticsRows(filteredPairs.value, pairSort.value, (pair) => ({
    name: pair.displayNames.join(' & '),
    stableId: pair.pairKey,
    ...pair,
  })),
)
const hasReports = computed(() => reportSets.value.length > 0)
const hasRosterForReports = computed(() =>
  reportSets.value.every(({ seasonKey }) => Boolean(visibleRosters.value[seasonKey])),
)
const relevantRostersLoading = computed(() =>
  selectedSeasonConfigs.value.some(({ key }) => rosterLoading.value[key]),
)
const relevantErrors = computed(() =>
  selectedSeasonConfigs.value.flatMap(({ key, label }) => [
    ...(rosterErrors.value[key] ? [`${label} Kader: ${rosterErrors.value[key]}`] : []),
    ...(reportErrorsBySeason.value[key] ? [`${label} Reports: ${reportErrorsBySeason.value[key]}`] : []),
    ...((failedReportCounts.value[key] ?? 0) > 0
      ? [`${label}: ${failedReportCounts.value[key]} Matchreports fehlgeschlagen.`]
      : []),
    ...(roundErrorsBySeason.value[key] ?? []).map((error) => `${label}: ${error}`),
  ]),
)
const reportState = computed(() => {
  if (relevantReportsLoading.value) return { label: 'Lädt', severity: 'info' as const }
  if (selectedFailedReportCount.value > 0) return { label: 'Fehler', severity: 'danger' as const }
  if (selectedReportTotal.value === 0) return { label: 'Noch nicht geladen', severity: 'secondary' as const }
  if (selectedLoadedReportCount.value === selectedReportTotal.value) {
    return { label: 'Abgeschlossen', severity: 'success' as const }
  }
  return { label: 'Unvollständig', severity: 'warn' as const }
})
const roundState = computed(() => {
  if (relevantRoundsLoading.value) return { label: 'Lädt', severity: 'info' as const }
  if (selectedFailedRoundCount.value > 0 || selectedRoundLoadHasError.value) {
    return { label: 'Fehler', severity: 'danger' as const }
  }
  if (selectedRoundTotal.value > 0 && selectedSuccessfulRoundCount.value === selectedRoundTotal.value) {
    return { label: 'Abgeschlossen', severity: 'success' as const }
  }
  if (selectedRoundTotal.value === 0 && relevantSeasonLoading.value) {
    return { label: 'Wird ermittelt', severity: 'secondary' as const }
  }
  return { label: 'Noch nicht geladen', severity: 'secondary' as const }
})

function percentage(summary: PlayerGameSummary): string {
  return summary.winPercentage === null
    ? '–'
    : `${summary.winPercentage.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
}

function legValue(value: number): string {
  return value.toLocaleString('de-DE')
}

function legDifference(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

function kindLabel(reason: string): string {
  if (reason === 'mehrdeutig') return 'mehrdeutiger Kadername'
  if (reason === 'doppelformat') return 'DP ohne genau zwei Namen je Seite'
  return 'nicht im ausgewählten Kader (ignoriert)'
}

function playerKey(player: PlayerStatisticsRow): string {
  return player.playerId
}

function isSortedBy(sortKey: StatisticsSortKey, column: StatisticsSortColumn): boolean {
  return getStatisticsSortColumn(sortKey) === column
}

function sortAria(sortKey: StatisticsSortKey, column: StatisticsSortColumn): 'ascending' | 'descending' | 'none' {
  if (!isSortedBy(sortKey, column)) return 'none'
  return sortKey.endsWith('-asc') ? 'ascending' : 'descending'
}

function sortIndicator(sortKey: StatisticsSortKey, column: StatisticsSortColumn): string {
  if (!isSortedBy(sortKey, column)) return ''
  return sortKey.endsWith('-asc') ? '▲' : '▼'
}
</script>

<template>
  <div class="view-heading statistics-heading">
    <div>
      <p class="eyebrow">HIRSCH-RABAUKEN · {{ selectedSeasonLabel }}</p>
      <h2>Spielerstatistik</h2>
    </div>
    <Tag
      :value="`${selectedLoadedReportCount}/${selectedExpectedReportCount} Matchreports im Cache`"
      :severity="hasReports ? 'success' : 'secondary'"
    />
  </div>

  <Message
    v-if="relevantErrors.length"
    severity="error"
    :closable="false"
    class="cache-message"
  >
    <ul class="message-list">
      <li v-for="error in relevantErrors" :key="error">{{ error }}</li>
    </ul>
  </Message>

  <button
    v-if="hasRetryableErrors"
    class="retry-button"
    type="button"
    :disabled="relevantSeasonLoading"
    @click="retryFailedLoads"
  >
    Erneut versuchen
  </button>

  <template v-if="!allExpectedDataLoaded">
  <section class="report-load-status round-load-status" aria-live="polite" aria-label="Ladezustand der Saisonrunden">
    <div class="report-status-heading">
      <div>
        <strong>Saisonrunden</strong>
        <span>{{ selectedSuccessfulRoundCount }} von {{ selectedRoundTotal || '–' }} erfolgreich</span>
        <span v-if="selectedFailedRoundCount > 0" class="load-error-count">
          {{ selectedFailedRoundCount }} Runde(n) fehlgeschlagen
        </span>
      </div>
      <Tag :value="roundState.label" :severity="roundState.severity" />
    </div>
    <div
      v-if="selectedRoundTotal > 0"
      class="report-progress-track"
      role="progressbar"
      aria-label="Fortschritt beim Laden der Saisonrunden"
      :aria-valuenow="roundProgressPercent"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="report-progress-value" :style="{ width: `${roundProgressPercent}%` }" />
    </div>
  </section>

  <section class="report-load-status" aria-live="polite" aria-label="Ladezustand der Matchreports">
    <div class="report-status-heading">
      <div>
        <strong>Matchreports</strong>
        <span>
          {{ selectedLoadedReportCount }} von {{ selectedReportTotal || '–' }} geladen
          <template v-if="selectedReportTotal === 0 && relevantReportsLoading">
            · Begegnungen werden ermittelt
          </template>
        </span>
      </div>
      <Tag :value="reportState.label" :severity="reportState.severity" />
    </div>
    <div
      v-if="selectedReportTotal > 0"
      class="report-progress-track"
      role="progressbar"
      aria-label="Fortschritt beim Laden der Matchreports"
      :aria-valuenow="reportProgressPercent"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="report-progress-value" :style="{ width: `${reportProgressPercent}%` }" />
    </div>
    <p class="cache-note">
      Der Report-Cache gilt nur bis zum Neuladen oder Schließen der Anwendung.
      <template v-if="selectedFailedReportCount > 0">
        {{ selectedFailedReportCount }} Report(s) konnten nicht geladen werden.
      </template>
    </p>
  </section>
  </template>

  <Message
    v-if="!hasReports && !relevantSeasonLoading && relevantErrors.length === 0"
    severity="info"
    :closable="false"
    class="cache-message"
  >
    Für die ausgewählte Saison sind noch keine Matchreports verfügbar.
  </Message>

  <div v-if="relevantRostersLoading" class="loading-note" role="status">
    <i class="pi pi-spin pi-spinner" aria-hidden="true" />
    <span>Offizielle Teilnehmerlisten werden geladen.</span>
  </div>

  <section class="statistics-section player-statistics" aria-label="Einzel und Doppel">
    <div class="section-heading">
      <div class="legs-control">
        <label for="show-legs">Legs anzeigen</label>
        <ToggleSwitch id="show-legs" v-model="showLegs" aria-label="Leg-Informationen anzeigen" />
      </div>
    </div>

    <template v-if="hasReports && hasRosterForReports && !relevantRostersLoading">
      <div class="stats-grid">
        <section class="stats-kind" aria-labelledby="singles-heading">
          <div class="kind-heading">
            <h4 id="singles-heading">Einzel</h4>
            <Tag value="Einzel" severity="info" />
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col" :aria-sort="sortAria(singlesSort, 'name')">
                    <button class="sort-header" :class="{ 'is-sorted': isSortedBy(singlesSort, 'name') }" type="button" @click="singlesSort = toggleStatisticsSort(singlesSort, 'name')">
                      Spieler <span aria-hidden="true">{{ sortIndicator(singlesSort, 'name') }}</span>
                    </button>
                  </th>
                  <th scope="col" :aria-sort="sortAria(singlesSort, 'played')">
                    <button class="sort-header" :class="{ 'is-sorted': isSortedBy(singlesSort, 'played') }" type="button" @click="singlesSort = toggleStatisticsSort(singlesSort, 'played')">
                      Gespielt <span aria-hidden="true">{{ sortIndicator(singlesSort, 'played') }}</span>
                    </button>
                  </th>
                  <th scope="col" :aria-sort="sortAria(singlesSort, 'won')">
                    <button class="sort-header" :class="{ 'is-sorted': isSortedBy(singlesSort, 'won') }" type="button" @click="singlesSort = toggleStatisticsSort(singlesSort, 'won')">
                      Gewonnen <span aria-hidden="true">{{ sortIndicator(singlesSort, 'won') }}</span>
                    </button>
                  </th>
                  <th scope="col" :aria-sort="sortAria(singlesSort, 'winPercentage')">
                    <button class="sort-header" :class="{ 'is-sorted': isSortedBy(singlesSort, 'winPercentage') }" type="button" @click="singlesSort = toggleStatisticsSort(singlesSort, 'winPercentage')">
                      Gewinnquote <span aria-hidden="true">{{ sortIndicator(singlesSort, 'winPercentage') }}</span>
                    </button>
                  </th>
                  <template v-if="showLegs">
                    <th scope="col">Legs +</th>
                    <th scope="col">Legs −</th>
                    <th scope="col">Differenz</th>
                  </template>
                </tr>
              </thead>
              <tbody>
                <tr v-for="player in sortedSingles" :key="playerKey(player)">
                  <th scope="row">{{ player.displayName }}</th>
                  <td>{{ player.singles.played }}</td>
                  <td>{{ player.singles.won }}</td>
                  <td>{{ percentage(player.singles) }}</td>
                  <template v-if="showLegs">
                    <td>{{ legValue(player.singles.legsWon) }}</td>
                    <td>{{ legValue(player.singles.legsLost) }}</td>
                    <td>{{ legDifference(player.singles.legDifference) }}</td>
                  </template>
                </tr>
                <tr v-if="statistics.players.length === 0">
                  <td :colspan="showLegs ? 7 : 4" class="empty-cell">Kein Kader geladen.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="stats-kind" aria-labelledby="doubles-heading">
          <div class="kind-heading">
            <h4 id="doubles-heading">Doppel</h4>
            <Tag value="Doppel" severity="success" />
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col" :aria-sort="sortAria(doublesSort, 'name')">
                    <button class="sort-header" :class="{ 'is-sorted': isSortedBy(doublesSort, 'name') }" type="button" @click="doublesSort = toggleStatisticsSort(doublesSort, 'name')">
                      Spieler <span aria-hidden="true">{{ sortIndicator(doublesSort, 'name') }}</span>
                    </button>
                  </th>
                  <th scope="col" :aria-sort="sortAria(doublesSort, 'played')">
                    <button class="sort-header" :class="{ 'is-sorted': isSortedBy(doublesSort, 'played') }" type="button" @click="doublesSort = toggleStatisticsSort(doublesSort, 'played')">
                      Gespielt <span aria-hidden="true">{{ sortIndicator(doublesSort, 'played') }}</span>
                    </button>
                  </th>
                  <th scope="col" :aria-sort="sortAria(doublesSort, 'won')">
                    <button class="sort-header" :class="{ 'is-sorted': isSortedBy(doublesSort, 'won') }" type="button" @click="doublesSort = toggleStatisticsSort(doublesSort, 'won')">
                      Gewonnen <span aria-hidden="true">{{ sortIndicator(doublesSort, 'won') }}</span>
                    </button>
                  </th>
                  <th scope="col" :aria-sort="sortAria(doublesSort, 'winPercentage')">
                    <button class="sort-header" :class="{ 'is-sorted': isSortedBy(doublesSort, 'winPercentage') }" type="button" @click="doublesSort = toggleStatisticsSort(doublesSort, 'winPercentage')">
                      Gewinnquote <span aria-hidden="true">{{ sortIndicator(doublesSort, 'winPercentage') }}</span>
                    </button>
                  </th>
                  <template v-if="showLegs">
                    <th scope="col">Legs +</th>
                    <th scope="col">Legs −</th>
                    <th scope="col">Differenz</th>
                  </template>
                </tr>
              </thead>
              <tbody>
                <tr v-for="player in sortedPlayerDoubles" :key="playerKey(player)">
                  <th scope="row">{{ player.displayName }}</th>
                  <td>{{ player.doubles.played }}</td>
                  <td>{{ player.doubles.won }}</td>
                  <td>{{ percentage(player.doubles) }}</td>
                  <template v-if="showLegs">
                    <td>{{ legValue(player.doubles.legsWon) }}</td>
                    <td>{{ legValue(player.doubles.legsLost) }}</td>
                    <td>{{ legDifference(player.doubles.legDifference) }}</td>
                  </template>
                </tr>
                <tr v-if="statistics.players.length === 0">
                  <td :colspan="showLegs ? 7 : 4" class="empty-cell">Kein Kader geladen.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <details v-if="statistics.unmatchedNames.length" class="unmatched-details">
        <summary>
          Nicht zugeordnete Namen und Datenfälle ({{ statistics.unmatchedNames.length }})
        </summary>
        <ul>
          <li
            v-for="item in statistics.unmatchedNames"
            :key="`${item.seasonKey}-${item.displayName}-${item.reason}`"
          >
            {{ item.displayName }} · {{ kindLabel(item.reason) }} · {{ item.count }}×
          </li>
        </ul>
      </details>
    </template>
  </section>

  <section class="statistics-section pair-statistics" aria-labelledby="pair-heading">
    <div class="section-heading">
      <div>
        <p class="eyebrow">PAARUNGSAUSWERTUNG</p>
        <h3 id="pair-heading">Doppel-Paarungen</h3>
      </div>
      <Tag :value="`${sortedPairs.length} Paarungen`" severity="success" />
    </div>

    <template v-if="hasReports && hasRosterForReports && !relevantRostersLoading">
      <div class="pair-table-controls">
        <div class="table-controls">
          <label for="pair-player-filter">Spieler</label>
          <select
            id="pair-player-filter"
            v-model="selectedPairPlayerId"
            aria-label="Doppel-Paarungen nach Spieler filtern"
          >
            <option value="">Alle Spieler</option>
            <option
              v-for="player in pairFilterPlayers"
              :key="player.playerId"
              :value="player.playerId"
            >
              {{ player.displayName }}
            </option>
          </select>
        </div>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col" :aria-sort="sortAria(pairSort, 'name')">
                <button class="sort-header" :class="{ 'is-sorted': isSortedBy(pairSort, 'name') }" type="button" @click="pairSort = toggleStatisticsSort(pairSort, 'name')">
                  Paarung <span aria-hidden="true">{{ sortIndicator(pairSort, 'name') }}</span>
                </button>
              </th>
              <th scope="col" :aria-sort="sortAria(pairSort, 'played')">
                <button class="sort-header" :class="{ 'is-sorted': isSortedBy(pairSort, 'played') }" type="button" @click="pairSort = toggleStatisticsSort(pairSort, 'played')">
                  Gespielt <span aria-hidden="true">{{ sortIndicator(pairSort, 'played') }}</span>
                </button>
              </th>
              <th scope="col" :aria-sort="sortAria(pairSort, 'won')">
                <button class="sort-header" :class="{ 'is-sorted': isSortedBy(pairSort, 'won') }" type="button" @click="pairSort = toggleStatisticsSort(pairSort, 'won')">
                  Gewonnen <span aria-hidden="true">{{ sortIndicator(pairSort, 'won') }}</span>
                </button>
              </th>
              <th scope="col" :aria-sort="sortAria(pairSort, 'winPercentage')">
                <button class="sort-header" :class="{ 'is-sorted': isSortedBy(pairSort, 'winPercentage') }" type="button" @click="pairSort = toggleStatisticsSort(pairSort, 'winPercentage')">
                  Gewinnquote <span aria-hidden="true">{{ sortIndicator(pairSort, 'winPercentage') }}</span>
                </button>
              </th>
              <template v-if="showLegs">
                <th scope="col">Legs +</th>
                <th scope="col">Legs −</th>
                <th scope="col">Differenz</th>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pair in sortedPairs" :key="pair.pairKey">
              <th scope="row">{{ pair.displayNames.join(' & ') }}</th>
              <td>{{ pair.played }}</td>
              <td>{{ pair.won }}</td>
              <td>{{ percentage(pair) }}</td>
              <template v-if="showLegs">
                <td>{{ legValue(pair.legsWon) }}</td>
                <td>{{ legValue(pair.legsLost) }}</td>
                <td>{{ legDifference(pair.legDifference) }}</td>
              </template>
            </tr>
            <tr v-if="sortedPairs.length === 0">
              <td :colspan="showLegs ? 7 : 4" class="empty-cell">
                Keine abgeschlossenen Hirsch-Rabauken-Doppel gefunden.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <details v-if="doublesPairStatistics.unmatchedNames.length" class="unmatched-details">
        <summary>
          Nicht zugeordnete Doppel-Namen ({{ doublesPairStatistics.unmatchedNames.length }})
        </summary>
        <ul>
          <li
            v-for="item in doublesPairStatistics.unmatchedNames"
            :key="`${item.seasonKey}-${item.displayName}-${item.reason}`"
          >
            {{ item.seasonKey }} · {{ item.displayName }} · {{ kindLabel(item.reason) }} ·
            {{ item.count }}×
          </li>
        </ul>
      </details>
    </template>
    <p v-else class="section-note">
      Die Paarungsstatistik wird angezeigt, sobald passende Matchreports und der zugehörige
      Saisonkader geladen sind.
    </p>
  </section>

</template>

<style scoped>
.statistics-heading {
  align-items: flex-start;
}
.statistics-heading h2 {
  margin: 0;
  color: #eaf1f5;
  font-size: 22px;
  font-weight: 600;
}
.cache-message {
  margin-bottom: 22px;
}
.retry-button {
  margin: 0 0 18px;
  padding: 8px 13px;
  border: 1px solid #1a5558;
  border-radius: 8px;
  background: #123033;
  color: #54e0d2;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}
.retry-button:hover:not(:disabled) {
  background: #174044;
}
.retry-button:disabled {
  cursor: wait;
  opacity: .55;
}
.cache-message p {
  margin: 6px 0 0;
}
.report-load-status {
  margin-bottom: 22px;
  padding: 14px 16px;
  border: 1px solid #273640;
  border-radius: 10px;
  background: #111b25;
  color: #c8d5dc;
}
.report-status-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.report-status-heading > div {
  display: grid;
  gap: 4px;
}
.report-status-heading strong {
  color: #eaf1f5;
  font-size: 13px;
}
.report-status-heading span,
.cache-note {
  color: #95a3af;
  font-size: 12px;
}
.report-status-heading .load-error-count {
  color: #f29c9c;
}
.report-progress-track {
  height: 7px;
  margin-top: 12px;
  overflow: hidden;
  border-radius: 8px;
  background: #1b2732;
}
.report-progress-value {
  height: 100%;
  border-radius: inherit;
  background: #39c9bb;
  transition: width 180ms ease;
}
.cache-note {
  margin: 10px 0 0;
  line-height: 1.5;
}
.cache-message a {
  color: #54e0d2;
}
.message-list {
  margin: 0;
  padding-left: 18px;
}
.loading-note {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 20px;
  color: #95a3af;
  font-size: 13px;
}
.statistics-section {
  padding: 22px;
  border: 1px solid #273640;
  border-radius: 14px;
  background: #0e161f;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
}
.section-heading .eyebrow {
  margin-bottom: 6px;
}
.player-statistics > .section-heading {
  justify-content: flex-end;
}
.section-heading h3 {
  margin: 0;
  color: #eaf1f5;
  font-size: 17px;
  font-weight: 600;
}
.legs-control {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #c8d5dc;
  font-size: 13px;
}
.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}
.stats-kind {
  min-width: 0;
  padding: 16px;
  border: 1px solid #273640;
  border-radius: 11px;
  background: #111b25;
}
.kind-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.kind-heading h4 {
  margin: 0;
  color: #eaf1f5;
  font-size: 15px;
}
.table-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 9px;
  color: #95a3af;
  font-size: 12px;
}
.table-controls select {
  max-width: 100%;
  padding: 6px 28px 6px 9px;
  border: 1px solid #2a3945;
  border-radius: 7px;
  background: #111b25;
  color: #c8d5dc;
  font: inherit;
}
.pair-table-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 18px;
}
.table-scroll {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  color: #c8d5dc;
  font-size: 12px;
  text-align: left;
}
th,
td {
  padding: 10px 9px;
  border-bottom: 1px solid #273640;
  white-space: nowrap;
}
thead th {
  color: #82919e;
  font-size: 11px;
  font-weight: 600;
}
.sort-header {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.sort-header:hover,
.sort-header:focus-visible {
  color: #c8d5dc;
}
.sort-header.is-sorted {
  color: #eaf1f5;
  font-weight: 700;
}
.sort-header span {
  margin-left: 3px;
  color: #54e0d2;
  font-size: 9px;
}
tbody th {
  color: #eaf1f5;
  font-weight: 500;
}
tbody tr:last-child th,
tbody tr:last-child td {
  border-bottom: 0;
}
.empty-cell {
  color: #82919e;
  text-align: center;
}
.unmatched-details {
  margin-top: 17px;
  color: #95a3af;
  font-size: 12px;
}
.unmatched-details summary {
  cursor: pointer;
  color: #c8d5dc;
}
.unmatched-details ul {
  display: grid;
  gap: 6px;
  padding-left: 21px;
}
.pair-statistics {
  margin-top: 18px;
}
.section-note {
  margin: 18px 0 0;
  color: #95a3af;
  font-size: 13px;
  line-height: 1.65;
}
@media (max-width: 760px) {
  .view-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .section-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
