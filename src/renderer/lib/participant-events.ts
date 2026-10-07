import type { RoomSnapshot } from '../../shared/types/signaling';

export interface ParticipantChanges {
  joined: RoomSnapshot['participants'];
  left: RoomSnapshot['participants'];
}

export function getParticipantChanges(
  previousRoom: RoomSnapshot | null,
  updatedRoom: RoomSnapshot,
): ParticipantChanges {
  if (!previousRoom || previousRoom.id !== updatedRoom.id) {
    return { joined: [], left: [] };
  }

  const previousIds = new Set(previousRoom.participants.map((participant) => participant.id));
  const updatedIds = new Set(updatedRoom.participants.map((participant) => participant.id));
  return {
    joined: updatedRoom.participants.filter((participant) => !previousIds.has(participant.id)),
    left: previousRoom.participants.filter((participant) => !updatedIds.has(participant.id)),
  };
}
