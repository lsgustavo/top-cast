export function formatRoomTimeRemaining(expiresAt: number, now = Date.now()): string {
  const remainingMs = Math.max(0, expiresAt - now);
  if (remainingMs === 0) {
    return 'Expirada';
  }

  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m restantes` : `${minutes}m restantes`;
}

export function getParticipantInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  return words.length === 1
    ? words[0].slice(0, 2).toUpperCase()
    : `${words[0][0]}${words.at(-1)?.[0] ?? ''}`.toUpperCase();
}

export function getParticipantAvatarHue(displayName: string): number {
  let hash = 0;
  for (const character of displayName) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % 360;
}
