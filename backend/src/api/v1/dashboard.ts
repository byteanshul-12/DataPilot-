import { Router } from 'express';
import { sql, eq, inArray, desc, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { collectionTasks, collectionResults } from '../../db/schema.js';
import { requireUserOrGuest } from '../../auth/middleware.js';

export const dashboardRouter = Router();

// Get summary metrics for centralized dashboard.
dashboardRouter.get('/stats', requireUserOrGuest, async (req, res) => {
  try {
    const identity = req.authIdentity;
    let identityCondition = undefined;

    if (identity?.type === 'user' && identity.userId) {
      identityCondition = eq(collectionTasks.userId, identity.userId);
    } else if (identity?.type === 'guest' && identity.guestId) {
      identityCondition = eq(collectionTasks.guestId, identity.guestId);
    }

    const [totalWfRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(collectionTasks)
      .where(identityCondition);
    const totalWorkflows = Number(totalWfRes?.count || 0);

    const [activeRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(collectionTasks)
      .where(
        identityCondition
          ? and(identityCondition, inArray(collectionTasks.status, ['pending', 'running']))
          : inArray(collectionTasks.status, ['pending', 'running'])
      );
    const activeTasks = Number(activeRes?.count || 0);

    const [completedRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(collectionTasks)
      .where(
        identityCondition
          ? and(identityCondition, eq(collectionTasks.status, 'completed'))
          : eq(collectionTasks.status, 'completed')
      );
    const completedTasks = Number(completedRes?.count || 0);

    const [failedRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(collectionTasks)
      .where(
        identityCondition
          ? and(identityCondition, eq(collectionTasks.status, 'failed'))
          : eq(collectionTasks.status, 'failed')
      );
    const failedTasks = Number(failedRes?.count || 0);

    // Filter collectionResults by tasks belonging to identity
    let recordsRes;
    let sourcesRes;
    if (identityCondition) {
      const userTasksQuery = db.select({ id: collectionTasks.id }).from(collectionTasks).where(identityCondition);
      
      [recordsRes] = await db
        .select({ count: sql<number>`count(*)` })
        .from(collectionResults)
        .where(inArray(collectionResults.taskId, userTasksQuery));

      [sourcesRes] = await db
        .select({ count: sql<number>`count(distinct ${collectionResults.sourceUrl})` })
        .from(collectionResults)
        .where(inArray(collectionResults.taskId, userTasksQuery));
    } else {
      [recordsRes] = await db.select({ count: sql<number>`count(*)` }).from(collectionResults);
      [sourcesRes] = await db
        .select({ count: sql<number>`count(distinct ${collectionResults.sourceUrl})` })
        .from(collectionResults);
    }

    const totalRecordsCollected = Number(recordsRes?.count || 0);
    const totalSourcesProcessed = Number(sourcesRes?.count || 0);

    const recentTasks = await db
      .select()
      .from(collectionTasks)
      .where(identityCondition)
      .orderBy(desc(collectionTasks.createdAt))
      .limit(5);

    const recentActivity = recentTasks.map((t) => ({
      id: t.id,
      title: t.prompt,
      status: t.status,
      timestamp: t.createdAt.toISOString(),
    }));

    res.json({
      totalWorkflows,
      activeTasks,
      completedTasks,
      failedTasks,
      totalRecordsCollected,
      totalSourcesProcessed,
      recentActivity,
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to load dashboard metrics' });
  }
});
