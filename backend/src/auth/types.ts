// Authentication identity types and request context declarations.
export interface UserIdentity {
  type: 'user';
  clerkUserId: string;
  dbUserId?: string;
  email?: string;
  name?: string;
}

export interface GuestIdentity {
  type: 'guest';
  guestId: string;
  sessionId: string;
  expiresAt: Date;
}

export type AuthIdentity = UserIdentity | GuestIdentity | null;

declare global {
  namespace Express {
    interface Request {
      authIdentity?: AuthIdentity;
    }
  }
}
