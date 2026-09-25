// Express router for data collection task management endpoints.
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { createTaskSchema } from '../../schemas/task.js';
import { collectionQueue } from '../../jobs/queue.js';
import { requireUserOrGuest } from '../../auth/middleware.js';
import { db } from '../../db/index.js';
import { collectionTasks } from '../../db/schema.js';

export const tasksRouter = Router();

tasksRouter.post('/', requireUserOrGuest, async (req, res) => {
  const parseResult = createTaskSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ errors: parseResult.error.errors });
  }

  const identity = req.authIdentity;
  const userId = identity?.type === 'user' ? identity.dbUserId : undefined;
  const guestId = identity?.type === 'guest' ? identity.guestId : undefined;

  const [task] = await db
    .insert(collectionTasks)
    .values({
      prompt: parseResult.data.prompt,
      userId: userId || null,
      guestId: guestId || null,
      status: 'pending',
    })
    .returning();

  await collectionQueue.add('execute-workflow', { taskId: task.id, prompt: task.prompt });

  res.status(201).json(task);
});

tasksRouter.get('/', requireUserOrGuest, async (req, res) => {
  const identity = req.authIdentity;
  let tasks: unknown[] = [];

  if (identity?.type === 'user' && identity.dbUserId) {
    tasks = await db.select().from(collectionTasks).where(eq(collectionTasks.userId, identity.dbUserId));
  } else if (identity?.type === 'guest') {
    tasks = await db.select().from(collectionTasks).where(eq(collectionTasks.guestId, identity.guestId));
  }

  res.json(tasks);
});
