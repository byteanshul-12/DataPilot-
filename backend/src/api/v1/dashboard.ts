// Express router for dashboard analytics metrics and platform overview.
import { Router } from 'express';

export const dashboardRouter = Router();

// Get summary metrics for centralized dashboard.
dashboardRouter.get('/stats', async (_req, res) => {
  res.json({
    totalWorkflows: 0,
    activeTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalRecordsCollected: 0,
    totalSourcesProcessed: 0,
    recentActivity: [],
  });
});
