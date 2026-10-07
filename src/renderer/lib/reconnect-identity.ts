import type { RoomSnapshot } from '../../shared/types/signaling';

export interface ReconnectIdentity {
  inviteCode: string;
  participantId: string;
  displayName: string;
  role: 'host' | 'guest';
}

export function getReconnectIdentity(
  room: RoomSnapshot,
  participantId: string | undefined,
): ReconnectIdentity | null {
  const participant = room.participants.find((candidate) => candidate.id === participantId);
  if (!participant) {
    return null;
  }

  return {
    inviteCode: room.inviteCode,
    participantId: participant.id,
    displayName: participant.displayName,
    role: participant.role,
  };
}
