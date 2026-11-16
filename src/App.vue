<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import Select from 'primevue/select'
import logo from './assets/hr-logo.png'
import { useSeasonStore } from './stores/season'

const seasonStore = useSeasonStore()
const { selectedSeason, seasons } = storeToRefs(seasonStore)
const mobileMenuOpen = ref(false)
</script>

<template>
  <div class="app-shell app-dark">
    <aside class="sidebar" aria-label="Hauptnavigation">
      <img class="brand-mark" :src="logo" alt="" aria-hidden="true" />
      <nav class="nav-list">
        <RouterLink class="nav-link" to="/" exact-active-class="is-active">
          <i class="pi pi-chart-bar" aria-hidden="true" /><span>Dashboard</span>
        </RouterLink>
        <RouterLink class="nav-link" to="/statistik" active-class="is-active">
          <i class="pi pi-chart-line" aria-hidden="true" /><span>Statistik</span>
        </RouterLink>
      </nav>
      <div class="sidebar-footer">Hirsch-Rabauken</div>
    </aside>

    <template v-if="mobileMenuOpen">
      <button
        class="mobile-menu-backdrop"
        type="button"
        aria-label="Navigationsmenü schließen"
        @click="mobileMenuOpen = false"
      />
      <aside class="mobile-navigation" aria-label="Mobile Hauptnavigation">
        <img class="mobile-brand-mark" :src="logo" alt="" aria-hidden="true" />
        <nav class="nav-list">
          <RouterLink class="nav-link" to="/" exact-active-class="is-active" @click="mobileMenuOpen = false">
            <i class="pi pi-chart-bar" aria-hidden="true" /><span>Dashboard</span>
          </RouterLink>
          <RouterLink class="nav-link" to="/statistik" active-class="is-active" @click="mobileMenuOpen = false">
            <i class="pi pi-chart-line" aria-hidden="true" /><span>Statistik</span>
          </RouterLink>
        </nav>
      </aside>
    </template>

    <main class="main-area">
      <header class="topbar">
        <div class="mobile-heading-row">
          <button
            class="mobile-menu-button"
            type="button"
            aria-label="Navigation öffnen"
            :aria-expanded="mobileMenuOpen"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <i class="pi pi-bars" aria-hidden="true" />
          </button>
          <div>
          <p class="eyebrow">DART STATISTIK</p>
          <h1>Hirsch-Rabauken Statistik</h1>
          </div>
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
