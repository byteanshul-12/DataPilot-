// BullMQ background worker executing asynchronous data collection workflows.
import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from '../db/index.js';
import { collectionTasks, collectionResults } from '../db/schema.js';

export const worker = new Worker(
  'collection-tasks',
  async (job) => {
    const { taskId, prompt } = job.data;
    console.log(`[Worker] Starting job for taskId=${taskId}`);

    try {
      // 1. Mark task as running
      await db
        .update(collectionTasks)
        .set({ status: 'running' })
        .where(eq(collectionTasks.id, taskId));

      // 2. Call AI service to start workflow
      const aiUrl = env.AI_SERVICE_URL;
      const startRes = await fetch(`${aiUrl}/api/v1/workflows/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement: prompt }),
      });

      if (!startRes.ok) {
        throw new Error(`AI service returned ${startRes.status}: ${await startRes.text()}`);
      }

      const { task_id: aiTaskId } = (await startRes.json()) as { task_id: string };
      console.log(`[Worker] AI workflow started with aiTaskId=${aiTaskId}`);

      // 3. Poll AI service until finished (up to 120s)
      let attempts = 0;
      let aiStatus = 'queued';
      while (attempts < 60) {
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;

        const statusRes = await fetch(`${aiUrl}/api/v1/workflows/${aiTaskId}`);
        if (!statusRes.ok) continue;

        const statusData = (await statusRes.json()) as { status: string };
        aiStatus = statusData.status;

        if (aiStatus === 'completed' || aiStatus === 'failed' || aiStatus === 'cancelled') {
          break;
        }
      }

      if (aiStatus !== 'completed') {
        throw new Error(`AI workflow ended with status: ${aiStatus}`);
      }

      // 4. Fetch results
      const resultsRes = await fetch(`${aiUrl}/api/v1/workflows/${aiTaskId}/results`);
      if (!resultsRes.ok) {
        throw new Error(`Failed to fetch results: ${resultsRes.status}`);
      }

      const resultsData = (await resultsRes.json()) as {
        records: Array<Record<string, unknown> & { _sources?: Array<{ url?: string }> }>;
        total: number;
      };

      const records = resultsData.records || [];
      console.log(`[Worker] Retrieved ${records.length} records from AI service`);

      // 5. Save results to collectionResults table
      for (const rec of records) {
        const sourceUrl = rec._sources?.[0]?.url || null;
        await db.insert(collectionResults).values({
          taskId,
          sourceUrl,
          data: rec,
        });
      }

      // 6. Update task to completed
      await db
        .update(collectionTasks)
        .set({ status: 'completed', resultCount: records.length })
        .where(eq(collectionTasks.id, taskId));

      console.log(`[Worker] Task ${taskId} successfully completed with ${records.length} records.`);
      return { taskId, status: 'completed', count: records.length };
    } catch (err: any) {
      console.error(`[Worker] Error processing taskId=${taskId}:`, err);
      await db
        .update(collectionTasks)
        .set({ status: 'failed' })
        .where(eq(collectionTasks.id, taskId));
      throw err;
    }
  },
  { connection: { url: env.REDIS_URL } }
);
