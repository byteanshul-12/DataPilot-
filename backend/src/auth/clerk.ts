// Clerk authentication helpers and local database user synchronizer.
import { getAuth, clerkClient } from '@clerk/express';
import { Request } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { UserIdentity } from './types.js';

export async function getClerkIdentity(req: Request): Promise<UserIdentity | null> {
  let clerkUserId: string | null = null;

  try {
    const auth = getAuth(req);
    if (auth && auth.userId) {
      clerkUserId = auth.userId;
    }
  } catch {
    const reqWithAuth = req as Request & { auth?: { userId?: string } };
    if (reqWithAuth.auth?.userId) {
      clerkUserId = reqWithAuth.auth.userId;
    }
  }

  if (!clerkUserId) {
    return null;
  }

  const dbUser = await syncOrCreateClerkUser(clerkUserId);

  return {
    type: 'user',
    clerkUserId,
    dbUserId: dbUser.id,
    email: dbUser.email || undefined,
    name: dbUser.name || undefined,
  };
}

export async function syncOrCreateClerkUser(clerkUserId: string) {
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  if (existingUser) {
    return existingUser;
  }

  let email: string | undefined;
  let name: string | undefined;

  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    email = clerkUser.emailAddresses?.[0]?.emailAddress;
    const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ');
    name = fullName.length > 0 ? fullName : undefined;
  } catch {
    // Falls back to minimal profile if Clerk API lookup is unconfigured.
  }

  const [newUser] = await db
    .insert(users)
    .values({
      clerkUserId,
      email: email || null,
      name: name || null,
    })
    .returning();

  return newUser;
}
