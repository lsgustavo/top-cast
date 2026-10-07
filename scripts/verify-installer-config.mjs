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
const isLoopbackHost = hostname === 'localhost' ||
  hostname.endsWith('.localhost') ||
  hostname === '::1' ||
  hostname === '0.0.0.0' ||
  hostname === '::' ||
  isIpv4Loopback;

if (
  signalingUrl.protocol !== 'https:' ||
  !signalingUrl.hostname ||
  isLoopbackHost ||
  signalingUrl.username ||
  signalingUrl.password ||
  signalingUrl.pathname !== '/' ||
  signalingUrl.search ||
  signalingUrl.hash
) {
  throw new Error('VITE_SIGNALING_URL must be a public HTTPS origin without credentials, path, query, or fragment.');
}

console.log(`Installer signaling origin verified: ${signalingUrl.origin}`);
