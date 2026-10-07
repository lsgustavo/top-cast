export const SIGNALING_PROTOCOL_VERSION = 1;

export interface ServerReadyMessage {
  protocolVersion: number;
}

export interface ServerPingResponse {
  serverTime: number;
}

export interface RoomParticipant {
  id: string;
  displayName: string;
  role: 'host' | 'guest';
  joinedAt: number;
}

export interface RoomSnapshot {
  id: string;
  inviteCode: string;
  expiresAt: number;
  participants: RoomParticipant[];
  maxParticipants: number;
}

export type RoomErrorCode =
  | 'INVALID_CODE'
  | 'ROOM_EXPIRED'
  | 'ROOM_FULL'
  | 'ALREADY_IN_ROOM'
  | 'INVALID_NAME'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR';

export type RoomOperationResult =
  | { ok: true; room: RoomSnapshot }
  | { ok: false; error: RoomErrorCode };

export interface CreateRoomPayload {
  displayName: string;
}

export interface JoinRoomPayload {
  inviteCode: string;
  displayName: string;
}

export interface LeaveRoomResponse {
  ok: true;
}

export interface RoomClosedMessage {
  reason: 'host-left' | 'expired';
}

export interface ServerToClientEvents {
  'server:ready': (message: ServerReadyMessage) => void;
  'room:updated': (room: RoomSnapshot) => void;
  'room:closed': (message: RoomClosedMessage) => void;
}

export interface ClientToServerEvents {
  'server:ping': (acknowledge: (response: ServerPingResponse) => void) => void;
  'room:create': (
    payload: CreateRoomPayload,
    acknowledge: (result: RoomOperationResult) => void,
  ) => void;
  'room:join': (
    payload: JoinRoomPayload,
    acknowledge: (result: RoomOperationResult) => void,
  ) => void;
  'room:leave': (acknowledge: (result: LeaveRoomResponse) => void) => void;
}

export interface InterServerEvents {}

export interface SignalingSocketData {
  roomId?: string;
  participantId?: string;
}
