import { randomInt, randomUUID } from 'node:crypto';
import type {
  RoomErrorCode,
  RoomOperationResult,
  RoomParticipant,
  RoomSnapshot,
  WebRtcSignalError,
} from '../../shared/types/signaling.js';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 8;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const EXPIRED_CODE_RETENTION_MS = ROOM_TTL_MS;
const MAX_PARTICIPANTS = 10;
const MAX_DISPLAY_NAME_LENGTH = 32;

interface Room {
  id: string;
  inviteCode: string;
  hostSocketId: string;
  expiresAt: number;
  participants: Map<string, RoomParticipant>;
}

interface LeaveResult {
  roomId: string;
  roomClosed: boolean;
  snapshot?: RoomSnapshot;
}

export class RoomService {
  private readonly roomsById = new Map<string, Room>();
  private readonly roomIdsByCode = new Map<string, string>();
  private readonly roomIdsBySocketId = new Map<string, string>();
  private readonly expiredCodes = new Map<string, number>();

  create(socketId: string, rawName: unknown, now = Date.now()): RoomOperationResult {
    if (this.roomIdsBySocketId.has(socketId)) {
      return { ok: false, error: 'ALREADY_IN_ROOM' };
    }

    const displayName = this.validateName(rawName);
    if (!displayName) {
      return { ok: false, error: 'INVALID_NAME' };
    }

    const room: Room = {
      id: randomUUID(),
      inviteCode: this.createInviteCode(),
      hostSocketId: socketId,
      expiresAt: now + ROOM_TTL_MS,
      participants: new Map(),
    };
    const participant: RoomParticipant = {
      id: socketId,
      displayName,
      role: 'host',
      joinedAt: now,
      microphoneEnabled: false,
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
    now = Date.now(),
  ): RoomOperationResult {
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

    const participant: RoomParticipant = {
      id: socketId,
      displayName,
      role: 'guest',
      joinedAt: now,
      microphoneEnabled: false,
    };
    room.participants.set(socketId, participant);
    this.roomIdsBySocketId.set(socketId, room.id);

    return { ok: true, room: this.toSnapshot(room) };
  }

  leave(socketId: string, now = Date.now()): LeaveResult | undefined {
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
      this.closeRoom(room);
      return { roomId, roomClosed: true };
    }

    room.participants.delete(socketId);
    return { roomId, roomClosed: false, snapshot: this.toSnapshot(room) };
  }

  setMicrophoneEnabled(socketId: string, enabled: boolean): RoomSnapshot | undefined {
    const roomId = this.roomIdsBySocketId.get(socketId);
    const room = roomId ? this.roomsById.get(roomId) : undefined;
    const participant = room?.participants.get(socketId);
    if (!room || !participant) {
      return undefined;
    }

    participant.microphoneEnabled = enabled;
    return this.toSnapshot(room);
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
    if (!sender || !receiver || sender.id === receiver.id) {
      return 'PEER_NOT_IN_ROOM';
    }

    if (
      (signalType === 'offer' && sender.role !== 'host') ||
      (signalType === 'answer' && (sender.role !== 'guest' || receiver.role !== 'host'))
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

  private createInviteCode(): string {
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
      inviteCode: `${room.inviteCode.slice(0, 4)}-${room.inviteCode.slice(4)}`,
      expiresAt: room.expiresAt,
      participants: Array.from(room.participants.values()),
      maxParticipants: MAX_PARTICIPANTS,
    };
  }
}

export function isRoomErrorCode(value: string): value is RoomErrorCode {
  return [
    'INVALID_CODE',
    'ROOM_EXPIRED',
    'ROOM_FULL',
    'ALREADY_IN_ROOM',
    'INVALID_NAME',
    'RATE_LIMITED',
    'SERVER_ERROR',
  ].includes(value);
}
