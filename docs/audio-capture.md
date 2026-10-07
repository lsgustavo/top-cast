# Audio capture behavior and limitations

## Current behavior

TopCast uses Electron's display-media handler for optional Windows system-audio
loopback. This is the audio rendered by the Windows output device, not audio
isolated to the selected window. It can include browsers, games, music players,
and communication apps.

System audio is off unless the host explicitly enables it in the share dialog.
The dialog warns that communication-app audio is included. TopCast does not
request microphone access or capture/transmit microphone audio.

When a call is in progress, leave system audio disabled unless retransmitting
the call is intentional. Selecting a window does not make the system-audio
track window-specific.

## Why communication audio is not filtered

Electron's `setDisplayMediaRequestHandler` supports Windows loopback audio, but
that source captures system output. The standard Electron capture path does not
provide a list of processes to exclude. Muting the local output is not equivalent
to removing an application from the captured stream.

Windows provides a lower-level WASAPI process-loopback activation on Windows 10
build 20348 and later. It can include or exclude the render streams of one
process and its child-process tree. Using it in TopCast would require a native
Windows component (for example, a C++/Rust helper or addon) to:

- identify and track the process trees associated with communication apps;
- capture PCM through the process-loopback API and handle process exits,
  restarts, and child processes;
- deliver the resulting audio stream to Chromium/WebRTC and synchronize it with
  screen video.

The Windows API's process-loopback activation takes one target process tree.
Reliably excluding multiple unrelated communication apps therefore needs
additional process management and audio-mixing design; it is not a safe
one-line Electron setting. Process names alone are also insufficient to
identify every call, browser tab, or custom application.

Until that native path exists and is tested, TopCast does not claim to remove
communication-app audio. Keeping system audio opt-in is the safe supported
behavior.

## References

- [Electron desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer)
- [Electron session: setDisplayMediaRequestHandler](https://www.electronjs.org/docs/latest/api/session)
- [Microsoft: Loopback Recording](https://learn.microsoft.com/en-us/windows/win32/coreaudio/loopback-recording)
- [Microsoft: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS](https://learn.microsoft.com/en-us/windows/win32/api/audioclientactivationparams/ns-audioclientactivationparams-audioclient_process_loopback_params)
- [Microsoft: Application loopback audio capture sample](https://learn.microsoft.com/en-us/samples/microsoft/windows-classic-samples/applicationloopbackaudio-sample/)
