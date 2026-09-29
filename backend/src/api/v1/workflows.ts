import { Router } from 'express';
import { eq, desc, sql, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { collectionTasks, collectionResults } from '../../db/schema.js';
import { processTaskExecution } from '../../services/taskProcessor.js';
import { requireUserOrGuest } from '../../auth/middleware.js';

export const workflowsRouter = Router();

function mapStatus(status: string): 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' {
  if (status === 'pending') return 'queued';
  if (status === 'running') return 'running';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled') return 'cancelled';
  return 'queued';
}

function getExecutionSteps(status: string) {
  const mapped = mapStatus(status);
  if (mapped === 'completed') {
    return [
      { step: 'intent_parsing', status: 'completed' },
      { step: 'source_discovery', status: 'completed' },
      { step: 'data_scraping', status: 'completed' },
      { step: 'deduplication', status: 'completed' },
    ];
  }
  if (mapped === 'running') {
    return [
      { step: 'intent_parsing', status: 'completed' },
      { step: 'source_discovery', status: 'completed' },
      { step: 'data_scraping', status: 'running' },
      { step: 'deduplication', status: 'pending' },
    ];
  }
  if (mapped === 'failed') {
    return [
      { step: 'intent_parsing', status: 'completed' },
      { step: 'source_discovery', status: 'failed' },
      { step: 'data_scraping', status: 'pending' },
      { step: 'deduplication', status: 'pending' },
    ];
  }
  return [
    { step: 'intent_parsing', status: 'pending' },
    { step: 'source_discovery', status: 'pending' },
    { step: 'data_scraping', status: 'pending' },
    { step: 'deduplication', status: 'pending' },
  ];
}

// Create new data collection workflow from prompt.
workflowsRouter.post('/', requireUserOrGuest, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt string is required' });
  }

  const identity = req.authIdentity;
  const userId = identity?.type === 'user' ? identity.userId : undefined;
  const guestId = identity?.type === 'guest' ? identity.guestId : undefined;

  const [task] = await db
    .insert(collectionTasks)
    .values({
      prompt,
      userId: userId || null,
      guestId: guestId || null,
      status: 'pending',
      progress: 0,
      executionSteps: [
        { step: 'intent_parsing', status: 'running' },
        { step: 'source_discovery', status: 'pending' },
        { step: 'data_scraping', status: 'pending' },
        { step: 'deduplication', status: 'pending' },
      ],
    })
    .returning();

  // Execute workflow asynchronously
  processTaskExecution(task.id, prompt).catch(console.error);

  res.status(201).json({
    id: task.id,
    prompt: task.prompt,
    status: task.status,
    progress: task.progress,
    sourcesCount: 0,
    recordsCount: 0,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
});

// List all collection workflows with status filter and pagination.
workflowsRouter.get('/', requireUserOrGuest, async (req, res) => {
  const { status, limit = 10, page = 1 } = req.query;
  const numLimit = Number(limit);
  const numPage = Number(page);
  const offset = (numPage - 1) * numLimit;

  const identity = req.authIdentity;
  const conditions = [];

  if (identity?.type === 'user' && identity.userId) {
    conditions.push(eq(collectionTasks.userId, identity.userId));
  } else if (identity?.type === 'guest' && identity.guestId) {
    conditions.push(eq(collectionTasks.guestId, identity.guestId));
  }

  if (status && status !== 'all') {
    conditions.push(eq(collectionTasks.status, String(status)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const allTasks = await db
    .select()
    .from(collectionTasks)
    .where(whereClause)
    .orderBy(desc(collectionTasks.createdAt))
    .limit(numLimit)
    .offset(offset);

  // Map tasks with source counts
  const workflows = await Promise.all(
    allTasks.map(async (t) => {
      const [sourcesRes] = await db
        .select({ count: sql<number>`count(distinct ${collectionResults.sourceUrl})` })
        .from(collectionResults)
        .where(eq(collectionResults.taskId, t.id));

      return {
        id: t.id,
        prompt: t.prompt,
        status: t.status,
        progress: t.progress ?? 100,
        sourcesCount: Number(sourcesRes?.count || 0),
        recordsCount: t.resultCount ?? 0,
        planResponse: t.planResponse,
        aiResponse: t.aiResponse,
        executionSteps: t.executionSteps,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt?.toISOString(),
      };
    })
  );

  const totalCountRes = await db.select({ count: sql<number>`count(*)` }).from(collectionTasks).where(whereClause);
  const total = Number(totalCountRes[0]?.count || 0);

  res.json({
    data: workflows,
    meta: { page: numPage, limit: numLimit, total, statusFilter: status || 'all' },
  });
});

// Get workflow details by ID.
workflowsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;

  const [t] = await db.select().from(collectionTasks).where(eq(collectionTasks.id, id));
  if (!t) {
    return res.status(404).json({ error: `Workflow ${id} not found` });
  }

  const [sourcesRes] = await db
    .select({ count: sql<number>`count(distinct ${collectionResults.sourceUrl})` })
    .from(collectionResults)
    .where(eq(collectionResults.taskId, t.id));

  res.json({
    id: t.id,
    prompt: t.prompt,
    status: t.status,
    progress: t.progress ?? 100,
    sourcesCount: Number(sourcesRes?.count || 0),
    recordsCount: t.resultCount ?? 0,
    planResponse: t.planResponse,
    aiResponse: t.aiResponse,
    executionSteps: t.executionSteps || [
      { step: 'intent_parsing', status: 'completed' },
      { step: 'source_discovery', status: 'completed' },
      { step: 'data_scraping', status: 'completed' },
      { step: 'deduplication', status: 'completed' },
    ],
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt?.toISOString(),
  });
});

// Cancel active workflow execution.
workflowsRouter.post('/:id/cancel', async (req, res) => {
  const { id } = req.params;

  await db
    .update(collectionTasks)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(collectionTasks.id, id));

  res.json({ id, status: 'cancelled', message: 'Workflow task cancelled' });
});

// Rerun previously executed workflow (handles POST /:id and POST /:id/rerun).
const rerunHandler = async (req: any, res: any) => {
  const { id } = req.params;

  const [existing] = await db.select().from(collectionTasks).where(eq(collectionTasks.id, id));
  if (!existing) {
    return res.status(404).json({ error: `Workflow ${id} not found` });
  }

  const [newTask] = await db
    .insert(collectionTasks)
    .values({
      prompt: existing.prompt,
      userId: existing.userId,
      guestId: existing.guestId,
      status: 'pending',
      progress: 0,
      executionSteps: [
        { step: 'intent_parsing', status: 'running' },
        { step: 'source_discovery', status: 'pending' },
        { step: 'data_scraping', status: 'pending' },
        { step: 'deduplication', status: 'pending' },
      ],
    })
    .returning();

  processTaskExecution(newTask.id, newTask.prompt).catch(console.error);

  res.status(201).json({
    newWorkflowId: newTask.id,
    originalWorkflowId: id,
    status: 'queued',
  });
};

workflowsRouter.post('/:id/rerun', rerunHandler);
workflowsRouter.post('/:id', rerunHandler);

// Delete workflow history item.
workflowsRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;

  await db.delete(collectionResults).where(eq(collectionResults.taskId, id));
  await db.delete(collectionTasks).where(eq(collectionTasks.id, id));

  res.json({ message: `Workflow ${id} deleted successfully` });
});
