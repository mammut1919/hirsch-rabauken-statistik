<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useMatchReportsStore } from '../stores/matchReports'

const store = useMatchReportsStore()
const route = useRoute()
const diagnosticMode = route.query.diagnose === '1'
const failedMatchIds = [4652718, 4652719, 4652720]
const knownSuccessfulMatchId = 4652712
const {
  matchIds,
  failedReports,
  attemptLog,
  roundErrors,
  loading,
  loadError,
  roundCount,
  completedRounds,
  loadedReportCount,
  failedReportCount,
  completedReportCount,
  progressPercent,
  cachedReportCount,
  requestAttemptCount,
} = storeToRefs(store)

onMounted(() => {
  if (diagnosticMode) {
    void store.runReportDiagnostics(failedMatchIds, knownSuccessfulMatchId)
  } else {
    void store.loadReports()
  }
})
</script>

<template>
  <div class="view-heading">
    <div>
      <p class="eyebrow">{{ diagnosticMode ? 'FEHLERDIAGNOSE · H1 2026' : 'DATENLADE-TEST · H1 2026' }}</p>
      <h2>{{ diagnosticMode ? 'Matchreport-Abrufe vergleichen' : 'Öffentliche Matchreports' }}</h2>
    </div>
    <div class="actions">
      <button
        v-if="diagnosticMode"
        type="button"
        :disabled="loading"
        @click="store.runReportDiagnostics(failedMatchIds, knownSuccessfulMatchId)"
      >
        Drei Fehler erneut testen
      </button>
      <template v-else>
      <button type="button" :disabled="loading" @click="store.loadReports()">
        Fehlende Reports laden
      </button>
      <button type="button" :disabled="loading" @click="store.clearCache()">Cache leeren</button>
      <button type="button" :disabled="loading" @click="store.clearAndReload()">
        {{ loading ? 'Lädt …' : 'Cache leeren & neu laden' }}
      </button>
      </template>
    </div>
  </div>

  <section class="test-card" aria-live="polite">
    <p class="request-info">Event {{ store.eventId }} · Phase {{ store.phaseId }}</p>

    <p v-if="diagnosticMode" class="request-info">
      Getestet werden {{ failedMatchIds.join(', ') }} sowie der bekannte Erfolgsfall
      {{ knownSuccessfulMatchId }}. Die Anfragen laufen einzeln mit 500 ms Pause.
    </p>

    <p v-if="loading" class="result-message">
      {{ diagnosticMode ? 'Diagnoseanfragen laufen …' : 'Rundendaten und Matchreports werden geladen …' }}
    </p>
    <p v-else-if="loadError" class="result-message error-message">{{ loadError }}</p>
    <p v-else-if="failedReportCount > 0 || roundErrors.length > 0" class="result-message error-message">
      Ladevorgang beendet; einige Daten konnten nicht geladen werden.
    </p>
    <p v-else-if="matchIds.length > 0" class="result-message success-message">
      Alle gefundenen Matchreports sind im Arbeitsspeicher verfügbar.
    </p>
    <p v-else class="result-message">Noch keine Reports geladen.</p>

    <div class="progress-header">
      <span>Reports verarbeitet: {{ completedReportCount }} / {{ matchIds.length }}</span>
      <span>{{ progressPercent }}%</span>
    </div>
    <div
      class="progress-track"
      role="progressbar"
      :aria-valuenow="progressPercent"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="Ladefortschritt der Matchreports"
    >
      <div class="progress-value" :style="{ width: `${progressPercent}%` }" />
    </div>

    <dl class="response-details">
      <div>
        <dt>Runden geladen</dt>
        <dd>{{ completedRounds }} / {{ roundCount }}</dd>
      </div>
      <div>
        <dt>Gefundene Match-IDs</dt>
        <dd>{{ matchIds.length }}</dd>
      </div>
      <div>
        <dt>Erfolgreiche Reports im Cache</dt>
        <dd>{{ loadedReportCount }}</dd>
      </div>
      <div>
        <dt>Fehlgeschlagene Reports</dt>
        <dd>{{ failedReportCount }}</dd>
      </div>
      <div>
        <dt>Reports im Arbeitsspeicher</dt>
        <dd>{{ cachedReportCount }}</dd>
      </div>
      <div>
        <dt>HTTP-Versuche</dt>
        <dd>{{ requestAttemptCount }}</dd>
      </div>
    </dl>

    <div v-if="roundErrors.length > 0 || Object.keys(failedReports).length > 0" class="errors">
      <h3>Fehler</h3>
      <ul>
        <li v-for="error in roundErrors" :key="error">{{ error }}</li>
        <li v-for="record in Object.values(failedReports)" :key="record.matchId">
          Match {{ record.matchId }} · {{ record.attemptedAt }} · Versuch {{ record.attemptNumber }} ·
          {{ record.category }}<template v-if="record.httpStatus"> · HTTP {{ record.httpStatus }}</template>
          · {{ record.errorName }}: {{ record.errorMessage }}
        </li>
      </ul>
    </div>

    <div v-if="diagnosticMode && attemptLog.length > 0" class="attempt-log">
      <h3>Versuchsprotokoll</h3>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Match-ID</th>
              <th>Zeitpunkt</th>
              <th>Versuch</th>
              <th>Ergebnis</th>
              <th>Kategorie / Status</th>
              <th>Antwortmetadaten / Fehlername</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in attemptLog" :key="`${record.matchId}-${record.attemptNumber}`">
              <td>{{ record.matchId }}</td>
              <td>{{ record.attemptedAt }}</td>
              <td>{{ record.attemptNumber }}</td>
              <td>{{ record.outcome }}</td>
              <td>
                {{ record.category ?? '—' }}
                {{ record.httpStatus ? ` / HTTP ${record.httpStatus}` : '' }}
              </td>
              <td>
                <template v-if="record.outcome === 'Erfolg'">
                  {{ record.contentType }} · {{ record.byteLength }} Bytes
                </template>
                <template v-else>
                  {{ record.errorName }}: {{ record.errorMessage }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p class="privacy-note">
      Es werden keine Spielerdetails angezeigt. Die Rohantworten liegen ausschließlich im
      Pinia-Arbeitsspeicher dieser Anwendung und werden nicht dauerhaft gespeichert.
    </p>
  </section>
</template>

<style scoped>
.test-card {
  padding: 24px;
  border: 1px solid #273640;
  border-radius: 14px;
  background: #0e161f;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

button {
  padding: 9px 14px;
  border: 1px solid #1a5558;
  border-radius: 8px;
  background: #123033;
  color: #54e0d2;
  cursor: pointer;
}

button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.request-info,
.privacy-note {
  color: #82919e;
  font-size: 12px;
  line-height: 1.6;
}

.result-message {
  margin: 20px 0;
  color: #dce7eb;
}

.error-message,
.errors {
  color: #ff8d8d;
}

.success-message {
  color: #77df9b;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  color: #c8d5dc;
  font-size: 13px;
}

.progress-track {
  height: 9px;
  margin-top: 9px;
  overflow: hidden;
  border-radius: 8px;
  background: #1b2732;
}

.progress-value {
  height: 100%;
  border-radius: inherit;
  background: #39c9bb;
  transition: width 180ms ease;
}

.response-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin: 24px 0;
}

.response-details div {
  padding: 14px;
  border-radius: 9px;
  background: #111b25;
}

.response-details dt {
  color: #95a3af;
  font-size: 12px;
}

.response-details dd {
  margin: 6px 0 0;
  color: #eef4f8;
}

.errors h3 {
  font-size: 14px;
}

.errors ul {
  display: grid;
  gap: 6px;
  padding-left: 20px;
  font-size: 12px;
}

.attempt-log {
  margin-top: 24px;
}

.attempt-log h3 {
  color: #95a3af;
  font-size: 14px;
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
  padding: 9px;
  border-bottom: 1px solid #273640;
  vertical-align: top;
}

.privacy-note {
  margin: 24px 0 0;
}

@media (max-width: 760px) {
  .view-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
