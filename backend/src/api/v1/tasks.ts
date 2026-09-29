// Express router for data collection task management endpoints.
import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { createTaskSchema } from '../../schemas/task.js';
import { collectionQueue } from '../../jobs/queue.js';
import { requireUserOrGuest } from '../../auth/middleware.js';
import { db } from '../../db/index.js';
import { collectionTasks } from '../../db/schema.js';
import { processTaskExecution } from '../../services/taskProcessor.js';

export const tasksRouter = Router();

tasksRouter.post('/', requireUserOrGuest, async (req, res) => {
  const parseResult = createTaskSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ errors: parseResult.error.errors });
  }

  const identity = req.authIdentity;
  const userId = identity?.type === 'user' ? identity.userId : undefined;
  const guestId = identity?.type === 'guest' ? identity.guestId : undefined;

  const [task] = await db
    .insert(collectionTasks)
    .values({
      prompt: parseResult.data.prompt,
      userId: userId || null,
      guestId: guestId || null,
      status: 'pending',
      executionSteps: [
        { step: 'intent_parsing', status: 'running' },
        { step: 'source_discovery', status: 'pending' },
        { step: 'data_scraping', status: 'pending' },
        { step: 'deduplication', status: 'pending' },
      ],
    })
    .returning();

  // Try queueing in Redis
  try {
    await collectionQueue.add('execute-workflow', { taskId: task.id, prompt: task.prompt });
  } catch (err) {
    console.warn('Redis queue add failed, falling back to direct background execution:', err);
  }

  // Trigger task execution asynchronously
  processTaskExecution(task.id, task.prompt).catch((err) =>
    console.error(`Async execution error for task ${task.id}:`, err)
  );

  res.status(201).json(task);
});

tasksRouter.get('/', requireUserOrGuest, async (req, res) => {
  const identity = req.authIdentity;
  let tasks: unknown[] = [];

  if (identity?.type === 'user' && identity.userId) {
    tasks = await db
      .select()
      .from(collectionTasks)
      .where(eq(collectionTasks.userId, identity.userId))
      .orderBy(desc(collectionTasks.createdAt));
  } else if (identity?.type === 'guest') {
    tasks = await db
      .select()
      .from(collectionTasks)
      .where(eq(collectionTasks.guestId, identity.guestId))
      .orderBy(desc(collectionTasks.createdAt));
  } else {
    tasks = await db.select().from(collectionTasks).orderBy(desc(collectionTasks.createdAt));
  }

  res.json(tasks);
});
