// Service for migrating anonymous guest session data to an authenticated user.
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { guestData, guestSessions, collectionTasks, users } from '../db/schema.js';
import { syncOrCreateClerkUser } from '../auth/clerk.js';

export async function migrateGuestDataToUser(guestId: string, clerkUserId: string) {
  const user = await syncOrCreateClerkUser(clerkUserId);

  const existingGuestData = await db
    .select()
    .from(guestData)
    .where(eq(guestData.guestId, guestId));

  const migratedTasks = await db
    .update(collectionTasks)
    .set({
      userId: user.id,
      guestId: null,
    })
    .where(eq(collectionTasks.guestId, guestId))
    .returning();

  await db.delete(guestData).where(eq(guestData.guestId, guestId));
  await db.delete(guestSessions).where(eq(guestSessions.guestId, guestId));

  return {
    success: true,
    userId: user.id,
    clerkUserId,
    migratedTasksCount: migratedTasks.length,
    migratedDataRecordsCount: existingGuestData.length,
  };
}
