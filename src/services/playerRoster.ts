export interface SeasonRosterPlayer {
  playerId: string
  displayName: string
  firstname: string | null
  passNr: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asIdentifier(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function asOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** Reads the official participant response at teamSeason.teamMembers[].member.player. */
export function normalizeSeasonRoster(data: unknown): SeasonRosterPlayer[] {
  const root = asRecord(data)
  const participant = asRecord(root?.participant)
  const teamSeason = asRecord(participant?.teamSeason)
  const teamMembers = teamSeason?.teamMembers
  if (!Array.isArray(teamMembers)) {
    throw new TypeError('Die Teilnehmerantwort enthält keine teamSeason.teamMembers-Liste.')
  }

  const players = new Map<string, SeasonRosterPlayer>()
  for (const rawTeamMember of teamMembers) {
    const teamMember = asRecord(rawTeamMember)
    const member = asRecord(teamMember?.member)
    const player = asRecord(member?.player)
    if (!player) continue

    const playerId = asIdentifier(player.id)
    const displayName = asOptionalText(player.displayName)
    if (!playerId || !displayName) continue

    const candidate: SeasonRosterPlayer = {
      playerId,
      displayName,
      firstname: asOptionalText(player.firstname),
      passNr: asIdentifier(player.passNr),
    }
    const existing = players.get(playerId)
    if (existing && existing.displayName !== displayName) {
      throw new TypeError(`Die Spieler-ID ${playerId} hat widersprüchliche displayName-Werte.`)
    }
    players.set(playerId, candidate)
  }

  return [...players.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
}
