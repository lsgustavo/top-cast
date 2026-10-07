import {
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Notification,
} from 'electron';

const NOTIFY_PARTICIPANT_CHANNEL = 'app:notify-participant-joined';
const LEAVE_ROOM_SHORTCUT_CHANNEL = 'app:leave-room-shortcut';
const LEAVE_ROOM_SHORTCUT = 'CommandOrControl+Shift+L';
const MAX_DISPLAY_NAME_LENGTH = 32;

let activeWindow: BrowserWindow | null = null;
let handlersRegistered = false;
let shortcutRegistered = false;

export function configureNativeAppFeatures(window: BrowserWindow): void {
  activeWindow = window;
  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;

  ipcMain.handle(NOTIFY_PARTICIPANT_CHANNEL, (event, rawDisplayName: unknown): boolean => {
    if (!isAuthorizedSender(event.sender, event.senderFrame)) {
      throw new Error('Unauthorized renderer requested a participant notification');
    }
    if (typeof rawDisplayName !== 'string' || rawDisplayName.trim().length === 0 ||
      rawDisplayName.length > MAX_DISPLAY_NAME_LENGTH) {
      throw new Error('Invalid participant display name for system notification');
    }
    if (!activeWindow || !activeWindow.isMinimized() || !Notification.isSupported()) {
      return false;
    }

    new Notification({
      title: 'Novo participante na sala',
      body: `${rawDisplayName} entrou na transmissão.`,
    }).show();
    return true;
  });

  shortcutRegistered = globalShortcut.register(LEAVE_ROOM_SHORTCUT, () => {
    if (activeWindow && !activeWindow.isDestroyed()) {
      activeWindow.webContents.send(LEAVE_ROOM_SHORTCUT_CHANNEL);
    }
  });
  if (!shortcutRegistered) {
    console.warn(`Could not register global shortcut ${LEAVE_ROOM_SHORTCUT}`);
  }

  window.on('closed', () => {
    if (activeWindow === window) {
      activeWindow = null;
    }
  });
}

export function unregisterNativeAppFeatures(): void {
  if (shortcutRegistered) {
    globalShortcut.unregister(LEAVE_ROOM_SHORTCUT);
    shortcutRegistered = false;
  }
}

function isAuthorizedSender(
  sender: Electron.WebContents,
  senderFrame: Electron.WebFrameMain | null,
): boolean {
  return activeWindow !== null &&
    !activeWindow.isDestroyed() &&
    sender.id === activeWindow.webContents.id &&
    senderFrame === activeWindow.webContents.mainFrame;
}
