<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { getAvailableSeasons, getCurrentSeasonKey } from '../services/seasonConfig'
import {
  calculateSeasonComparison,
  type SeasonComparisonResult,
} from '../services/seasonComparison'
import { useMatchReportsStore } from '../stores/matchReports'

const matchReportsStore = useMatchReportsStore()
const {
  reportsBySeason,
  roundIdsBySeason,
  roundDataBySeason,
  failedRoundsBySeason,
  failedReportsBySeason,
  loadingBySeason,
  roundCountsBySeason,
  completedRoundsBySeason,
  loadErrorsBySeason,
  roundErrorsBySeason,
} = storeToRefs(matchReportsStore)

const comparisonSeasons = getAvailableSeasons().filter(
  (season) => season.eventId !== null && season.phaseId !== null && season.participantId !== null,
)
const currentSeasonKey = getCurrentSeasonKey()
const visibleSeasonKeys = ref(comparisonSeasons.map(({ key }) => key))
const chartContainer = ref<HTMLDivElement | null>(null)
const chartWidth = ref(760)
let chartResizeObserver: ResizeObserver | null = null

function updateChartWidth(): void {
  const width = chartContainer.value?.getBoundingClientRect().width
  if (width && width > 0) chartWidth.value = width
}

onMounted(() => {
  void matchReportsStore.loadReports(comparisonSeasons)
  updateChartWidth()
  if (chartContainer.value && typeof ResizeObserver !== 'undefined') {
    chartResizeObserver = new ResizeObserver(updateChartWidth)
    chartResizeObserver.observe(chartContainer.value)
  } else {
    window.addEventListener('resize', updateChartWidth)
  }
})

onBeforeUnmount(() => {
  chartResizeObserver?.disconnect()
  window.removeEventListener('resize', updateChartWidth)
})

const seasonResults = computed(() =>
  comparisonSeasons.map((season) =>
    calculateSeasonComparison({
      seasonKey: season.key,
      label: season.label,
      participantId: season.participantId!,
      roundIds: roundIdsBySeason.value[season.key] ?? [],
      roundData: roundDataBySeason.value[season.key] ?? {},
      reports: reportsBySeason.value[season.key] ?? {},
      failedRounds: failedRoundsBySeason.value[season.key] ?? {},
      failedReports: failedReportsBySeason.value[season.key] ?? {},
    }),
  ),
)

const visibleResults = computed(() =>
  seasonResults.value.filter(({ seasonKey }) => visibleSeasonKeys.value.includes(seasonKey)),
)

const chart = computed(() => {
  const maxPoints = Math.max(
    0,
    ...visibleResults.value.flatMap(({ points }) =>
      points.flatMap(({ cumulativePoints }) => cumulativePoints === null ? [] : [cumulativePoints]),
    ),
  )
  const maximum = Math.max(5, Math.ceil(maxPoints / 5) * 5)
  const width = Math.max(240, Math.round(chartWidth.value))
  const height = width < 360 ? 260 : width < 600 ? 310 : 360
  const matchdays = Math.max(14, ...seasonResults.value.map(({ matchdayCount }) => matchdayCount))
  const left = width < 360 ? 37 : width < 600 ? 42 : 48
  const right = width < 360 ? 20 : 24
  const top = 24
  const bottom = 62
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const x = (matchday: number) => left + ((matchday - 1) / Math.max(1, matchdays - 1)) * plotWidth
  const y = (points: number) => top + ((maximum - points) / maximum) * plotHeight
  const ticks = Array.from({ length: Math.floor(maximum / 5) + 1 }, (_, index) => index * 5)

  return { height, width, left, right, top, bottom, plotWidth, plotHeight, maximum, matchdays, x, y, ticks }
})

const lineSegments = computed(() =>
  visibleResults.value.map((season) => {
    const segments: string[] = []
    let currentSegment: string[] = []
    const lastCompleteIndex = season.points.reduce(
      (lastIndex, point, index) => point.state === 'complete' ? index : lastIndex,
      -1,
    )
    for (const point of season.points.slice(0, lastCompleteIndex + 1)) {
      if (point.cumulativePoints === null) {
        if (currentSegment.length > 0) segments.push(currentSegment.join(' '))
        currentSegment = []
        continue
      }
      currentSegment.push(`${chart.value.x(point.matchday)},${chart.value.y(point.cumulativePoints)}`)
    }
    if (currentSegment.length > 0) segments.push(currentSegment.join(' '))
    return { seasonKey: season.seasonKey, segments }
  }),
)

function isCurrentSeason(seasonKey: string): boolean {
  return seasonKey === currentSeasonKey
}

function seasonColor(seasonKey: string): string {
  if (isCurrentSeason(seasonKey)) return '#54e0d2'
  const palette = ['#8aa8ff', '#c28cff', '#f3b66d', '#75c98b']
  const index = comparisonSeasons.findIndex(({ key }) => key === seasonKey)
  return palette[Math.max(0, index) % palette.length]!
}

function currentPoint(
  result: SeasonComparisonResult,
): { x: number; y: number; matchday: number; points: number } | null {
  const lastCompletePoint = [...result.points]
    .reverse()
    .find((point) => point.state === 'complete' && point.cumulativePoints !== null)
  if (!lastCompletePoint || lastCompletePoint.cumulativePoints === null) return null
  return {
    x: chart.value.x(lastCompletePoint.matchday),
    y: chart.value.y(lastCompletePoint.cumulativePoints),
    matchday: lastCompletePoint.matchday,
    points: lastCompletePoint.cumulativePoints,
  }
}

function seasonIssues(result: SeasonComparisonResult): string[] {
  return [...new Set(result.points.flatMap(({ message, state }) =>
    state === 'incomplete' && message ? [message] : [],
  ))]
}

function seasonLoading(seasonKey: string): boolean {
  return Boolean(loadingBySeason.value[seasonKey])
}

function seasonLoadError(seasonKey: string): string | null {
  const errors = [
    loadErrorsBySeason.value[seasonKey],
    ...(roundErrorsBySeason.value[seasonKey] ?? []),
  ].filter(Boolean)
  return errors.length > 0 ? errors[0]! : null
}

function progressLabel(seasonKey: string): string {
  const total = roundCountsBySeason.value[seasonKey] ?? 14
  const completed = completedRoundsBySeason.value[seasonKey] ?? 0
  return `${completed} / ${total} Spieltage geladen`
}
</script>

<template>
  <div class="view-heading">
    <div>
      <p class="eyebrow">MANNSCHAFT · SAISONÜBERGREIFEND</p>
      <h2>Saisonvergleich</h2>
    </div>
  </div>

  <section class="comparison-panel" aria-labelledby="chart-heading">
    <div class="comparison-heading">
      <div>
        <h3 id="chart-heading">Mannschaftspunkte</h3>
        <p>3 Punkte für einen regulären Sieg, 2 bzw. 1 Punkt nach einem Team-Game.</p>
      </div>
      <span class="current-season-note">Aktuelle Saison: {{ currentSeasonKey.replace('-', ' H') }}</span>
    </div>

    <div v-if="seasonResults.length" class="season-controls" aria-label="Angezeigte Saisons">
      <label v-for="season in seasonResults" :key="season.seasonKey" class="season-toggle">
        <input v-model="visibleSeasonKeys" type="checkbox" :value="season.seasonKey" />
        <span class="season-color" :style="{ backgroundColor: seasonColor(season.seasonKey) }" />
        <span>{{ season.label }}</span>
        <span class="season-total">
          {{ season.latestPoints === null ? 'Stand unvollständig' : `${season.latestPoints} Punkte` }}
          <template v-if="season.latestPoints !== null && season.latestMatchday">
            · nach Spieltag {{ season.latestMatchday }}
          </template>
        </span>
      </label>
    </div>

    <div v-if="visibleResults.length" ref="chartContainer" class="chart-canvas">
      <svg
        class="points-chart"
        :width="chart.width"
        :height="chart.height"
        :viewBox="`0 0 ${chart.width} ${chart.height}`"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-labelledby="chart-title chart-description"
      >
        <title id="chart-title">Mannschaftspunkte nach Spieltag</title>
        <desc id="chart-description">
          Saisonlinien nach Spieltag. Offene Begegnungen verändern den Punktestand nicht.
        </desc>

        <g v-for="tick in chart.ticks" :key="`y-${tick}`" class="chart-gridline">
          <line
            :x1="chart.left"
            :x2="chart.width - chart.right"
            :y1="chart.y(tick)"
            :y2="chart.y(tick)"
          />
          <text :x="chart.left - 10" :y="chart.y(tick) + 4" text-anchor="end">{{ tick }}</text>
        </g>

        <g v-for="matchday in chart.matchdays" :key="`x-${matchday}`" class="chart-x-tick">
          <line
            :x1="chart.x(matchday)"
            :x2="chart.x(matchday)"
            :y1="chart.height - chart.bottom"
            :y2="chart.height - chart.bottom + 5"
          />
          <text
            :x="chart.x(matchday)"
            :y="chart.height - chart.bottom + 22"
            text-anchor="middle"
          >{{ matchday }}</text>
        </g>

        <line
          class="chart-axis"
          :x1="chart.left"
          :x2="chart.width - chart.right"
          :y1="chart.height - chart.bottom"
          :y2="chart.height - chart.bottom"
        />
        <text class="axis-title" :x="chart.left + chart.plotWidth / 2" :y="chart.height - 10" text-anchor="middle">
          Spieltag
        </text>
        <text class="axis-title" :transform="`translate(13 ${chart.height / 2}) rotate(-90)`" text-anchor="middle">
          Punkte
        </text>

        <g v-for="line in lineSegments" :key="line.seasonKey">
          <polyline
            v-for="(segment, index) in line.segments"
            :key="`${line.seasonKey}-${index}`"
            :points="segment"
            fill="none"
            :stroke="seasonColor(line.seasonKey)"
            :stroke-width="isCurrentSeason(line.seasonKey) ? 4 : 2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </g>

        <g v-for="season in visibleResults" :key="`latest-${season.seasonKey}`">
          <circle
            v-if="currentPoint(season)"
            class="latest-point"
            :cx="currentPoint(season)?.x"
            :cy="currentPoint(season)?.y"
            :r="isCurrentSeason(season.seasonKey) ? 7 : 5"
            :fill="seasonColor(season.seasonKey)"
          />
          <text
            v-if="currentPoint(season)"
            class="latest-point-label"
            :x="currentPoint(season)!.x + (currentPoint(season)!.matchday >= 12 ? -11 : 11)"
            :y="currentPoint(season)!.y - 11"
            :text-anchor="currentPoint(season)!.matchday >= 12 ? 'end' : 'start'"
            :fill="seasonColor(season.seasonKey)"
          >
            {{ currentPoint(season)!.points }}
          </text>
        </g>
      </svg>
    </div>
    <p v-else class="chart-empty">Keine Saison zur Anzeige ausgewählt.</p>

    <div v-if="seasonResults.some((season) => seasonLoading(season.seasonKey))" class="load-note" role="status">
      Saisonrunden und Matchreports werden geladen.
    </div>

    <div v-for="season in seasonResults" :key="`status-${season.seasonKey}`" class="season-status">
      <p v-if="seasonLoadError(season.seasonKey)" class="data-warning" role="status">
        {{ season.label }}: {{ seasonLoadError(season.seasonKey) }} {{ progressLabel(season.seasonKey) }}.
      </p>
      <p v-else-if="seasonIssues(season).length" class="data-warning" role="status">
        {{ season.label }}: {{ seasonIssues(season).join(' ') }} {{ progressLabel(season.seasonKey) }}.
      </p>
      <p v-else-if="!seasonLoading(season.seasonKey)" class="data-complete">
        {{ season.label }}: Daten bis zu allen verfügbaren Spieltagen geprüft.
      </p>
    </div>
  </section>
</template>

<style scoped>
.comparison-panel {
  padding: 22px;
  border: 1px solid #273640;
  border-radius: 14px;
  background: #0e161f;
}

.comparison-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.comparison-heading h3 {
  margin: 0;
  color: #eaf1f5;
  font-size: 17px;
  font-weight: 600;
}

.comparison-heading p,
.current-season-note {
  margin: 7px 0 0;
  color: #95a3af;
  font-size: 12px;
  line-height: 1.5;
}

.current-season-note {
  margin-top: 2px;
  white-space: nowrap;
}

.season-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 9px 18px;
  margin: 20px 0 10px;
  padding: 12px 14px;
  border: 1px solid #273640;
  border-radius: 10px;
  background: #111b25;
}

.season-toggle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: #c8d5dc;
  font-size: 12px;
}

.season-toggle input {
  accent-color: #54e0d2;
}

.season-color {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}

.season-total {
  color: #95a3af;
  font-variant-numeric: tabular-nums;
}

.chart-canvas {
  width: 100%;
  min-width: 0;
}

.points-chart {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  overflow: visible;
}

.chart-gridline line {
  stroke: #273640;
  stroke-dasharray: 3 5;
}

.chart-gridline text,
.chart-x-tick text {
  fill: #82919e;
  font-size: 11px;
}

.chart-x-tick line,
.chart-axis {
  stroke: #51616e;
}

.axis-title {
  fill: #95a3af;
  font-size: 11px;
}

.latest-point {
  stroke: #0e161f;
  stroke-width: 2;
}

.latest-point-label {
  font-size: 12px;
  font-weight: 700;
}

.chart-empty,
.load-note,
.data-warning,
.data-complete {
  color: #95a3af;
  font-size: 12px;
  line-height: 1.6;
}

.chart-empty {
  padding: 36px 12px;
  text-align: center;
}

.load-note {
  margin: 8px 0;
}

.data-warning,
.data-complete {
  margin: 8px 0 0;
}

.data-warning {
  color: #e6bd75;
}

@media (max-width: 760px) {
  .comparison-panel {
    padding: 16px;
  }

  .comparison-heading {
    flex-direction: column;
    gap: 8px;
  }

  .season-controls {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 430px) {
  .comparison-panel {
    padding: 12px;
  }

  .season-controls {
    padding: 10px;
  }
}
</style>
