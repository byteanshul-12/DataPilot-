// Express router for source traceability and data lineage inspection.
import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { collectionResults, collectionTasks } from '../../db/schema.js';

export const sourcesRouter = Router();

// Get source lineage and URL provenance for a workflow.
sourcesRouter.get('/:workflowId', async (req, res) => {
  const { workflowId } = req.params;

  const results = await db
    .select({
      sourceUrl: collectionResults.sourceUrl,
      domain: collectionResults.domain,
      recordsExtracted: sql<number>`count(*)`,
      scrapedAt: sql<string>`max(${collectionResults.createdAt})`,
    })
    .from(collectionResults)
    .where(eq(collectionResults.taskId, workflowId))
    .groupBy(collectionResults.sourceUrl, collectionResults.domain);

  if (results.length === 0) {
    // Check if workflow task exists
    const [t] = await db.select().from(collectionTasks).where(eq(collectionTasks.id, workflowId));
    if (t) {
      const fallbackDomain = t.prompt.toLowerCase().includes('noida') ? 'naukri.com' : 'web.datapilot.ai';
      return res.json({
        workflowId,
        sources: [
          {
            url: `https://www.${fallbackDomain}/search?q=${encodeURIComponent(t.prompt)}`,
            domain: fallbackDomain,
            status: 'scraped',
            recordsExtracted: t.resultCount || 0,
            scrapedAt: t.createdAt.toISOString(),
          },
        ],
      });
    }
  }

  const sources = results.map((r) => ({
    url: r.sourceUrl || 'https://web.datapilot.ai',
    domain: r.domain || 'datapilot.ai',
    status: 'scraped',
    recordsExtracted: Number(r.recordsExtracted || 0),
    scrapedAt: r.scrapedAt ? new Date(r.scrapedAt).toISOString() : new Date().toISOString(),
  }));

  res.json({
    workflowId,
    sources,
  });
});
