// Service for migrating anonymous guest session data to an authenticated user.
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { guestData, guestSessions, collectionTasks, user } from '../db/schema.js';

export async function migrateGuestDataToUser(guestId: string, userId: string) {
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!existingUser) {
    throw new Error('Target authenticated user not found');
  }

  const existingGuestData = await db
    .select()
    .from(guestData)
    .where(eq(guestData.guestId, guestId));

  const migratedTasks = await db
    .update(collectionTasks)
    .set({
      userId: existingUser.id,
      guestId: null,
    })
    .where(eq(collectionTasks.guestId, guestId))
    .returning();

  await db.delete(guestData).where(eq(guestData.guestId, guestId));
  await db.delete(guestSessions).where(eq(guestSessions.guestId, guestId));

  return {
    success: true,
    userId: existingUser.id,
    migratedTasksCount: migratedTasks.length,
    migratedDataRecordsCount: existingGuestData.length,
  };
}
