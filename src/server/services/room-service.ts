import { randomInt, randomUUID } from 'node:crypto';
import type {
  ActiveRoomSummary,
  RoomAvailability,
  RoomErrorCode,
  RoomOperationResult,
  RoomParticipant,
  RoomSnapshot,
  SetPresenterResult,
  WebRtcSignalError,
} from '../../shared/types/signaling.js';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 6;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const EXPIRED_CODE_RETENTION_MS = ROOM_TTL_MS;
const MAX_PARTICIPANTS = 10;
const MAX_DISPLAY_NAME_LENGTH = 32;

interface Room {
  id: string;
  inviteCode: string;
  hostSocketId: string;
  presenterSocketId: string;
  expiresAt: number;
  participants: Map<string, RoomParticipant>;
}

interface LeaveResult {
  roomId: string;
  roomClosed: boolean;
  hostTransferred: boolean;
  removedParticipantId?: string;
  snapshot?: RoomSnapshot;
}

export class RoomService {
  private readonly roomsById = new Map<string, Room>();
  private readonly roomIdsByCode = new Map<string, string>();
  private readonly roomIdsBySocketId = new Map<string, string>();
  private readonly expiredCodes = new Map<string, number>();

  create(
    socketId: string,
    rawName: unknown,
    rawAvatarSeedOrNow?: unknown,
    maybeNow = Date.now(),
  ): RoomOperationResult {
    let rawAvatarSeed: unknown = rawAvatarSeedOrNow;
    let now = maybeNow;
    if (typeof rawAvatarSeedOrNow === 'number') {
      now = rawAvatarSeedOrNow;
      rawAvatarSeed = undefined;
    }

    if (this.roomIdsBySocketId.has(socketId)) {
      return { ok: false, error: 'ALREADY_IN_ROOM' };
    }
    if (this.roomsById.size > 0) {
      return { ok: false, error: 'ROOM_EXISTS' };
    }

    const displayName = this.validateName(rawName);
    if (!displayName) {
      return { ok: false, error: 'INVALID_NAME' };
    }

    const avatarSeed = this.validateAvatarSeed(rawAvatarSeed) ?? randomUUID();
    const room: Room = {
      id: randomUUID(),
      inviteCode: this.createInviteCode(),
      hostSocketId: socketId,
      presenterSocketId: socketId,
      expiresAt: now + ROOM_TTL_MS,
      participants: new Map(),
    };
    const participant: RoomParticipant = {
      id: socketId,
      displayName,
      role: 'host',
      joinedAt: now,
      presence: 'available',
      avatarSeed,
    };

    room.participants.set(socketId, participant);
    this.roomsById.set(room.id, room);
    this.roomIdsByCode.set(room.inviteCode, room.id);
    this.roomIdsBySocketId.set(socketId, room.id);

    return { ok: true, room: this.toSnapshot(room) };
  }

  join(
    socketId: string,
    rawCode: unknown,
    rawName: unknown,
    rawAvatarSeedOrNow?: unknown,
    maybeNow = Date.now(),
  ): RoomOperationResult {
    let rawAvatarSeed: unknown = rawAvatarSeedOrNow;
    let now = maybeNow;
    if (typeof rawAvatarSeedOrNow === 'number') {
      now = rawAvatarSeedOrNow;
      rawAvatarSeed = undefined;
    }

    if (this.roomIdsBySocketId.has(socketId)) {
      return { ok: false, error: 'ALREADY_IN_ROOM' };
    }

    const displayName = this.validateName(rawName);
    if (!displayName) {
      return { ok: false, error: 'INVALID_NAME' };
    }

    if (typeof rawCode !== 'string') {
      return { ok: false, error: 'INVALID_CODE' };
    }

    const normalizedCode = rawCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!new RegExp(`^[${INVITE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`).test(normalizedCode)) {
      return { ok: false, error: 'INVALID_CODE' };
    }

    const roomId = this.roomIdsByCode.get(normalizedCode);
    const room = roomId ? this.roomsById.get(roomId) : undefined;
    if (!room) {
      const expiredUntil = this.expiredCodes.get(normalizedCode);
      if (expiredUntil && expiredUntil > now) {
        return { ok: false, error: 'ROOM_EXPIRED' };
      }
      this.expiredCodes.delete(normalizedCode);
      return { ok: false, error: 'INVALID_CODE' };
    }

    if (room.expiresAt <= now) {
      this.expireRoom(room, now);
      return { ok: false, error: 'ROOM_EXPIRED' };
    }

    if (room.participants.size >= MAX_PARTICIPANTS) {
      return { ok: false, error: 'ROOM_FULL' };
    }

    const avatarSeed = this.validateAvatarSeed(rawAvatarSeed) ?? randomUUID();
    const participant: RoomParticipant = {
      id: socketId,
      displayName,
      role: 'guest',
      joinedAt: now,
      presence: 'available',
      avatarSeed,
    };
    room.participants.set(socketId, participant);
    this.roomIdsBySocketId.set(socketId, room.id);

    return { ok: true, room: this.toSnapshot(room) };
  }

  joinActive(
    socketId: string,
    rawName: unknown,
    rawAvatarSeedOrNow?: unknown,
    maybeNow = Date.now(),
  ): RoomOperationResult {
    let rawAvatarSeed: unknown = rawAvatarSeedOrNow;
    let now = maybeNow;
    if (typeof rawAvatarSeedOrNow === 'number') {
      now = rawAvatarSeedOrNow;
      rawAvatarSeed = undefined;
    }

    if (this.roomIdsBySocketId.has(socketId)) {
      return { ok: false, error: 'ALREADY_IN_ROOM' };
    }

    const displayName = this.validateName(rawName);
    if (!displayName) {
      return { ok: false, error: 'INVALID_NAME' };
    }

    const room = this.roomsById.values().next().value;
    if (!room) {
      return { ok: false, error: 'INVALID_CODE' };
    }

    if (room.expiresAt <= now) {
      this.expireRoom(room, now);
      return { ok: false, error: 'ROOM_EXPIRED' };
    }

    if (room.participants.size >= MAX_PARTICIPANTS) {
      return { ok: false, error: 'ROOM_FULL' };
    }

    const avatarSeed = this.validateAvatarSeed(rawAvatarSeed) ?? randomUUID();
    const participant: RoomParticipant = {
      id: socketId,
      displayName,
      role: 'guest',
      joinedAt: now,
      presence: 'available',
      avatarSeed,
    };
    room.participants.set(socketId, participant);
    this.roomIdsBySocketId.set(socketId, room.id);

    return { ok: true, room: this.toSnapshot(room) };
  }

  leave(socketId: string, now = Date.now(), transferHost = false): LeaveResult | undefined {
    const roomId = this.roomIdsBySocketId.get(socketId);
    if (!roomId) {
      return undefined;
    }

    const room = this.roomsById.get(roomId);
    this.roomIdsBySocketId.delete(socketId);
    if (!room) {
      return undefined;
    }

    if (room.hostSocketId === socketId) {
      room.participants.delete(socketId);
      if (transferHost && room.participants.size > 0) {
        const nextHost = Array.from(room.participants.values())
          .sort((first, second) => first.joinedAt - second.joinedAt)[0];
        if (nextHost) {
          nextHost.role = 'host';
          room.hostSocketId = nextHost.id;
          if (room.presenterSocketId === socketId || !room.participants.has(room.presenterSocketId)) {
            room.presenterSocketId = nextHost.id;
          }
          return {
            roomId,
            roomClosed: false,
            hostTransferred: true,
            removedParticipantId: socketId,
            snapshot: this.toSnapshot(room),
          };
        }
      }
      this.closeRoom(room);
      return { roomId, roomClosed: true, hostTransferred: false, removedParticipantId: socketId };
    }

    room.participants.delete(socketId);
    if (room.presenterSocketId === socketId) {
      room.presenterSocketId = room.hostSocketId;
    }
    return {
      roomId,
      roomClosed: false,
      hostTransferred: false,
      removedParticipantId: socketId,
      snapshot: this.toSnapshot(room),
    };
  }

  getAvailability(): { active: boolean } {
    return { active: this.roomsById.size > 0 };
  }

  getAvailabilityInfo(): RoomAvailability {
    const room = this.roomsById.values().next().value;
    if (!room) {
      return { active: false };
    }
    const host =
      room.participants.get(room.hostSocketId) ??
      Array.from(room.participants.values()).find((p) => p.role === 'host');
    const summary: ActiveRoomSummary = {
      id: room.id,
      hostDisplayName: host?.displayName ?? 'Host',
      hostAvatarSeed: host?.avatarSeed,
      participantCount: room.participants.size,
      maxParticipants: MAX_PARTICIPANTS,
      expiresAt: room.expiresAt,
    };
    return { active: true, room: summary };
  }

  getParticipantRole(socketId: string): RoomParticipant['role'] | undefined {
    const roomId = this.roomIdsBySocketId.get(socketId);
    const room = roomId ? this.roomsById.get(roomId) : undefined;
    return room?.participants.get(socketId)?.role;
  }

  kick(hostSocketId: string, participantId: unknown): LeaveResult | undefined {
    const roomId = this.roomIdsBySocketId.get(hostSocketId);
    const room = roomId ? this.roomsById.get(roomId) : undefined;
    if (!room || room.hostSocketId !== hostSocketId || typeof participantId !== 'string') {
      return undefined;
    }
    if (participantId === hostSocketId || !room.participants.has(participantId)) {
      return undefined;
    }

    room.participants.delete(participantId);
    this.roomIdsBySocketId.delete(participantId);
    if (room.presenterSocketId === participantId) {
      room.presenterSocketId = room.hostSocketId;
    }
    return {
      roomId: room.id,
      roomClosed: false,
      hostTransferred: false,
      removedParticipantId: participantId,
      snapshot: this.toSnapshot(room),
    };
  }

  setPresence(socketId: string, presence: unknown): RoomSnapshot | undefined {
    if (presence !== 'available' && presence !== 'away' && presence !== 'busy') {
      return undefined;
    }
    const roomId = this.roomIdsBySocketId.get(socketId);
    const room = roomId ? this.roomsById.get(roomId) : undefined;
    const participant = room?.participants.get(socketId);
    if (!room || !participant) {
      return undefined;
    }
    participant.presence = presence;
    return this.toSnapshot(room);
  }

  setAvatar(socketId: string, rawAvatarSeed: unknown): RoomSnapshot | undefined {
    const avatarSeed = this.validateAvatarSeed(rawAvatarSeed);
    if (!avatarSeed) {
      return undefined;
    }
    const roomId = this.roomIdsBySocketId.get(socketId);
    const room = roomId ? this.roomsById.get(roomId) : undefined;
    const participant = room?.participants.get(socketId);
    if (!room || !participant) {
      return undefined;
    }
    participant.avatarSeed = avatarSeed;
    return this.toSnapshot(room);
  }

  setDisplayName(socketId: string, rawName: unknown): RoomSnapshot | undefined {
    const displayName = this.validateName(rawName);
    if (!displayName) {
      return undefined;
    }
    const roomId = this.roomIdsBySocketId.get(socketId);
    const room = roomId ? this.roomsById.get(roomId) : undefined;
    const participant = room?.participants.get(socketId);
    if (!room || !participant) {
      return undefined;
    }
    participant.displayName = displayName;
    return this.toSnapshot(room);
  }

  setPresenter(requesterSocketId: string, rawTargetParticipantId: unknown): SetPresenterResult {
    const roomId = this.roomIdsBySocketId.get(requesterSocketId);
    const room = roomId ? this.roomsById.get(roomId) : undefined;
    const requester = room?.participants.get(requesterSocketId);
    if (!room || !requester) {
      return { ok: false, error: 'NOT_IN_ROOM' };
    }

    if (typeof rawTargetParticipantId !== 'string' || !room.participants.has(rawTargetParticipantId)) {
      return { ok: false, error: 'INVALID_PARTICIPANT' };
    }

    const isHost = room.hostSocketId === requesterSocketId || requester.role === 'host';
    const isCurrentPresenter = room.presenterSocketId === requesterSocketId;
    const isSelfClaim = rawTargetParticipantId === requesterSocketId;

    if (!isHost && !isCurrentPresenter && !isSelfClaim) {
      return { ok: false, error: 'NOT_ALLOWED' };
    }

    room.presenterSocketId = rawTargetParticipantId;
    return { ok: true, room: this.toSnapshot(room) };
  }

  authorizeSignal(
    fromSocketId: string,
    toSocketId: string,
    signalType: 'offer' | 'answer' | 'ice-candidate',
  ): WebRtcSignalError | undefined {
    const roomId = this.roomIdsBySocketId.get(fromSocketId);
    if (!roomId) {
      return 'NOT_IN_ROOM';
    }

    if (this.roomIdsBySocketId.get(toSocketId) !== roomId) {
      return 'PEER_NOT_IN_ROOM';
    }

    const room = this.roomsById.get(roomId);
    const sender = room?.participants.get(fromSocketId);
    const receiver = room?.participants.get(toSocketId);
    if (!room || !sender || !receiver || sender.id === receiver.id) {
      return 'PEER_NOT_IN_ROOM';
    }

    const presenterId = room.presenterSocketId || room.hostSocketId;
    if (
      (signalType === 'offer' && sender.id !== presenterId) ||
      (signalType === 'answer' && (sender.id === presenterId || receiver.id !== presenterId))
    ) {
      return 'NOT_ALLOWED';
    }
  }

  expireRooms(now = Date.now()): string[] {
    const expiredRoomIds: string[] = [];
    for (const room of this.roomsById.values()) {
      if (room.expiresAt <= now) {
        expiredRoomIds.push(room.id);
        this.expireRoom(room, now);
      }
    }

    for (const [code, expiredUntil] of this.expiredCodes) {
      if (expiredUntil <= now) {
        this.expiredCodes.delete(code);
      }
    }

    return expiredRoomIds;
  }

  private validateName(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const displayName = value.trim();
    if (displayName.length === 0 || displayName.length > MAX_DISPLAY_NAME_LENGTH) {
      return undefined;
    }
    return displayName;
  }

  private validateAvatarSeed(rawSeed: unknown): string | undefined {
    if (typeof rawSeed !== 'string') {
      return undefined;
    }
    const trimmed = rawSeed.trim();
    if (trimmed.length === 0 || trimmed.length > 64) {
      return undefined;
    }
    return trimmed;
  }

  private createInviteCode(): string {
    if (this.roomsById.size > 0) {
      throw new Error('Only one active room is allowed');
    }
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = Array.from(
        { length: INVITE_CODE_LENGTH },
        () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)],
      ).join('');
      if (!this.roomIdsByCode.has(code) && !this.expiredCodes.has(code)) {
        return code;
      }
    }

    throw new Error('Could not generate a unique room invitation code');
  }

  private expireRoom(room: Room, now: number): void {
    this.expiredCodes.set(room.inviteCode, now + EXPIRED_CODE_RETENTION_MS);
    this.closeRoom(room);
  }

  private closeRoom(room: Room): void {
    this.roomsById.delete(room.id);
    this.roomIdsByCode.delete(room.inviteCode);
    for (const participantId of room.participants.keys()) {
      this.roomIdsBySocketId.delete(participantId);
    }
  }

  private toSnapshot(room: Room): RoomSnapshot {
    return {
      id: room.id,
      inviteCode: `${room.inviteCode.slice(0, 3)}-${room.inviteCode.slice(3)}`,
      expiresAt: room.expiresAt,
      participants: Array.from(room.participants.values()),
      maxParticipants: MAX_PARTICIPANTS,
      presenterId: room.presenterSocketId,
    };
  }
}

export function isRoomErrorCode(value: string): value is RoomErrorCode {
  return [
    'ROOM_EXISTS',
    'INVALID_CODE',
    'ROOM_EXPIRED',
    'ROOM_FULL',
    'ALREADY_IN_ROOM',
    'INVALID_NAME',
    'RATE_LIMITED',
    'SERVER_ERROR',
  ].includes(value);
}
