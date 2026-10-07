# Windows production build

Run the build on Windows from the project root:

```powershell
npm run build:windows
```

The command compiles the Electron main/preload code, signaling server, and
renderer, then verifies that the expected runtime files and renderer assets
exist. Outputs are written to `dist/`, `dist-electron/`, and `dist-server/`.

This step verifies production build artifacts; it does not produce an installer.
Installer generation is a separate step and writes its outputs under `release/`.
