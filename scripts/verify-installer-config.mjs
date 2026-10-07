const rawSignalingUrl = process.env.VITE_SIGNALING_URL?.trim();

if (!rawSignalingUrl) {
  throw new Error(
    'Set VITE_SIGNALING_URL to the public HTTPS signaling origin before building the Windows installer.',
  );
}

let signalingUrl;
try {
  signalingUrl = new URL(rawSignalingUrl);
} catch {
  throw new Error('VITE_SIGNALING_URL must be a valid HTTPS origin, such as https://signal.example.com.');
}

const hostname = signalingUrl.hostname.replace(/^\[|\]$/g, '').toLowerCase();
const ipv4Octets = hostname.split('.').map(Number);
const isIpv4Loopback = ipv4Octets.length === 4 && ipv4Octets[0] === 127;
const isPrivateIpv4 = ipv4Octets.length === 4 &&
  ipv4Octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255) &&
  (
    ipv4Octets[0] === 10 ||
    (ipv4Octets[0] === 172 && ipv4Octets[1] >= 16 && ipv4Octets[1] <= 31) ||
    (ipv4Octets[0] === 192 && ipv4Octets[1] === 168)
  );
const isLoopbackHost = hostname === 'localhost' ||
  hostname.endsWith('.localhost') ||
  hostname === '::1' ||
  hostname === '0.0.0.0' ||
  hostname === '::' ||
  isIpv4Loopback;
const isLocalHost = isLoopbackHost || hostname.endsWith('.local') || isPrivateIpv4;
const commonInvalidParts = !signalingUrl.hostname ||
  signalingUrl.username ||
  signalingUrl.password ||
  signalingUrl.pathname !== '/' ||
  signalingUrl.search ||
  signalingUrl.hash;

if (commonInvalidParts) {
  throw new Error('VITE_SIGNALING_URL must be an origin without credentials, path, query, or fragment.');
}

if (signalingUrl.protocol === 'https:' && !isLoopbackHost) {
  console.log(`Installer signaling origin verified: ${signalingUrl.origin}`);
} else if (
  signalingUrl.protocol === 'http:' &&
  process.env.ALLOW_INSECURE_TEST_INSTALLER === '1' &&
  isLocalHost
) {
  console.warn(
    `WARNING: building a LAN-only, insecure test installer for ${signalingUrl.origin}. Do not distribute it publicly.`,
  );
} else {
  throw new Error(
    'Use a public HTTPS origin. For a private-network HTTP test build only, set ALLOW_INSECURE_TEST_INSTALLER=1 and use localhost, a .local host, or a private IPv4 address.',
  );
}

if (signalingUrl.protocol === 'https:' && isLoopbackHost) {
  throw new Error('VITE_SIGNALING_URL must be a public HTTPS origin without credentials, path, query, or fragment.');
}
