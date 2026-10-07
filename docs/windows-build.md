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

The installed app lets each user configure the signaling URL from the home
screen; the value is saved locally. `VITE_SIGNALING_URL` still sets the default
for a build. The installer includes the compiled signaling server but does not
start or deploy it. The Windows installer is not code-signed yet.

## Local network smoke test

For a development-only LAN test, run the signaling server on the host computer
and bind it to its network interfaces:

```powershell
$env:SIGNALING_HOST = "0.0.0.0"
npm run dev:server
```

If Windows Firewall asks, allow TCP port `3001` on the private network. On each
TopCast client, set the home-screen signaling URL to
`http://<host-computer-ip>:3001`. The signaling server accepts Electron's
opaque `file://` origin (`null`) and the local Vite origins by default;
additional web origins can be configured with the comma-separated
`SIGNALING_ALLOWED_ORIGINS` environment variable.

This smoke-test setup is plain HTTP and is not a production deployment. A
production service should use HTTPS/WSS, a stable reachable address, and
appropriate network/firewall rules. The installer has not been tested on a
separate physical computer in this environment.
