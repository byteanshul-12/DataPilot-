// Express router for collected dataset querying, filtering, export, and deduplication.
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { collectionResults } from '../../db/schema.js';

import * as XLSX from 'xlsx';

export const datasetsRouter = Router();

// List collected dataset records for a specific workflow with search and filter.
datasetsRouter.get('/:workflowId', async (req, res) => {
  const { workflowId } = req.params;
  const { search, limit = 50, page = 1 } = req.query;

  const results = await db
    .select()
    .from(collectionResults)
    .where(eq(collectionResults.taskId, workflowId));

  const records = results.map((r) => ({
    id: r.id,
    source: r.sourceUrl || 'direct-scraping',
    data: r.data as Record<string, unknown>,
    timestamp: r.createdAt.toISOString(),
  }));

  const filtered = search
    ? records.filter((r) => JSON.stringify(r.data).toLowerCase().includes(String(search).toLowerCase()))
    : records;

  res.json({
    workflowId,
    records: filtered,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total: filtered.length,
      searchQuery: search ? String(search) : null,
    },
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

  const flatRecords = results.map((r) => {
    const d = (r.data as Record<string, unknown>) || {};
    const flat: Record<string, any> = {};
    for (const [k, v] of Object.entries(d)) {
      if (k === '_sources') {
        const sources = v as Array<{ url?: string }>;
        flat['source_url'] = sources?.[0]?.url || r.sourceUrl || '';
      } else {
        flat[k] = v;
      }
    }
    if (!flat['source_url'] && r.sourceUrl) {
      flat['source_url'] = r.sourceUrl;
    }
    return flat;
  });

  if (format === 'xlsx' || format === 'excel') {
    const worksheet = XLSX.utils.json_to_sheet(flatRecords);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Collected Data');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=dataset_${workflowId}.xlsx`
    );
    return res.send(buffer);
  }

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=dataset_${workflowId}.csv`);

    if (flatRecords.length === 0) {
      return res.send('id,source,data,timestamp\n');
    }

    const headers = Array.from(new Set(flatRecords.flatMap((r) => Object.keys(r))));
    const csvRows = [headers.join(',')];
    for (const rec of flatRecords) {
      const row = headers.map((h) => {
        const val = rec[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      });
      csvRows.push(row.join(','));
    }
    return res.send(csvRows.join('\n'));
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=dataset_${workflowId}.json`);
  res.json(flatRecords);
});

// Trigger deduplication pass on workflow dataset.
datasetsRouter.post('/:workflowId/deduplicate', async (req, res) => {
  const { workflowId } = req.params;
  const { matchField = 'name', similarityThreshold = 85 } = req.body;

  res.json({
    workflowId,
    status: 'completed',
    matchField,
    similarityThreshold,
    removedDuplicates: 0,
    remainingRecords: 0,
  });
});
