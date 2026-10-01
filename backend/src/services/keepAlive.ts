// Keep-alive service to prevent Render free tier cold starts.
// Pings the AI microservice every 30 seconds so it never sleeps while
// the backend itself is active. The backend is kept alive by an external
// uptime monitor (e.g. UptimeRobot) hitting /health every 5 minutes.

import { env } from '../config/env.js';

const PING_INTERVAL_MS = 30_000; // 30 seconds
const PING_TIMEOUT_MS  = 10_000; // 10 seconds per ping

let intervalHandle: ReturnType<typeof setInterval> | null = null;

function resolveAIHealthUrl(): string {
  let base = (env.AI_SERVICE_URL || 'http://localhost:8001').trim();
  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    base = base.includes('.onrender.com') ? `https://${base}` : `http://${base}`;
  }
  return `${base.replace(/\/$/, '')}/health`;
}

async function pingService(url: string, name: string): Promise<void> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
    if (res.ok) {
      console.log(`[KeepAlive] ${name} is alive (${res.status})`);
    } else {
      console.warn(`[KeepAlive] ${name} returned ${res.status}`);
    }
  } catch (err) {
    console.warn(`[KeepAlive] ${name} ping failed: ${err instanceof Error ? err.message : err}`);
  }
}

export function startKeepAlive(): void {
  // Only run in production — no need to spam localhost in dev
  if (process.env.NODE_ENV !== 'production') {
    console.log('[KeepAlive] Skipped (not production)');
    return;
  }

  const aiHealthUrl = resolveAIHealthUrl();
  console.log(`[KeepAlive] Starting — will ping AI service at ${aiHealthUrl} every ${PING_INTERVAL_MS / 1000}s`);

  // Immediate first ping on startup
  pingService(aiHealthUrl, 'AI Microservice');

  intervalHandle = setInterval(() => {
    pingService(aiHealthUrl, 'AI Microservice');
  }, PING_INTERVAL_MS);
}

export function stopKeepAlive(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[KeepAlive] Stopped');
  }
}
