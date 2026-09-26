// Authentication routes for guest sessions, identity checks, and data migration.
import { Router, Request, Response } from 'express';
import { createGuestSession, clearGuestSession, validateGuestSession } from '../../auth/guest.js';
import { requireAuth, getCurrentIdentity } from '../../auth/middleware.js';
import { migrateGuestDataToUser } from '../../services/auth.js';
import { parseCookies } from '../../auth/cookie.js';
import { env } from '../../config/env.js';

export const authRouter = Router();

authRouter.post('/guest', async (req: Request, res: Response) => {
  try {
    const existing = await validateGuestSession(req);
    if (existing) {
      return res.json({
        success: true,
        isNew: false,
        guestId: existing.guestId,
        expiresAt: existing.expiresAt,
      });
    }

    const session = await createGuestSession(res);
    return res.status(201).json({
      success: true,
      isNew: true,
      guestId: session.guestId,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error('Guest session creation error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to create guest session',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

authRouter.get('/me', getCurrentIdentity, async (req: Request, res: Response) => {
  const identity = req.authIdentity;
  const isAuthenticated = identity?.type === 'user';
  const isGuest = identity?.type === 'guest';

  return res.json({
    isAuthenticated,
    isGuest,
    identity,
  });
});

authRouter.post('/migrate-guest', requireAuth, async (req: Request, res: Response) => {
  try {
    const userIdentity = req.authIdentity;
    if (!userIdentity || userIdentity.type !== 'user') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const cookies = parseCookies(req);
    const guestId = req.body?.guestId || cookies[env.GUEST_COOKIE_NAME] || req.headers['x-guest-id'];

    if (!guestId || typeof guestId !== 'string') {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'No guest session identified to migrate',
      });
    }

    const result = await migrateGuestDataToUser(guestId, userIdentity.userId);
    await clearGuestSession(res, guestId);

    return res.json(result);
  } catch (error) {
    console.error('Guest migration error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to migrate guest data',
    });
  }
});

authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    const cookies = parseCookies(req);
    const guestId = cookies[env.GUEST_COOKIE_NAME] || (req.headers['x-guest-id'] as string | undefined);
    await clearGuestSession(res, guestId);

    return res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to complete logout',
    });
  }
});
