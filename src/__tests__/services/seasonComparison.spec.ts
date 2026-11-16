import { describe, expect, it } from 'vitest'
import {
  calculateSeasonComparison,
  MATCHDAYS_PER_SEASON,
  type SeasonComparisonInput,
} from '../../services/seasonComparison'
import type { ThreeKDartsRound } from '../../services/threeKDartsApi'

const teamId = 527581
const opponentId = 900001

function report(teamGame: unknown): unknown[] {
  return [
    ...Array.from({ length: 18 }, (_, index) => ({
      id: 10000 + index,
      matchTypeCd: index === 0 ? 'DP' : 'EZ',
      statusCd: 'FINISH',
      legsHome: 2,
      legsAway: 0,
    })),
    teamGame,
  ]
}

function match(
  id: number,
  statusCd: string,
  setsHome: number | null,
  setsAway: number | null,
) {
  return {
    id,
    statusCd,
    participantHome: { id: teamId },
    participantGuest: { id: opponentId },
    setsHome,
    setsAway,
  }
}

function input(
  roundData: Record<number, ThreeKDartsRound>,
  reports: Record<number, unknown> = {},
  failedReports: Record<number, unknown> = {},
): SeasonComparisonInput {
  return {
    seasonKey: '2026-1',
    label: '2026 · 1. Halbjahr',
    participantId: teamId,
    roundIds: Array.from({ length: MATCHDAYS_PER_SEASON }, (_, index) => 200 + index),
    roundData,
    reports,
    failedReports,
  }
}

describe('season comparison points', () => {
  it('awards two points for a TG win and one for a TG loss using the TG report', () => {
    const lostInput = input(
      { 200: { matches: [match(1, 'FINISH', 9, 10)] } },
      {
        1: report({
          matchTypeCd: 'TG',
          statusCd: 'FINISH',
          legsHome: 0,
          legsAway: 1,
          participantHome: { id: teamId },
          participantGuest: { id: opponentId },
        }),
      },
    )
    const wonInput = input(
      { 200: { matches: [match(2, 'FINISH', 10, 9)] } },
      {
        2: report({
          matchTypeCd: 'TG',
          statusCd: 'FINISH',
          legsHome: 2,
          legsAway: 1,
          participantHome: { id: teamId },
          participantGuest: { id: opponentId },
        }),
      },
    )

    expect(calculateSeasonComparison(lostInput).points[0]).toMatchObject({
      cumulativePoints: 1,
      state: 'complete',
      message: 'Team-Game verloren: 1 Punkt.',
    })
    expect(calculateSeasonComparison(wonInput).points[0]).toMatchObject({
      cumulativePoints: 2,
      state: 'complete',
      message: 'Team-Game gewonnen: 2 Punkte.',
    })
  })

  it('awards three points for a regular win and zero for a regular loss', () => {
    const comparison = calculateSeasonComparison(
      input(
        {
          200: { matches: [match(1, 'FINISH', 10, 8)] },
          201: {
            matches: [{
              ...match(2, 'FINISH', 8, 10),
              participantHome: { id: opponentId },
              participantGuest: { id: teamId },
              setsHome: 10,
              setsAway: 8,
            }],
          },
          ...Object.fromEntries(
            Array.from({ length: 12 }, (_, index) => [
              202 + index,
              { matches: [match(300 + index, 'OPEN', null, null)] },
            ]),
          ),
        },
        {
          1: report({ matchTypeCd: 'TG', statusCd: 'OPEN' }),
          2: report({ matchTypeCd: 'TG', statusCd: 'OPEN' }),
        },
      ),
    )

    expect(comparison.points[0]).toMatchObject({ cumulativePoints: 3, state: 'complete' })
    expect(comparison.points[1]).toMatchObject({ cumulativePoints: 3, state: 'complete' })
    expect(comparison.latestPoints).toBe(3)
  })

  it('carries the total through open matchdays and marks missing reports incomplete', () => {
    const comparison = calculateSeasonComparison(
      input(
        {
          200: { matches: [match(1, 'FINISH', 10, 8)] },
          201: { matches: [match(2, 'OPEN', null, null)] },
          202: { matches: [match(3, 'FINISH', 10, 8)] },
        },
        { 1: report({ matchTypeCd: 'TG', statusCd: 'OPEN' }) },
      ),
    )

    expect(comparison.points[1]).toMatchObject({ cumulativePoints: 3, state: 'open' })
    expect(comparison.points[2]).toMatchObject({ cumulativePoints: null, state: 'incomplete' })
    expect(comparison.points[3]?.cumulativePoints).toBeNull()
    expect(comparison.complete).toBe(false)
  })

  it('does not award TG points when the team IDs or winner conflict with the schedule', () => {
    const comparison = calculateSeasonComparison(
      input(
        { 200: { matches: [match(1, 'FINISH', 9, 10)] } },
        {
          1: report({
            matchTypeCd: 'TG',
            statusCd: 'FINISH',
            legsHome: 1,
            legsAway: 0,
            participantHome: { id: teamId },
            participantGuest: { id: opponentId },
          }),
        },
      ),
    )

    expect(comparison.points[0]).toMatchObject({ cumulativePoints: null, state: 'incomplete' })
  })
})
