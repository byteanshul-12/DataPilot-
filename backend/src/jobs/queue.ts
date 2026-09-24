// BullMQ queue initialization using Redis connection.
import { Queue } from 'bullmq';
import { env } from '../config/env.js';

export const collectionQueue = new Queue('collection-tasks', {
  connection: { url: env.REDIS_URL },
});
