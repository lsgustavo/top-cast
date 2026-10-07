import { app, BrowserWindow } from 'electron';
import { unregisterNativeAppFeatures } from './services/native-app-features.js';
import { createMainWindow } from './windows/create-main-window.js';

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', unregisterNativeAppFeatures);
