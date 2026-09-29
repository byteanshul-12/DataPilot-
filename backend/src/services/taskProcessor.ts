// Asynchronous task processing logic bridging backend DB and AI service engine.
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { collectionTasks, collectionResults } from '../db/schema.js';
import { executeAIWorkflow } from './aiClient.js';

export async function processTaskExecution(taskId: string, prompt: string) {
  console.log(`[TaskProcessor] Starting execution for task ${taskId}: "${prompt}"`);

  // Step 1: Update task status to running
  await db
    .update(collectionTasks)
    .set({
      status: 'running',
      progress: 20,
      executionSteps: [
        { step: 'intent_parsing', status: 'completed' },
        { step: 'source_discovery', status: 'running' },
      ],
      updatedAt: new Date(),
    })
    .where(eq(collectionTasks.id, taskId));

  // Step 2: Call AI Microservice engine
  const aiResult = await executeAIWorkflow(taskId, prompt);

  // Step 3: Delete existing results for rerun tasks
  await db.delete(collectionResults).where(eq(collectionResults.taskId, taskId));

  // Step 4: Insert scraped dataset records into collectionResults table
  if (aiResult.records && aiResult.records.length > 0) {
    const resultsToInsert = aiResult.records.map((rec) => {
      let domain = 'unknown';
      try {
        if (rec.source) {
          domain = new URL(rec.source).hostname.replace(/^www\./, '');
        }
      } catch (e) {
        domain = 'datapilot.ai';
      }

      return {
        taskId,
        sourceUrl: rec.source || 'https://web.datapilot.ai',
        domain,
        data: rec.data || rec,
      };
    });

    await db.insert(collectionResults).values(resultsToInsert);
  }

  // Step 5: Finalize collectionTasks record
  const [updatedTask] = await db
    .update(collectionTasks)
    .set({
      status: aiResult.status || 'completed',
      resultCount: aiResult.records ? aiResult.records.length : 0,
      planResponse: aiResult.planResponse || null,
      aiResponse: aiResult.aiResponse || null,
      executionSteps: aiResult.executionSteps || [],
      progress: 100,
      updatedAt: new Date(),
    })
    .where(eq(collectionTasks.id, taskId))
    .returning();

  console.log(
    `[TaskProcessor] Task ${taskId} completed with ${aiResult.records?.length || 0} records.`
  );

  return updatedTask;
}
