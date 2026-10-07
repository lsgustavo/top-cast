# Windows production build

Run the build on Windows from the project root:

```powershell
npm run build:windows
```

The command compiles the Electron main/preload code, signaling server, and
renderer, then verifies that the expected runtime files and renderer assets
exist. Outputs are written to `dist/`, `dist-electron/`, and `dist-server/`.

This step verifies production build artifacts; it does not produce an installer.
Generate the Windows x64 NSIS setup executable with:

```powershell
npm run build:installer
```

The installer is written under `release/`. Set `VITE_SIGNALING_URL` before
building when the app should connect to a deployed signaling server, for
example:

```powershell
$env:VITE_SIGNALING_URL = "https://signaling.example.com"
npm run build:installer
```

The installer packages the desktop client and compiled signaling server code,
but it does not deploy or start a public signaling server. The current fallback
URL is `http://127.0.0.1:3001`, which is only useful when a signaling server is
running on the same computer. Multi-computer use requires a reachable server
configured at build time. The Windows installer is not code-signed yet.
