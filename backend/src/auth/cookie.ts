// Cookie parsing and header serialization utilities.
import { Request } from 'express';

export function parseCookies(req: Request): Record<string, string> {
  if (req.cookies && typeof req.cookies === 'object') {
    return req.cookies;
  }

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return {};
  }

  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(';');

  for (const pair of pairs) {
    const [rawKey, ...valParts] = pair.split('=');
    if (!rawKey) continue;
    const key = rawKey.trim();
    const val = valParts.join('=').trim();
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }

  return cookies;
}
