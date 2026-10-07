export interface AppInfo {
  name: string;
  version: string;
  electron: string;
  chrome: string;
}

export interface TopCastApi {
  getAppInfo: () => AppInfo;
}
