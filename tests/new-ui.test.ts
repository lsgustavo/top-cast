import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

describe('New UI Refactoring & Media Controls (NewUI.md)', () => {
  const roomPagePath = path.resolve('src/renderer/pages/RoomPage.tsx');
  const roomPageContent = fs.readFileSync(roomPagePath, 'utf8');
  const sliderComponentPath = path.resolve('src/renderer/components/ui/slider.tsx');
  const sliderComponentContent = fs.readFileSync(sliderComponentPath, 'utf8');

  it('provides a Shadcn UI Slider primitive using Radix Slider', () => {
    assert.ok(sliderComponentContent.includes('@radix-ui/react-slider'));
    assert.ok(sliderComponentContent.includes('export { Slider }'));
    assert.ok(sliderComponentContent.includes('SliderPrimitive.Track'));
    assert.ok(sliderComponentContent.includes('SliderPrimitive.Range'));
    assert.ok(sliderComponentContent.includes('SliderPrimitive.Thumb'));
  });

  it('renders volume control and slider strictly for viewers/guests, not for host', () => {
    // StreamVideo takes isHost prop
    assert.ok(roomPageContent.includes('function StreamVideo({ stream, isHost = false'));
    // Slider is conditionally rendered only for viewers (!isHost)
    assert.ok(roomPageContent.includes('{!isHost && ('));
    assert.ok(roomPageContent.includes('<Slider'));
    assert.ok(roomPageContent.includes('aria-label="Controle de volume da transmissão"'));
    // Mute shortcut 'm' applies only to viewers (!isHost)
    assert.ok(roomPageContent.includes('(e.key === \'m\' || e.key === \'M\') && !isHost'));
  });

  it('renders fullscreen button for all users (both host and guest)', () => {
    // Fullscreen button is outside the !isHost check so it is rendered for all users
    assert.ok(roomPageContent.includes('toggleFullscreen'));
    assert.ok(roomPageContent.includes('<Maximize'));
    assert.ok(roomPageContent.includes('<Minimize'));
    assert.ok(roomPageContent.includes('isFullscreen ? \'Sair da tela cheia\' : \'Tela cheia\''));
    // Keyboard shortcut 'f' is enabled for all users
    assert.ok(roomPageContent.includes("e.key === 'f' || e.key === 'F'"));
    // Double click toggles fullscreen
    assert.ok(roomPageContent.includes('onDoubleClick={() => void toggleFullscreen()}'));
  });

  it('implements Fullscreen API with requestFullscreen, exitFullscreen, and fallbacks', () => {
    assert.ok(roomPageContent.includes('requestFullscreen'));
    assert.ok(roomPageContent.includes('exitFullscreen'));
    assert.ok(roomPageContent.includes('webkitRequestFullscreen'));
    assert.ok(roomPageContent.includes('webkitExitFullscreen'));
    assert.ok(roomPageContent.includes('fullscreenchange'));
  });

  it('applies premium glass styling with overlay and backdrop-blur to sidebar, dialogs, and toasts', () => {
    // Sidebar glass styling
    assert.ok(roomPageContent.includes('border-b border-border/40 bg-slate-950/70 backdrop-blur-xl'));
    // Toast glass styling
    assert.ok(roomPageContent.includes('border-border/40 bg-slate-900/90 px-4 py-3 text-sm shadow-xl backdrop-blur-xl'));
    // Ambient background overlay
    assert.ok(roomPageContent.includes('bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.08),transparent_55%)]'));
  });

  it('preserves wave curves and animations in HomePage', () => {
    const homePagePath = path.resolve('src/renderer/pages/HomePage.tsx');
    const homePageContent = fs.readFileSync(homePagePath, 'utf8');
    assert.ok(homePageContent.includes('AnimatedWaveBackground'));
    assert.ok(homePageContent.includes('animate-wave-1'));
    assert.ok(homePageContent.includes('animate-wave-2'));
    assert.ok(homePageContent.includes('animate-wave-3'));
  });

  it('removes avatar dice randomizer from sidebar dropdown and only allows changing avatar on HomePage or Profile Settings', () => {
    assert.ok(roomPageContent.includes('role="listbox"'));
    assert.ok(!roomPageContent.includes('handleRandomizeAvatar'));
    assert.ok(!roomPageContent.includes('<Dice5'));
    // Footer profile card is a single clean button
    assert.ok(roomPageContent.includes('{/* Botão Card do Perfil */}'));
    assert.ok(!roomPageContent.includes('{/* Botão Card do Perfil com botão random direto */}'));
  });

  it('standardizes transmission control and system buttons to matching rounded-xl glass design', () => {
    // "Mudar tela" uses system button design
    assert.ok(roomPageContent.includes('Mudar tela'));
    assert.ok(roomPageContent.includes('h-9 gap-2 rounded-xl border border-border/40 bg-slate-900/60'));
    // "Parar compartilhamento" uses system destructive button design
    assert.ok(roomPageContent.includes('Parar compartilhamento'));
    assert.ok(roomPageContent.includes('h-9 gap-2 rounded-xl border border-red-500/20 bg-red-500/10'));
    // "Compartilhe sua tela" has elevated professional hero presentation
    assert.ok(roomPageContent.includes('Compartilhe sua tela'));
    assert.ok(roomPageContent.includes('Monitores & Janelas'));
    assert.ok(roomPageContent.includes('Áudio Integrado'));
    assert.ok(roomPageContent.includes('WebRTC P2P Direto'));
  });

  it('configures Electron fullscreen permissions, window event handlers, and viewport fallback', () => {
    const mainWindowPath = path.resolve('src/main/windows/create-main-window.ts');
    const mainWindowContent = fs.readFileSync(mainWindowPath, 'utf8');
    // Session permissions allow fullscreen
    assert.ok(mainWindowContent.includes("'fullscreen'"));
    assert.ok(mainWindowContent.includes("'automatic-fullscreen'"));
    assert.ok(mainWindowContent.includes('enter-html-full-screen'));
    assert.ok(mainWindowContent.includes('leave-html-full-screen'));

    // Preload exposes toggleFullScreen and isFullScreen
    const preloadPath = path.resolve('src/preload/preload.cts');
    const preloadContent = fs.readFileSync(preloadPath, 'utf8');
    assert.ok(preloadContent.includes('toggleFullScreen'));
    assert.ok(preloadContent.includes('isFullScreen'));

    // StreamVideo has viewport fallback and Escape key support
    assert.ok(roomPageContent.includes("fixed inset-0 z-[100] h-screen w-screen"));
    assert.ok(roomPageContent.includes("e.key === 'Escape' && isFullscreen"));
    assert.ok(roomPageContent.includes("topcast:request-fullscreen"));

    // ScreenCapture service preserves fullscreen permissions on defaultSession
    const screenCapturePath = path.resolve('src/main/services/screen-capture.ts');
    const screenCaptureContent = fs.readFileSync(screenCapturePath, 'utf8');
    assert.ok(screenCaptureContent.includes("'fullscreen'"));
    assert.ok(screenCaptureContent.includes("'automatic-fullscreen'"));
  });

  it('standardizes "Encerrar esta sala?" alert dialog with dialog layout and app button design', () => {
    // Uses standardized glass AlertDialogContent with header divider and ambient glow
    assert.ok(roomPageContent.includes('Encerrar esta sala?'));
    assert.ok(roomPageContent.includes('border-b border-border/40 px-6 py-5'));
    assert.ok(roomPageContent.includes('border-t border-border/40 bg-slate-950/40 px-6 py-4'));

    // Cancel button matches secondary system button
    assert.ok(roomPageContent.includes('Manter sala'));
    assert.ok(roomPageContent.includes('h-9 rounded-xl border border-border/40 bg-slate-900/60 px-4 text-xs font-medium text-slate-300'));

    // Action button matches destructive system action button
    assert.ok(roomPageContent.includes('h-9 gap-2 rounded-xl border border-red-500/30 bg-red-600 px-4 text-xs font-medium text-white'));
  });

  it('captures and encodes transmissions in Full HD (1920x1080) at 60 FPS without stretching in fullscreen', () => {
    const screenCaptureHookPath = path.resolve('src/renderer/features/streaming/use-screen-capture.ts');
    const screenCaptureHookContent = fs.readFileSync(screenCaptureHookPath, 'utf8');
    assert.ok(screenCaptureHookContent.includes('frameRate: { ideal: 60, max: 60 }'));
    assert.ok(screenCaptureHookContent.includes('width: { ideal: 1920, max: 1920 }'));
    assert.ok(screenCaptureHookContent.includes('height: { ideal: 1080, max: 1080 }'));
    assert.ok(screenCaptureHookContent.includes('width: { max: 1920 }'));
    assert.ok(screenCaptureHookContent.includes('height: { max: 1080 }'));

    const webrtcHookPath = path.resolve('src/renderer/features/streaming/use-room-webrtc.ts');
    const webrtcHookContent = fs.readFileSync(webrtcHookPath, 'utf8');
    assert.ok(webrtcHookContent.includes("degradationPreference = 'maintain-resolution'"));
    assert.ok(webrtcHookContent.includes('FULL_HD_VIDEO_MAX_BITRATE = 8_000_000'));
    assert.ok(webrtcHookContent.includes('FULL_HD_VIDEO_MAX_FRAMERATE = 60'));
    assert.ok(webrtcHookContent.includes('scaleResolutionDownBy = 1'));

    assert.ok(roomPageContent.includes('max-h-full max-w-full h-auto w-auto m-auto bg-black object-contain'));
  });

  it('preserves invite code room entry ("Entrar com código") on HomePage', () => {
    const homePagePath = path.resolve('src/renderer/pages/HomePage.tsx');
    const homePageContent = fs.readFileSync(homePagePath, 'utf8');
    assert.ok(homePageContent.includes('Entrar com código'));
    assert.ok(homePageContent.includes('Conecte-se a uma sala existente com código de 6 dígitos'));
  });

  it('provides a Perfil tab in SettingsDialog and uses AvatarPickerDialog with edit icon and options modal on HomePage and Profile Settings', () => {
    const settingsDialogPath = path.resolve('src/renderer/components/settings-dialog.tsx');
    const settingsDialogContent = fs.readFileSync(settingsDialogPath, 'utf8');
    assert.ok(settingsDialogContent.includes("activeTab === 'themes'"));
    assert.ok(settingsDialogContent.includes("activeTab === 'user'"));
    assert.ok(settingsDialogContent.includes('<span>Perfil</span>'));
    assert.ok(settingsDialogContent.includes('Configurações de Perfil'));
    assert.ok(settingsDialogContent.includes('<AvatarPickerDialog'));
    assert.ok(settingsDialogContent.includes('Nome na Sala'));
    assert.ok(settingsDialogContent.includes('Seu Status'));

    const homePagePath = path.resolve('src/renderer/pages/HomePage.tsx');
    const homePageContent = fs.readFileSync(homePagePath, 'utf8');
    assert.ok(homePageContent.includes('<AvatarPickerDialog'));
    assert.ok(!homePageContent.includes('<Dice5'));

    const avatarPickerPath = path.resolve('src/renderer/components/avatar-picker-dialog.tsx');
    const avatarPickerContent = fs.readFileSync(avatarPickerPath, 'utf8');
    assert.ok(avatarPickerContent.includes('<Pencil'));
    assert.ok(avatarPickerContent.includes('Escolher Foto de Perfil'));
    assert.ok(avatarPickerContent.includes('Opções de foto de perfil'));
    assert.ok(avatarPickerContent.includes('handleRandomizeOptions'));
    assert.ok(avatarPickerContent.includes('<Dice5'));
    assert.ok(!avatarPickerContent.includes('scale-'));

    assert.ok(roomPageContent.includes('defaultTab="user"'));
    assert.ok(roomPageContent.includes('triggerLabel="Configurações de perfil"'));
    assert.ok(roomPageContent.includes('tooltipText="Configurações de perfil"'));
    assert.ok(!roomPageContent.includes('{/* Botão User Settings na Sidebar */}'));
  });
});
