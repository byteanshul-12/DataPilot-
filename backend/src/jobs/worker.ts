// BullMQ background worker executing asynchronous data collection workflows.
import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { processTaskExecution } from '../services/taskProcessor.js';

export const worker = new Worker(
  'collection-tasks',
  async (job) => {
    console.log(`[Worker] Processing job ${job.id} for task ${job.data.taskId}`);
    try {
      const result = await processTaskExecution(job.data.taskId, job.data.prompt);
      return { taskId: job.data.taskId, status: 'completed', recordCount: result?.resultCount || 0 };
    } catch (err) {
      console.error(`[Worker] Error processing job ${job.id}:`, err);
      throw err;
    }
  },
  { connection: { url: env.REDIS_URL } }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed with error:`, err);
});
