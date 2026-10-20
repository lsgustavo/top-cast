import { useEffect, useRef, useState } from 'react';

export interface StreamRealtimeStats {
  width: number | null;
  height: number | null;
  fps: number | null;
  bitrateMbps: number | null;
  codec: string | null;
  rttMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number | null;
  qualityLimitationReason: string | null;
}

const INITIAL_STATS: StreamRealtimeStats = {
  width: null,
  height: null,
  fps: null,
  bitrateMbps: null,
  codec: null,
  rttMs: null,
  jitterMs: null,
  packetLossPercent: null,
  qualityLimitationReason: null,
};

export function formatResolutionBadge(width: number | null, height: number | null): string {
  if (!width || !height) return '—';
  const maxDim = Math.max(width, height);
  const minDim = Math.min(width, height);
  if (minDim >= 1440 || maxDim >= 2560) return 'QHD';
  if (minDim >= 1080 || maxDim >= 1920) return 'Full HD';
  if (minDim >= 720 || maxDim >= 1280) return 'HD';
  return 'SD';
}

interface ByteCounterSnapshot {
  timestamp: number;
  bytes: number;
  packetsLost: number;
  packetsTotal: number;
}

interface UseWebRtcStatsOptions {
  enabled: boolean;
  isHost: boolean;
  stream: MediaStream | null;
  videoElement: HTMLVideoElement | null;
  getPeerConnections?: () => Map<string, RTCPeerConnection>;
}

export function useWebRtcStats({
  enabled,
  isHost,
  stream,
  videoElement,
  getPeerConnections,
}: UseWebRtcStatsOptions): StreamRealtimeStats {
  const [stats, setStats] = useState<StreamRealtimeStats>(INITIAL_STATS);
  const previousCountersRef = useRef<ByteCounterSnapshot | null>(null);

  useEffect(() => {
    if (!enabled) {
      previousCountersRef.current = null;
      return;
    }

    let cancelled = false;

    const collectStats = async () => {
      const videoTrack = stream?.getVideoTracks()[0] ?? null;
      const trackSettings =
        videoTrack && typeof videoTrack.getSettings === 'function'
          ? videoTrack.getSettings()
          : undefined;

      let width: number | null =
        (videoElement && videoElement.videoWidth > 0 ? videoElement.videoWidth : null) ??
        (typeof trackSettings?.width === 'number' ? trackSettings.width : null);
      let height: number | null =
        (videoElement && videoElement.videoHeight > 0 ? videoElement.videoHeight : null) ??
        (typeof trackSettings?.height === 'number' ? trackSettings.height : null);
      let fps: number | null =
        typeof trackSettings?.frameRate === 'number'
          ? Math.round(trackSettings.frameRate)
          : null;
      let bitrateMbps: number | null = null;
      let codec: string | null = null;
      let rttMs: number | null = null;
      let jitterMs: number | null = null;
      let packetLossPercent: number | null = null;
      let qualityLimitationReason: string | null = null;

      const peerConnections = getPeerConnections ? Array.from(getPeerConnections().values()) : [];

      if (peerConnections.length > 0) {
        let totalBytes = 0;
        let hasByteReport = false;
        let totalPacketsLost = 0;
        let totalPackets = 0;

        for (const pc of peerConnections) {
          if (typeof pc.getStats !== 'function') continue;
          try {
            const report = await pc.getStats();
            const codecsById = new Map<string, string>();

            report.forEach((item: Record<string, unknown>) => {
              if (item.type === 'codec' && typeof item.id === 'string' && typeof item.mimeType === 'string') {
                const rawMime = item.mimeType;
                const shortCodec = rawMime.includes('/') ? rawMime.split('/')[1]?.toUpperCase() ?? rawMime : rawMime;
                codecsById.set(item.id, shortCodec);
              }
            });

            report.forEach((item: Record<string, unknown>) => {
              const kind = item.kind ?? item.mediaType;
              if (isHost && item.type === 'outbound-rtp' && kind === 'video') {
                if (typeof item.frameWidth === 'number' && item.frameWidth > 0) {
                  width = item.frameWidth;
                }
                if (typeof item.frameHeight === 'number' && item.frameHeight > 0) {
                  height = item.frameHeight;
                }
                if (typeof item.framesPerSecond === 'number') {
                  fps = Math.round(item.framesPerSecond);
                }
                if (typeof item.bytesSent === 'number') {
                  totalBytes += item.bytesSent;
                  hasByteReport = true;
                }
                if (typeof item.codecId === 'string' && codecsById.has(item.codecId)) {
                  codec = codecsById.get(item.codecId) ?? codec;
                }
                if (typeof item.qualityLimitationReason === 'string') {
                  qualityLimitationReason = item.qualityLimitationReason;
                }
              } else if (!isHost && item.type === 'inbound-rtp' && kind === 'video') {
                if (typeof item.frameWidth === 'number' && item.frameWidth > 0) {
                  width = item.frameWidth;
                }
                if (typeof item.frameHeight === 'number' && item.frameHeight > 0) {
                  height = item.frameHeight;
                }
                if (typeof item.framesPerSecond === 'number') {
                  fps = Math.round(item.framesPerSecond);
                }
                if (typeof item.bytesReceived === 'number') {
                  totalBytes += item.bytesReceived;
                  hasByteReport = true;
                }
                if (typeof item.packetsLost === 'number' && typeof item.packetsReceived === 'number') {
                  totalPacketsLost += Math.max(0, item.packetsLost);
                  totalPackets += Math.max(0, item.packetsLost) + Math.max(0, item.packetsReceived);
                }
                if (typeof item.jitter === 'number') {
                  jitterMs = Math.round(item.jitter * 1000);
                }
                if (typeof item.codecId === 'string' && codecsById.has(item.codecId)) {
                  codec = codecsById.get(item.codecId) ?? codec;
                }
              } else if (item.type === 'candidate-pair' && item.state === 'succeeded') {
                if (typeof item.currentRoundTripTime === 'number') {
                  rttMs = Math.round(item.currentRoundTripTime * 1000);
                }
              }
            });
          } catch {
            // ignore stats error on closed connection
          }
        }

        const now = performance.now();
        if (hasByteReport) {
          const prev = previousCountersRef.current;
          if (prev && now > prev.timestamp && totalBytes >= prev.bytes) {
            const elapsedSec = (now - prev.timestamp) / 1000;
            const bitsPerSecond = ((totalBytes - prev.bytes) * 8) / elapsedSec;
            bitrateMbps = Number((bitsPerSecond / 1_000_000).toFixed(2));

            if (!isHost && totalPackets > prev.packetsTotal) {
              const deltaLost = Math.max(0, totalPacketsLost - prev.packetsLost);
              const deltaTotal = totalPackets - prev.packetsTotal;
              packetLossPercent = Number(((deltaLost / deltaTotal) * 100).toFixed(1));
            }
          }
          previousCountersRef.current = {
            timestamp: now,
            bytes: totalBytes,
            packetsLost: totalPacketsLost,
            packetsTotal: totalPackets,
          };
        }
      }

      if (!cancelled) {
        setStats({
          width,
          height,
          fps,
          bitrateMbps,
          codec,
          rttMs,
          jitterMs,
          packetLossPercent,
          qualityLimitationReason,
        });
      }
    };

    void collectStats();
    const timer = window.setInterval(() => {
      void collectStats();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, isHost, stream, videoElement, getPeerConnections]);

  return stats;
}

