import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AboutView from '../../views/AboutView.vue'

describe('AboutView', () => {
  it('shows the project, data-source, and independence information', () => {
    const wrapper = mount(AboutView)

    expect(wrapper.text()).toContain('Hirsch-Rabauken-Statistik')
    expect(wrapper.text()).toContain('Marco Deffert')
    expect(wrapper.text()).toContain('Ein privates, nicht kommerzielles Projekt')
    expect(wrapper.text()).toContain('keiner offiziellen Verbindung zu 3K-Darts')
  })

  it('links to the official team overview safely in a new tab', () => {
    const link = mount(AboutView).get('a')

    expect(link.text()).toContain('Hirsch-Rabauken bei 3K Darts')
    expect(link.attributes('href')).toBe(
      'https://portal.3k-darts.com/frontend/events/9/event/40293/participants/682469',
    )
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })
})
