import type { ThreeKDartsRound } from './threeKDartsApi'

export function getTeamMatchIds(round: ThreeKDartsRound, participantId: number): number[] {
  const matches = Array.isArray(round.matches) ? round.matches : []
  return matches.flatMap((match) => {
    if (
      match.participantHome?.id !== participantId &&
      match.participantGuest?.id !== participantId
    ) {
      return []
    }

    const matchId = match.id ?? match.matchId
    return typeof matchId === 'number' && Number.isInteger(matchId) && matchId > 0
      ? [matchId]
      : []
  })
}
