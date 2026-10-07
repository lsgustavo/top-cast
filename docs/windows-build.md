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

The installer is written under `release/`. An installer build now requires a
public HTTPS signaling origin; it intentionally rejects the development
localhost default so a distributed app is not silently built against a server
on the user's own computer. Set `VITE_SIGNALING_URL` before building, for
example:

```powershell
$env:VITE_SIGNALING_URL = "https://signaling.example.com"
npm run build:installer
```

Replace the example host with the actual deployed service before distributing
the installer.

For a temporary LAN-only test installer, use the signaling host's private
network IPv4 address and explicitly opt into HTTP:

```powershell
$env:VITE_SIGNALING_URL = "http://192.168.3.3:3001"
$env:ALLOW_INSECURE_TEST_INSTALLER = "1"
npm run build:installer
Remove-Item Env:ALLOW_INSECURE_TEST_INSTALLER
```

This installer is unencrypted and should only be used on a trusted private
network. The signaling server must be running on that host with
`SIGNALING_HOST=0.0.0.0`, and Windows Firewall must allow its port on the
private profile. It does not include or start that server. Do not distribute
this test installer publicly; use a public HTTPS origin for release builds.

The installed app lets each user configure the signaling URL from the home
screen; the value is saved locally. `VITE_SIGNALING_URL` still sets the default
for a build. The installer includes the compiled signaling server but does not
start or deploy it. The Windows installer is not code-signed yet.

For Internet connectivity, deploy a Coturn-compatible TURN service and provide
the signaling server with `TURN_URLS` (comma-separated `turn:`/`turns:` URLs)
and `TURN_SHARED_SECRET` (at least 32 characters). The TURN service and
signaling server must use the same REST shared secret. Keep that secret only in
the server environment; after a participant joins a room, TopCast requests
participant-scoped credentials that expire after 24 hours and applies the
returned ICE configuration to each WebRTC peer connection. Without these
settings clients receive STUN only, which does not guarantee connectivity
through restrictive NATs/firewalls.

Example server environment (use a secret manager in production):

```powershell
$env:TURN_URLS = "turn:turn.example.com:3478,turns:turn.example.com:5349"
$env:TURN_SHARED_SECRET = "<server-side secret>"
$env:SIGNALING_HOST = "0.0.0.0"
npm run dev:server
```

Do not put `TURN_SHARED_SECRET` in a `VITE_*` variable, renderer configuration,
installer, or source control. Configure Coturn's `use-auth-secret` and
`static-auth-secret` with the same secret, and open the relay port range as well
as the TURN listener ports. Use HTTPS/TLS in production.

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

## Signaling integration smoke test

With the signaling server running, execute:

```powershell
npm run test:signaling-smoke
```

The script connects two real Socket.IO clients and checks room creation/join,
denial of ICE credentials outside a room, STUN/TURN configuration, WebRTC offer
authorization, and room closure. To target another server, set
`$env:SIGNALING_URL` before running the script. This validates the signaling
service, not media connectivity through a public TURN relay; that still needs
the separate two-computer, different-network test.
