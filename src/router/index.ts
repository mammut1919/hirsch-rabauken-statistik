import { createRouter, createWebHistory } from 'vue-router'

import DashboardView from '../views/DashboardView.vue'
import TeamMatchesView from '../views/TeamMatchesView.vue'
import PlayersView from '../views/PlayersView.vue'
import DoublesView from '../views/DoublesView.vue'
import SettingsView from '../views/SettingsView.vue'
import MatchReportTestView from '../views/MatchReportTestView.vue'
import StatisticsView from '../views/StatisticsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/mannschaftsspiele', name: 'mannschaftsspiele', component: TeamMatchesView },
    { path: '/spieler', name: 'spieler', component: PlayersView },
    { path: '/doppel', name: 'doppel', component: DoublesView },
    { path: '/einstellungen', name: 'einstellungen', component: SettingsView },
    { path: '/matchreport-test', name: 'matchreport-test', component: MatchReportTestView },
    { path: '/statistik', name: 'statistik', component: StatisticsView },
  ],
})

export default router
