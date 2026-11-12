import { describe, expect, it } from 'vitest'
import router from '../router'

describe('application routes', () => {
  it('keeps the dashboard as the root route and exposes statistics and diagnostics', () => {
    expect(router.resolve('/').name).toBe('dashboard')
    expect(router.resolve('/statistik').name).toBe('statistik')
    expect(router.resolve('/matchreport-test').name).toBe('matchreport-test')
  })

  it('does not register the removed empty pages', () => {
    const paths = router.getRoutes().map(({ path }) => path)

    expect(paths).not.toContain('/mannschaftsspiele')
    expect(paths).not.toContain('/spieler')
    expect(paths).not.toContain('/doppel')
    expect(paths).not.toContain('/einstellungen')
  })
})
