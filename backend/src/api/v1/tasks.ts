// Express router for data collection task management endpoints.
import { Router } from 'express';
import { createTaskSchema } from '../../schemas/task.js';
import { collectionQueue } from '../../jobs/queue.js';

export const tasksRouter = Router();

tasksRouter.post('/', async (req, res) => {
  const parseResult = createTaskSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ errors: parseResult.error.errors });
  }

  const taskId = crypto.randomUUID();
  await collectionQueue.add('execute-workflow', { taskId, prompt: parseResult.data.prompt });

  res.status(201).json({
    id: taskId,
    prompt: parseResult.data.prompt,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
});

tasksRouter.get('/', async (_req, res) => {
  res.json([]);
});
