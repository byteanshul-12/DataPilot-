// Express router for collected dataset querying, filtering, export, and deduplication.
import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { collectionResults, collectionTasks } from '../../db/schema.js';
import { deduplicateRecords } from '../../services/deduplication.js';


export const datasetsRouter = Router();

// List collected dataset records for a specific workflow with search and filter.
datasetsRouter.get('/:workflowId', async (req, res) => {
  const { workflowId } = req.params;
  const { search, limit = 50, page = 1 } = req.query;

  const results = await db
    .select()
    .from(collectionResults)
    .where(eq(collectionResults.taskId, workflowId))
    .orderBy(desc(collectionResults.createdAt));

  let records = results.map((r) => ({
    id: r.id,
    source: r.sourceUrl || 'https://web.datapilot.ai',
    data: (r.data as Record<string, unknown>) || {},
    timestamp: r.createdAt.toISOString(),
  }));

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    records = records.filter((r) => JSON.stringify(r.data).toLowerCase().includes(q));
  }

  const numLimit = Number(limit);
  const numPage = Number(page);
  const offset = (numPage - 1) * numLimit;
  const paginatedRecords = records.slice(offset, offset + numLimit);

  res.json({
    workflowId,
    records: paginatedRecords,
    meta: { page: numPage, limit: numLimit, total: records.length, searchQuery: search || null },
  });
});

// Export collected dataset in Excel (.xlsx), CSV, or JSON format.
datasetsRouter.get('/:workflowId/export', async (req, res) => {
  const { workflowId } = req.params;
  const { format = 'csv' } = req.query;

  const results = await db
    .select()
    .from(collectionResults)
    .where(eq(collectionResults.taskId, workflowId));

  const records = results.map((r) => ({
    id: r.id,
    source: r.sourceUrl,
    data: r.data,
    createdAt: r.createdAt.toISOString(),
  }));

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=dataset_${workflowId}.csv`);

    if (records.length === 0) {
      return res.send('id,source,data,createdAt\n');
    }

    // Extract all unique keys from dataset records
    const sampleData = records.map((r) => r.data as Record<string, any>);
    const keys = Array.from(new Set(sampleData.flatMap((d) => (d && typeof d === 'object' ? Object.keys(d) : []))));
    const header = ['id', 'source', ...keys].join(',');

    const rows = records.map((r) => {
      const d = (r.data as Record<string, any>) || {};
      const vals = keys.map((k) => {
        const val = d[k] !== undefined ? String(d[k]).replace(/"/g, '""') : '';
        return `"${val}"`;
      });
      return [r.id, `"${r.source}"`, ...vals].join(',');
    });

    return res.send([header, ...rows].join('\n'));
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=dataset_${workflowId}.json`);
  res.json(records);
});

// Trigger deduplication pass on workflow dataset.
datasetsRouter.post('/:workflowId/deduplicate', async (req, res) => {
  const { workflowId } = req.params;
  const { matchField = 'job_title', similarityThreshold = 85 } = req.body;

  const results = await db
    .select()
    .from(collectionResults)
    .where(eq(collectionResults.taskId, workflowId));

  const initialCount = results.length;
  if (initialCount === 0) {
    return res.json({
      workflowId,
      status: 'completed',
      matchField,
      similarityThreshold,
      removedDuplicates: 0,
      remainingRecords: 0,
    });
  }

  // Convert to object records for deduplication
  const recordsWithData = results.map((r) => ({
    dbId: r.id,
    ...( (r.data as Record<string, any>) || {} ),
    [matchField]: (r.data as Record<string, any>)?.[matchField] || (r.data as Record<string, any>)?.title || (r.data as Record<string, any>)?.company_name || String(r.id),
  }));

  const deduplicated = deduplicateRecords(recordsWithData, matchField, Number(similarityThreshold));
  const remainingIds = new Set(deduplicated.map((d) => d.dbId));

  const toDeleteIds = results.filter((r) => !remainingIds.has(r.id)).map((r) => r.id);

  for (const delId of toDeleteIds) {
    await db.delete(collectionResults).where(eq(collectionResults.id, delId));
  }

  const remainingRecords = remainingIds.size;
  const removedDuplicates = initialCount - remainingRecords;

  // Update task result count
  await db
    .update(collectionTasks)
    .set({ resultCount: remainingRecords, updatedAt: new Date() })
    .where(eq(collectionTasks.id, workflowId));

  res.json({
    workflowId,
    status: 'completed',
    matchField,
    similarityThreshold,
    removedDuplicates,
    remainingRecords,
  });
});
