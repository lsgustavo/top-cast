export const SIGNALING_PROTOCOL_VERSION = 1;

export type SignalingStatus = 'connected' | 'reconnecting' | 'restoring';

export interface ServerReadyMessage {
  protocolVersion: number;
}

export interface ServerPingResponse {
  serverTime: number;
}

export interface IceServerConfiguration {
  urls: string | string[];
  username?: string;
  credential?: string;
  credentialType?: 'password';
}

export type IceServersResult =
  | { ok: true; iceServers: IceServerConfiguration[] }
  | { ok: false; error: 'NOT_IN_ROOM' | 'RATE_LIMITED' | 'SERVER_ERROR' };

export interface RoomParticipant {
  id: string;
  displayName: string;
  role: 'host' | 'guest';
  joinedAt: number;
  presence: 'available' | 'away' | 'busy';
  avatarSeed?: string;
}

export interface ActiveRoomSummary {
  id: string;
  hostDisplayName: string;
  hostAvatarSeed?: string;
  participantCount: number;
  maxParticipants: number;
  expiresAt: number;
}

export interface RoomAvailability {
  active: boolean;
  room?: ActiveRoomSummary;
}

export interface RoomSnapshot {
  id: string;
  inviteCode: string;
  expiresAt: number;
  participants: RoomParticipant[];
  maxParticipants: number;
  presenterId?: string;
}

export type RoomErrorCode =
  | 'ROOM_EXISTS'
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
  avatarSeed?: string;
}

export interface JoinRoomPayload {
  inviteCode?: string;
  displayName: string;
  avatarSeed?: string;
}

export interface AvatarPayload {
  avatarSeed: string;
}

export type AvatarResult =
  | { ok: true }
  | { ok: false; error: 'NOT_IN_ROOM' | 'INVALID_SEED' };

export interface DisplayNamePayload {
  displayName: string;
}

export type DisplayNameResult =
  | { ok: true }
  | { ok: false; error: 'NOT_IN_ROOM' | 'INVALID_NAME' };

export interface LeaveRoomResponse {
  ok: true;
}

export interface RoomClosedMessage {
  reason: 'host-left' | 'expired';
}

export interface ParticipantKickedMessage {
  reason: 'removed-by-host';
}

export type KickParticipantResult =
  | { ok: true }
  | { ok: false; error: 'NOT_HOST' | 'NOT_IN_ROOM' | 'INVALID_PARTICIPANT' };

export type PresenceStateResult =
  | { ok: true }
  | { ok: false; error: 'NOT_IN_ROOM' | 'INVALID_STATE' };

export interface SetPresenterPayload {
  participantId: string;
}

export type SetPresenterResult =
  | { ok: true; room: RoomSnapshot }
  | { ok: false; error: 'NOT_IN_ROOM' | 'NOT_ALLOWED' | 'INVALID_PARTICIPANT' };

export interface WebRtcDescriptionPayload {
  toParticipantId: string;
  description: {
    type: 'offer' | 'answer';
    sdp: string;
  };
}

export interface WebRtcIceCandidatePayload {
  toParticipantId: string;
  candidate: {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    usernameFragment?: string | null;
  };
}

export interface WebRtcDescriptionMessage {
  fromParticipantId: string;
  description: WebRtcDescriptionPayload['description'];
}

export interface WebRtcIceCandidateMessage {
  fromParticipantId: string;
  candidate: WebRtcIceCandidatePayload['candidate'];
}

export type WebRtcSignalError = 'NOT_IN_ROOM' | 'PEER_NOT_IN_ROOM' | 'INVALID_SIGNAL' | 'NOT_ALLOWED';
export type WebRtcSignalResult = { ok: true } | { ok: false; error: WebRtcSignalError };

export interface SoundboardPlayPayload {
  clipId: string;
  volume?: number;
}

export interface SoundboardStopPayload {
  clipId: string;
}

export interface SoundboardPlayMessage {
  fromParticipantId: string;
  clipId: string;
  volume?: number;
}

export interface SoundboardStopMessage {
  fromParticipantId: string;
  clipId: string;
}

export interface StreamPausedPayload {
  paused: boolean;
}

export interface StreamPausedMessage {
  fromParticipantId: string;
  paused: boolean;
}

export interface ServerToClientEvents {
  'server:ready': (message: ServerReadyMessage) => void;
  'room:availability': (availability: RoomAvailability) => void;
  'room:updated': (room: RoomSnapshot) => void;
  'room:closed': (message: RoomClosedMessage) => void;
  'room:kicked': (message: ParticipantKickedMessage) => void;
  'webrtc:description': (message: WebRtcDescriptionMessage) => void;
  'webrtc:ice-candidate': (message: WebRtcIceCandidateMessage) => void;
  'room:soundboard-play': (message: SoundboardPlayMessage) => void;
  'room:soundboard-stop': (message: SoundboardStopMessage) => void;
  'room:stream-paused': (message: StreamPausedMessage) => void;
}

export interface ClientToServerEvents {
  'server:ping': (acknowledge: (response: ServerPingResponse) => void) => void;
  'webrtc:ice-servers': (acknowledge: (result: IceServersResult) => void) => void;
  'room:create': (
    payload: CreateRoomPayload,
    acknowledge: (result: RoomOperationResult) => void,
  ) => void;
  'room:join': (
    payload: JoinRoomPayload,
    acknowledge: (result: RoomOperationResult) => void,
  ) => void;
  'room:leave': (acknowledge: (result: LeaveRoomResponse) => void) => void;
  'room:kick': (
    payload: { participantId: string },
    acknowledge: (result: KickParticipantResult) => void,
  ) => void;
  'room:presence': (
    payload: { presence: RoomParticipant['presence'] },
    acknowledge: (result: PresenceStateResult) => void,
  ) => void;
  'room:avatar': (
    payload: AvatarPayload,
    acknowledge: (result: AvatarResult) => void,
  ) => void;
  'room:name': (
    payload: DisplayNamePayload,
    acknowledge: (result: DisplayNameResult) => void,
  ) => void;
  'room:presenter': (
    payload: SetPresenterPayload,
    acknowledge: (result: SetPresenterResult) => void,
  ) => void;
  'webrtc:description': (
    payload: WebRtcDescriptionPayload,
    acknowledge: (result: WebRtcSignalResult) => void,
  ) => void;
  'webrtc:ice-candidate': (
    payload: WebRtcIceCandidatePayload,
    acknowledge: (result: WebRtcSignalResult) => void,
  ) => void;
  'room:soundboard-play': (payload: SoundboardPlayPayload) => void;
  'room:soundboard-stop': (payload: SoundboardStopPayload) => void;
  'room:stream-paused': (payload: StreamPausedPayload) => void;
}

export interface InterServerEvents {}

export interface SignalingSocketData {
  roomId?: string;
  participantId?: string;
}
