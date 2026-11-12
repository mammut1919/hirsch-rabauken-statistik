<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getAvailableSeasons } from '../services/seasonConfig'
import type { SeasonTeamMatch } from '../services/teamSchedule'
import { usePlayerRosterStore } from '../stores/playerRoster'
import { useSeasonStore } from '../stores/season'
import { useTeamStandingsStore } from '../stores/teamStandings'

const rosterStore = usePlayerRosterStore()
const standingsStore = useTeamStandingsStore()
const seasonStore = useSeasonStore()
const { teamMatchesBySeason, loading, errors } = storeToRefs(rosterStore)
const { standingsBySeason, loadingBySeason: standingsLoading, errorsBySeason: standingsErrors } =
  storeToRefs(standingsStore)
const { selectedSeason } = storeToRefs(seasonStore)
const seasonOrder = ['2026-2', '2026-1']
const configuredSeasons = getAvailableSeasons()
const availableSeasons = seasonOrder
  .map((key) => configuredSeasons.find((season) => season.key === key))
  .filter((season) => season !== undefined)
const visibleSeasons = computed(() =>
  selectedSeason.value === 'all'
    ? availableSeasons
    : availableSeasons.filter(({ key }) => key === selectedSeason.value),
)

watch(
  visibleSeasons,
  (seasons) => void rosterStore.loadRosters(seasons),
  { immediate: true },
)
watch(
  visibleSeasons,
  (seasons) => void standingsStore.loadStandingsForSeasons(seasons),
  { immediate: true },
)

const sortedMatchesBySeason = computed(() => {
  return Object.fromEntries(
    visibleSeasons.value.map(({ key }) => [
      key,
      [...(teamMatchesBySeason.value[key] ?? [])].sort(compareByDateDescending),
    ]),
  ) as Record<string, SeasonTeamMatch[]>
})

function compareByDateDescending(left: SeasonTeamMatch, right: SeasonTeamMatch): number {
  const leftDate = parseDate(left.datePlanned)
  const rightDate = parseDate(right.datePlanned)
  if (leftDate === null && rightDate === null) return left.matchId - right.matchId
  if (leftDate === null) return 1
  if (rightDate === null) return -1
  return rightDate - leftDate || left.matchId - right.matchId
}

function parseDate(value: string | null): number | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

function formatDate(value: string | null): string {
  const timestamp = parseDate(value)
  if (timestamp === null) return '–'
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(timestamp)
}

function formatResult(match: SeasonTeamMatch): string {
  if (match.statusCd !== 'FINISH') return 'Offen'
  if (match.setsHome === null || match.setsAway === null) return '–'
  return `${match.setsHome} : ${match.setsAway}`
}

function resultForTeam(
  match: SeasonTeamMatch,
): { home: number; away: number; teamIsHome: boolean } | null {
  if (
    match.statusCd !== 'FINISH' ||
    match.setsHome === null ||
    match.setsAway === null
  ) {
    return null
  }
  if (isTeam(match.participantHome.displayName)) {
    return { home: match.setsHome, away: match.setsAway, teamIsHome: true }
  }
  if (isTeam(match.participantGuest.displayName)) {
    return { home: match.setsHome, away: match.setsAway, teamIsHome: false }
  }
  return null
}

function isTeam(name: string | null): boolean {
  return name?.trim().toLocaleLowerCase('de-DE') === 'hirsch-rabauken'
}

function tableValue(value: number | null | undefined): string {
  return value == null ? '–' : value.toLocaleString('de-DE')
}

function isTeamStanding(
  participantId: number | string | null | undefined,
  teamParticipantId: number | null,
): boolean {
  return participantId != null && teamParticipantId !== null && String(participantId) === String(teamParticipantId)
}
</script>

<template>
  <div class="view-heading">
    <div>
      <p class="eyebrow">HIRSCH-RABAUKEN</p>
      <h2>Mannschaftsspielplan</h2>
    </div>
  </div>

  <section
    v-for="season in visibleSeasons"
    :key="season.key"
    class="season-dashboard"
    :aria-labelledby="`season-${season.key}`"
  >
    <header class="season-dashboard-heading">
      <h3 :id="`season-${season.key}`">{{ season.year }} – {{ season.half }}. Halbjahr</h3>
    </header>

    <div class="season-dashboard-grid">
      <section class="dashboard-panel schedule-panel" :aria-labelledby="`schedule-${season.key}`">
        <div class="panel-heading">
          <h4 :id="`schedule-${season.key}`">Mannschaftsspielplan</h4>
          <span>{{ (teamMatchesBySeason[season.key] ?? []).length }} Begegnungen</span>
        </div>

        <p v-if="loading[season.key]" class="schedule-message" role="status">
          Spielplan wird geladen …
        </p>
        <p v-else-if="errors[season.key]" class="schedule-message schedule-error" role="alert">
          Spielplan konnte nicht geladen werden: {{ errors[season.key] }}
        </p>
        <p
          v-else-if="!teamMatchesBySeason[season.key]?.length"
          class="schedule-message"
          role="status"
        >
          Für dieses Halbjahr sind keine Begegnungen verfügbar.
        </p>

        <div v-else class="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Datum</th>
                <th scope="col">Heimmannschaft</th>
                <th scope="col">Gastmannschaft</th>
                <th scope="col">Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="match in sortedMatchesBySeason[season.key]"
                :key="match.matchId"
              >
                <td>{{ formatDate(match.datePlanned) }}</td>
                <td :class="{ 'team-name': isTeam(match.participantHome.displayName) }">
                  {{ match.participantHome.displayName ?? '–' }}
                </td>
                <td :class="{ 'team-name': isTeam(match.participantGuest.displayName) }">
                  {{ match.participantGuest.displayName ?? '–' }}
                </td>
                <td>
                  <span v-if="match.statusCd !== 'FINISH'" class="match-open">Offen</span>
                  <span v-else-if="resultForTeam(match)" class="match-result">
                    <span :class="{ 'team-score': resultForTeam(match)?.teamIsHome }">
                      {{ resultForTeam(match)?.home }}
                    </span>
                    <span> : </span>
                    <span :class="{ 'team-score': !resultForTeam(match)?.teamIsHome }">
                      {{ resultForTeam(match)?.away }}
                    </span>
                  </span>
                  <span v-else class="match-result">
                    {{ formatResult(match) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="dashboard-panel ranking-panel" :aria-labelledby="`ranking-${season.key}`">
        <div class="panel-heading">
          <h4 :id="`ranking-${season.key}`">Mannschaftsrangliste</h4>
        </div>

        <p v-if="standingsLoading[season.key]" class="schedule-message" role="status">
          Rangliste wird geladen …
        </p>
        <p v-else-if="standingsErrors[season.key]" class="schedule-message schedule-error" role="alert">
          Rangliste konnte nicht geladen werden: {{ standingsErrors[season.key] }}
        </p>
        <p
          v-else-if="!standingsBySeason[season.key]?.length"
          class="schedule-message"
          role="status"
        >
          Für dieses Halbjahr sind keine Ranglistendaten verfügbar.
        </p>

        <div v-else class="ranking-table-scroll">
          <table class="ranking-table">
            <thead>
              <tr>
                <th scope="col">Platz</th>
                <th scope="col">Mannschaft</th>
                <th scope="col">Spiele</th>
                <th scope="col">Siege</th>
                <th scope="col">Niederlagen</th>
                <th scope="col">Punkte</th>
                <th scope="col">Sets</th>
                <th scope="col">Set-Diff.</th>
                <th scope="col">Legs</th>
                <th scope="col">Leg-Diff.</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in standingsBySeason[season.key]"
                :key="`${row.placement}-${row.participantName}`"
                :class="{ 'team-standing-row': isTeamStanding(row.participantId, season.participantId) }"
              >
                <td>{{ tableValue(row.placement) }}</td>
                <td>{{ row.participantName ?? '–' }}</td>
                <td>{{ tableValue(row.matchCount) }}</td>
                <td>{{ tableValue(row.win) }}</td>
                <td>{{ tableValue(row.lost) }}</td>
                <td>{{ tableValue(row.points1) }}</td>
                <td>{{ tableValue(row.sets1) }} : {{ tableValue(row.sets2) }}</td>
                <td>{{ tableValue(row.setDifference) }}</td>
                <td>{{ tableValue(row.legs1) }} : {{ tableValue(row.legs2) }}</td>
                <td>{{ tableValue(row.legDifference) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.season-dashboard {
  margin-top: 18px;
  padding: 22px;
  border: 1px solid #273640;
  border-radius: 14px;
  background: #0e161f;
}

.season-dashboard-heading {
  margin-bottom: 16px;
}

.season-dashboard-heading h3 {
  margin: 0;
  color: #eaf1f5;
  font-size: 18px;
  font-weight: 600;
}

.season-dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: start;
  gap: 16px;
}

.dashboard-panel {
  min-width: 0;
  padding: 16px;
  border: 1px solid #273640;
  border-radius: 11px;
  background: #111b25;
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.panel-heading h4 {
  margin: 0;
  color: #eaf1f5;
  font-size: 15px;
  font-weight: 600;
}

.panel-heading > span {
  color: #82919e;
  font-size: 12px;
}

.ranking-table-scroll {
  overflow-x: auto;
}

.ranking-table {
  min-width: 760px;
  font-size: 11px;
}

.team-standing-row {
  background: #123033;
}

.team-standing-row td {
  border-bottom-color: #245052;
}

.schedule-panel .panel-heading span,
.schedule-message {
  color: #95a3af;
  font-size: 12px;
}

.schedule-message {
  margin: 16px 0 2px;
  line-height: 1.6;
}

.schedule-error {
  color: #f29c9c;
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  color: #c8d5dc;
  font-size: 13px;
  text-align: left;
}

th,
td {
  padding: 11px 10px;
  border-bottom: 1px solid #273640;
  white-space: nowrap;
}

thead th {
  color: #82919e;
  font-size: 11px;
  font-weight: 600;
}

tbody tr:last-child td {
  border-bottom: 0;
}

.team-name {
  color: #54e0d2;
}

.match-result {
  color: #c8d5dc;
  font-variant-numeric: tabular-nums;
}

.team-score {
  color: #54e0d2;
}

.match-open {
  color: #c8d5dc;
}

@media (max-width: 760px) {
  .season-dashboard {
    padding: 16px;
  }

  .season-dashboard-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .panel-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
}

@media (max-width: 1100px) {
  .season-dashboard-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
