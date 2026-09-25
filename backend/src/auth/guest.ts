// Cryptographic guest session generator and cookie manager.
import crypto from 'node:crypto';
import { eq, gt, and } from 'drizzle-orm';
import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { guestSessions } from '../db/schema.js';
import { env } from '../config/env.js';
import { GuestIdentity } from './types.js';
import { parseCookies } from './cookie.js';

export function generateGuestId(): string {
  const token = crypto.randomBytes(24).toString('hex');
  return `guest_${token}`;
}

export function getCookieOptions() {
  const isProduction = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: env.GUEST_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export async function createGuestSession(res?: Response): Promise<GuestIdentity> {
  const guestId = generateGuestId();
  const expiresAt = new Date(Date.now() + env.GUEST_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const [session] = await db
    .insert(guestSessions)
    .values({
      guestId,
      expiresAt,
    })
    .returning();

  if (res) {
    res.cookie(env.GUEST_COOKIE_NAME, guestId, getCookieOptions());
  }

  return {
    type: 'guest',
    guestId: session.guestId,
    sessionId: session.id,
    expiresAt: session.expiresAt,
  };
}

export async function validateGuestSession(req: Request): Promise<GuestIdentity | null> {
  const cookies = parseCookies(req);
  const cookieGuestId = cookies[env.GUEST_COOKIE_NAME];
  const headerGuestId = req.headers['x-guest-id'] as string | undefined;
  const guestId = cookieGuestId || headerGuestId;

  if (!guestId || typeof guestId !== 'string' || !guestId.startsWith('guest_')) {
    return null;
  }

  const now = new Date();
  const [session] = await db
    .select()
    .from(guestSessions)
    .where(and(eq(guestSessions.guestId, guestId), gt(guestSessions.expiresAt, now)))
    .limit(1);

  if (!session) {
    return null;
  }

  return {
    type: 'guest',
    guestId: session.guestId,
    sessionId: session.id,
    expiresAt: session.expiresAt,
  };
}

export async function clearGuestSession(res: Response, guestId?: string): Promise<void> {
  res.clearCookie(env.GUEST_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  if (guestId) {
    await db.delete(guestSessions).where(eq(guestSessions.guestId, guestId));
  }
}
