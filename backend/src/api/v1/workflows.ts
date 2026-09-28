// Express router for AI prompt workflows and task management endpoints.
import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { collectionTasks } from '../../db/schema.js';
import { collectionQueue } from '../../jobs/queue.js';

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
workflowsRouter.post('/', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt string is required' });
  }

  const [task] = await db
    .insert(collectionTasks)
    .values({
      prompt,
      status: 'pending',
    })
    .returning();

  await collectionQueue.add('execute-workflow', { taskId: task.id, prompt: task.prompt });

  res.status(201).json({
    id: task.id,
    prompt: task.prompt,
    status: 'queued',
    progress: 0,
    sourcesCount: 0,
    recordsCount: 0,
    createdAt: task.createdAt.toISOString(),
  });
});

// List all collection workflows with status filter and pagination.
workflowsRouter.get('/', async (req, res) => {
  const { status, limit = 50, page = 1 } = req.query;

  const tasks = await db
    .select()
    .from(collectionTasks)
    .orderBy(desc(collectionTasks.createdAt));

  const mappedWorkflows = tasks.map((t) => ({
    id: t.id,
    prompt: t.prompt,
    status: mapStatus(t.status),
    progress: t.status === 'completed' ? 100 : t.status === 'running' ? 50 : 0,
    sourcesCount: t.resultCount ? Math.min(t.resultCount, 5) : 0,
    recordsCount: t.resultCount || 0,
    createdAt: t.createdAt.toISOString(),
  }));

  const filtered = status && status !== 'all'
    ? mappedWorkflows.filter((w) => w.status === status)
    : mappedWorkflows;

  res.json({
    data: filtered,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total: filtered.length,
      statusFilter: status || 'all',
    },
  });
});

// Get workflow details by ID.
workflowsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;

  const [task] = await db
    .select()
    .from(collectionTasks)
    .where(eq(collectionTasks.id, id));

  if (!task) {
    return res.status(404).json({ error: 'Workflow not found' });
  }

  res.json({
    id: task.id,
    prompt: task.prompt,
    status: mapStatus(task.status),
    progress: task.status === 'completed' ? 100 : task.status === 'running' ? 50 : 0,
    sourcesCount: task.resultCount ? Math.min(task.resultCount, 5) : 0,
    recordsCount: task.resultCount || 0,
    executionSteps: getExecutionSteps(task.status),
    createdAt: task.createdAt.toISOString(),
  });
});

// Cancel active workflow execution.
workflowsRouter.post('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  await db
    .update(collectionTasks)
    .set({ status: 'cancelled' })
    .where(eq(collectionTasks.id, id));

  res.json({ id, status: 'cancelled', message: 'Workflow task cancelled' });
});

// Rerun previously executed workflow.
workflowsRouter.post('/:id/rerun', async (req, res) => {
  const { id } = req.params;

  const [existing] = await db
    .select()
    .from(collectionTasks)
    .where(eq(collectionTasks.id, id));

  if (!existing) {
    return res.status(404).json({ error: 'Workflow not found' });
  }

  const [newTask] = await db
    .insert(collectionTasks)
    .values({
      prompt: existing.prompt,
      status: 'pending',
    })
    .returning();

  await collectionQueue.add('execute-workflow', { taskId: newTask.id, prompt: newTask.prompt });

  res.status(201).json({
    newWorkflowId: newTask.id,
    originalWorkflowId: id,
    status: 'queued',
  });
});

// Delete workflow history item.
workflowsRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  await db.delete(collectionTasks).where(eq(collectionTasks.id, id));
  res.json({ message: `Workflow ${id} deleted successfully` });
});
