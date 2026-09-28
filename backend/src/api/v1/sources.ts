// Express router for source traceability and data lineage inspection.
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { collectionResults } from '../../db/schema.js';

export const sourcesRouter = Router();

// Get source lineage and URL provenance for a workflow.
sourcesRouter.get('/:workflowId', async (req, res) => {
  const { workflowId } = req.params;

  const results = await db
    .select()
    .from(collectionResults)
    .where(eq(collectionResults.taskId, workflowId));

  const sourceMap = new Map<string, { url: string; domain: string; status: 'scraped'; recordsExtracted: number; scrapedAt: string }>();

  for (const r of results) {
    const rawData = r.data as any;
    const url = r.sourceUrl || rawData?._sources?.[0]?.url || 'https://web-source.org';
    let domain = 'web-source';
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = url;
    }

    if (sourceMap.has(url)) {
      sourceMap.get(url)!.recordsExtracted += 1;
    } else {
      sourceMap.set(url, {
        url,
        domain,
        status: 'scraped',
        recordsExtracted: 1,
        scrapedAt: r.createdAt.toISOString(),
      });
    }
  }

  res.json({
    workflowId,
    sources: Array.from(sourceMap.values()),
  });
});
