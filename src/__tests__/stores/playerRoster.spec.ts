import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../services/threeKDartsApi', () => ({
  fetchSeasonParticipant: vi.fn(async (participantId: number) => {
    const isH1 = participantId === 527581
    const count = 14
    return {
      participant: { teamSeason: { teamMembers: [] } },
      matches: Array.from({ length: count }, (_, index) => {
        const teamIsHome = index % 2 === 0
        const statusCd = isH1 || index < 6 ? 'FINISH' : 'OPEN'
        return {
          id: (isH1 ? 4652700 : 6354400) + index,
          datePlanned: `2026-10-${String(index + 1).padStart(2, '0')}T15:00:00.000+0000`,
          participantHome: {
            id: teamIsHome ? participantId : 900000 + index,
            displayName: teamIsHome ? 'Hirsch-Rabauken' : `Gegner ${index + 1}`,
          },
          participantGuest: {
            id: teamIsHome ? 900000 + index : participantId,
            displayName: teamIsHome ? `Gegner ${index + 1}` : 'Hirsch-Rabauken',
          },
          statusCd,
          setsHome: statusCd === 'FINISH' ? 10 : null,
          setsAway: statusCd === 'FINISH' ? 8 : null,
          legsHome: statusCd === 'FINISH' ? 22 : null,
          legsAway: statusCd === 'FINISH' ? 18 : null,
          round: { name: `Spieltag ${index + 1}` },
        }
      }),
    }
  }),
}))

import { fetchSeasonParticipant } from '../../services/threeKDartsApi'
import { getAvailableSeasons } from '../../services/seasonConfig'
import { usePlayerRosterStore } from '../../stores/playerRoster'

describe('player roster store season schedules', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('stores H1 and H2 schedules independently from the shared participant responses', async () => {
    const store = usePlayerRosterStore()
    const seasons = getAvailableSeasons(new Date(2026, 10, 1)).filter(({ key }) =>
      key === '2026-1' || key === '2026-2',
    )

    await store.loadRosters(seasons)

    expect(fetchSeasonParticipant).toHaveBeenCalledTimes(2)
    expect(store.teamMatchesBySeason['2026-1']).toHaveLength(14)
    expect(store.teamMatchesBySeason['2026-2']).toHaveLength(14)
    expect(store.teamMatchesBySeason['2026-1'].every(({ statusCd }) => statusCd === 'FINISH')).toBe(true)
    expect(store.teamMatchesBySeason['2026-2'].filter(({ statusCd }) => statusCd === 'FINISH')).toHaveLength(6)
    expect(store.teamMatchesBySeason['2026-2'].filter(({ statusCd }) => statusCd === 'OPEN')).toHaveLength(8)
    expect(store.teamMatchesBySeason['2026-1'][0]?.matchId).toBe(4652700)
    expect(store.teamMatchesBySeason['2026-2'][0]?.matchId).toBe(6354400)
  })
})
