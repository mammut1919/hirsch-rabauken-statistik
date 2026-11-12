<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { getAvailableSeasons } from '../services/seasonConfig'
import type { SeasonTeamMatch } from '../services/teamSchedule'
import { usePlayerRosterStore } from '../stores/playerRoster'

const rosterStore = usePlayerRosterStore()
const { teamMatchesBySeason, loading, errors } = storeToRefs(rosterStore)
const seasons = getAvailableSeasons().filter(({ key }) => key === '2026-2' || key === '2026-1')
const orderedSeasons = ['2026-2', '2026-1']
  .map((key) => seasons.find((season) => season.key === key))
  .filter((season) => season !== undefined)

void rosterStore.loadRosters(orderedSeasons)

const sortedMatchesBySeason = computed(() => {
  return Object.fromEntries(
    orderedSeasons.map(({ key }) => [
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
</script>

<template>
  <div class="view-heading">
    <div>
      <p class="eyebrow">HIRSCH-RABAUKEN</p>
      <h2>Mannschaftsspielplan</h2>
    </div>
  </div>

  <section
    v-for="season in orderedSeasons"
    :key="season.key"
    class="schedule-section"
    :aria-labelledby="`schedule-${season.key}`"
  >
    <div class="schedule-heading">
      <h3 :id="`schedule-${season.key}`">{{ season.year }} – {{ season.half }}. Halbjahr</h3>
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
          <tr v-for="match in sortedMatchesBySeason[season.key]" :key="match.matchId">
            <td>{{ formatDate(match.datePlanned) }}</td>
            <td>{{ match.participantHome.displayName ?? '–' }}</td>
            <td>{{ match.participantGuest.displayName ?? '–' }}</td>
            <td>
              <span :class="match.statusCd === 'FINISH' ? 'match-result' : 'match-open'">
                {{ formatResult(match) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.schedule-section {
  margin-top: 18px;
  padding: 22px;
  border: 1px solid #273640;
  border-radius: 14px;
  background: #0e161f;
}

.schedule-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.schedule-heading h3 {
  margin: 0;
  color: #eaf1f5;
  font-size: 17px;
  font-weight: 600;
}

.schedule-heading span,
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

.match-result {
  color: #eaf1f5;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.match-open {
  color: #50cfc3;
}

@media (max-width: 760px) {
  .schedule-section {
    padding: 16px;
  }

  .schedule-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
}
</style>
