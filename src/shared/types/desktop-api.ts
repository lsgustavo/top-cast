export interface AppInfo {
  name: string;
  version: string;
  electron: string;
  chrome: string;
}

export interface CaptureSource {
  id: string;
  name: string;
  kind: 'screen' | 'window';
  displayId: string;
  thumbnailDataUrl: string;
}

export type CaptureSourceSelection =
  | { ok: true }
  | { ok: false; error: 'SOURCE_NOT_AVAILABLE' | 'UNAUTHORIZED' };

export interface ScreenCaptureApi {
  supportsSystemAudio: boolean;
  listSources: () => Promise<CaptureSource[]>;
  selectSource: (sourceId: string | null, includeSystemAudio: boolean) => Promise<CaptureSourceSelection>;
}

export interface TopCastApi {
  copyToClipboard: (text: string) => Promise<boolean>
  getAppInfo: () => AppInfo;
  notifyParticipantJoined: (displayName: string) => Promise<boolean>;
  onLeaveRoomShortcut: (callback: () => void) => () => void;
  screenCapture: ScreenCaptureApi;
}