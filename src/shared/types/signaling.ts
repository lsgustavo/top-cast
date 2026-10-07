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
  microphoneEnabled: boolean;
  presence: 'available' | 'away' | 'busy';
}

export interface RoomAvailability {
  active: boolean;
}

export interface RoomSnapshot {
  id: string;
  inviteCode: string;
  expiresAt: number;
  participants: RoomParticipant[];
  maxParticipants: number;
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
}

export interface JoinRoomPayload {
  inviteCode: string;
  displayName: string;
}

export interface LeaveRoomResponse {
  ok: true;
}

export type MicrophoneStateResult =
  | { ok: true }
  | { ok: false; error: 'NOT_IN_ROOM' | 'INVALID_STATE' };

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

export interface ServerToClientEvents {
  'server:ready': (message: ServerReadyMessage) => void;
  'room:availability': (availability: RoomAvailability) => void;
  'room:updated': (room: RoomSnapshot) => void;
  'room:closed': (message: RoomClosedMessage) => void;
  'room:kicked': (message: ParticipantKickedMessage) => void;
  'webrtc:description': (message: WebRtcDescriptionMessage) => void;
  'webrtc:ice-candidate': (message: WebRtcIceCandidateMessage) => void;
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
  'room:microphone': (
    payload: { enabled: boolean },
    acknowledge: (result: MicrophoneStateResult) => void,
  ) => void;
  'webrtc:description': (
    payload: WebRtcDescriptionPayload,
    acknowledge: (result: WebRtcSignalResult) => void,
  ) => void;
  'webrtc:ice-candidate': (
    payload: WebRtcIceCandidatePayload,
    acknowledge: (result: WebRtcSignalResult) => void,
  ) => void;
}

export interface InterServerEvents {}

export interface SignalingSocketData {
  roomId?: string;
  participantId?: string;
}
