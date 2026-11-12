import { createRouter, createWebHistory } from 'vue-router'

import DashboardView from '../views/DashboardView.vue'
import MatchReportTestView from '../views/MatchReportTestView.vue'
import StatisticsView from '../views/StatisticsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/matchreport-test', name: 'matchreport-test', component: MatchReportTestView },
    { path: '/statistik', name: 'statistik', component: StatisticsView },
  ],
})

export default router
