import { afterEach, describe, it, expect, vi } from 'vitest'

import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import App from '../App.vue'

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the application shell and main navigation', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    const wrapper = mount(App, {
      global: {
        plugins: [
          createPinia(),
          [PrimeVue, { theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } } }],
        ],
        stubs: { RouterLink: { template: '<a><slot /></a>' }, RouterView: true },
      },
    })

    expect(wrapper.text()).toContain('Hirsch-Rabauken Statistik')
    expect(wrapper.text()).toContain('Dashboard')
    expect(wrapper.text()).toContain('Statistik')
    expect(wrapper.text()).not.toContain('Mannschaftsspiele')
    expect(wrapper.text()).not.toContain('Spieler')
    expect(wrapper.text()).not.toContain('Doppel')
    expect(wrapper.text()).not.toContain('Einstellungen')
    expect(wrapper.text()).toContain('Saison')
  })
})
