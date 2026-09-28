// Express router for dashboard analytics metrics and platform overview.
import { Router } from 'express';
import { desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { collectionTasks, collectionResults } from '../../db/schema.js';

export const dashboardRouter = Router();

// Get summary metrics for centralized dashboard.
dashboardRouter.get('/stats', async (_req, res) => {
  const allTasks = await db.select().from(collectionTasks).orderBy(desc(collectionTasks.createdAt));
  const allResults = await db.select().from(collectionResults);

  const totalWorkflows = allTasks.length;
  const activeTasks = allTasks.filter((t) => t.status === 'pending' || t.status === 'running').length;
  const completedTasks = allTasks.filter((t) => t.status === 'completed').length;
  const failedTasks = allTasks.filter((t) => t.status === 'failed').length;
  const totalRecordsCollected = allResults.length;
  const uniqueSources = new Set(allResults.map((r) => r.sourceUrl).filter(Boolean));

  const recentActivity = allTasks.slice(0, 5).map((t) => ({
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
    totalSourcesProcessed: uniqueSources.size,
    recentActivity,
  });
});
