export const SIGNALING_PROTOCOL_VERSION = 1;

export interface ServerReadyMessage {
  protocolVersion: number;
}

export interface ServerPingResponse {
  serverTime: number;
}

export interface ServerToClientEvents {
  'server:ready': (message: ServerReadyMessage) => void;
}

export interface ClientToServerEvents {
  'server:ping': (acknowledge: (response: ServerPingResponse) => void) => void;
}

export interface InterServerEvents {}

export interface SignalingSocketData {}
