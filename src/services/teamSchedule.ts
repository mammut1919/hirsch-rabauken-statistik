import type {
  ThreeKDartsParticipantResponse,
  ThreeKDartsScheduleMatch,
} from './threeKDartsApi'

export interface SeasonTeamParticipant {
  id: number | null
  displayName: string | null
}

export interface SeasonTeamMatch {
  matchId: number
  datePlanned: string | null
  participantHome: SeasonTeamParticipant
  participantGuest: SeasonTeamParticipant
  statusCd: string | null
  setsHome: number | null
  setsAway: number | null
  legsHome: number | null
  legsAway: number | null
  roundName: string | null
}

function positiveId(value: unknown): number | null {
  const id = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function displayName(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function plannedDate(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function resultValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function normalizeParticipant(
  participant: ThreeKDartsScheduleMatch['participantHome'],
): SeasonTeamParticipant {
  return {
    id: positiveId(participant?.id),
    displayName: displayName(participant?.displayName),
  }
}

export function normalizeSeasonTeamMatches(
  response: ThreeKDartsParticipantResponse,
  participantId: number,
): SeasonTeamMatch[] {
  const matches = Array.isArray(response.matches) ? response.matches : []
  return matches.flatMap((match) => {
    const homeId = positiveId(match.participantHome?.id)
    const guestId = positiveId(match.participantGuest?.id)
    if (homeId !== participantId && guestId !== participantId) return []

    const matchId = positiveId(match.id)
    if (matchId === null) return []

    return [{
      matchId,
      datePlanned: plannedDate(match.datePlanned),
      participantHome: normalizeParticipant(match.participantHome),
      participantGuest: normalizeParticipant(match.participantGuest),
      statusCd: typeof match.statusCd === 'string' ? match.statusCd : null,
      setsHome: resultValue(match.setsHome),
      setsAway: resultValue(match.setsAway),
      legsHome: resultValue(match.legsHome),
      legsAway: resultValue(match.legsAway),
      roundName: displayName(match.round?.name),
    }]
  })
}
