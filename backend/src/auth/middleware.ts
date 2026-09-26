// Express middleware for Better Auth and guest session authorization.
import { Request, Response, NextFunction } from 'express';
import { getBetterAuthIdentity } from './better-auth.js';
import { validateGuestSession } from './guest.js';
import { AuthIdentity } from './types.js';

export async function resolveIdentity(req: Request): Promise<AuthIdentity> {
  const authUser = await getBetterAuthIdentity(req);
  if (authUser) {
    return authUser;
  }

  const guestSession = await validateGuestSession(req);
  if (guestSession) {
    return guestSession;
  }

  return null;
}

export async function getCurrentIdentity(req: Request, _res: Response, next: NextFunction) {
  try {
    req.authIdentity = await resolveIdentity(req);
    next();
  } catch (error) {
    req.authIdentity = null;
    next();
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = await getBetterAuthIdentity(req);
    if (!authUser) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Please sign in.',
      });
    }

    req.authIdentity = authUser;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication session.',
    });
  }
}

export async function requireUserOrGuest(req: Request, res: Response, next: NextFunction) {
  try {
    const identity = await resolveIdentity(req);
    if (!identity) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Active user or guest session required.',
      });
    }

    req.authIdentity = identity;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid session.',
    });
  }
}
