<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Select from 'primevue/select'
import { useSeasonStore } from './stores/season'

const seasonStore = useSeasonStore()
const { selectedSeason, seasons } = storeToRefs(seasonStore)
</script>

<template>
  <div class="app-shell app-dark">
    <aside class="sidebar" aria-label="Hauptnavigation">
      <div class="brand-mark" aria-hidden="true">HR</div>
      <nav class="nav-list">
        <RouterLink class="nav-link" to="/" exact-active-class="is-active">
          <i class="pi pi-chart-bar" aria-hidden="true" /><span>Dashboard</span>
        </RouterLink>
        <RouterLink class="nav-link" to="/mannschaftsspiele" active-class="is-active">
          <i class="pi pi-flag" aria-hidden="true" /><span>Mannschaftsspiele</span>
        </RouterLink>
        <RouterLink class="nav-link" to="/spieler" active-class="is-active">
          <i class="pi pi-users" aria-hidden="true" /><span>Spieler</span>
        </RouterLink>
        <RouterLink class="nav-link" to="/doppel" active-class="is-active">
          <i class="pi pi-share-alt" aria-hidden="true" /><span>Doppel</span>
        </RouterLink>
        <RouterLink class="nav-link" to="/einstellungen" active-class="is-active">
          <i class="pi pi-cog" aria-hidden="true" /><span>Einstellungen</span>
        </RouterLink>
      </nav>
      <div class="sidebar-footer">Hirsch-Rabauken</div>
    </aside>

    <main class="main-area">
      <header class="topbar">
        <div>
          <p class="eyebrow">DART STATISTIK</p>
          <h1>Hirsch-Rabauken Statistik</h1>
        </div>
        <div class="season-control">
          <label for="season-select">Saison</label>
          <Select
            id="season-select"
            v-model="selectedSeason"
            :options="seasons"
            option-label="label"
            option-value="value"
            aria-label="Saison auswählen"
          />
        </div>
      </header>
      <section class="page-content">
        <RouterView />
      </section>
    </main>
  </div>
</template>
