// Express router for AI prompt workflows and task management endpoints.
import { Router } from 'express';

export const workflowsRouter = Router();

// Create new data collection workflow from prompt.
workflowsRouter.post('/', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt string is required' });
  }

  const workflow = {
    id: crypto.randomUUID(),
    prompt,
    status: 'queued',
    progress: 0,
    sourcesCount: 0,
    recordsCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  res.status(201).json(workflow);
});

// List all collection workflows with status filter and pagination.
workflowsRouter.get('/', async (req, res) => {
  const { status, limit = 10, page = 1 } = req.query;
  res.json({
    data: [],
    meta: { page: Number(page), limit: Number(limit), total: 0, statusFilter: status || 'all' },
  });
});

// Get workflow details by ID.
workflowsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  res.json({
    id,
    prompt: 'Sample data requirement prompt',
    status: 'completed',
    executionSteps: [
      { step: 'intent_parsing', status: 'completed' },
      { step: 'source_discovery', status: 'completed' },
      { step: 'data_scraping', status: 'completed' },
      { step: 'deduplication', status: 'completed' },
    ],
    createdAt: new Date().toISOString(),
  });
});

// Cancel active workflow execution.
workflowsRouter.post('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  res.json({ id, status: 'cancelled', message: 'Workflow task cancelled' });
});

// Rerun previously executed workflow.
workflowsRouter.post('/:id/rerun', async (req, res) => {
  const { id } = req.params;
  res.status(201).json({
    newWorkflowId: crypto.randomUUID(),
    originalWorkflowId: id,
    status: 'queued',
  });
});

// Delete workflow history item.
workflowsRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  res.json({ message: `Workflow ${id} deleted successfully` });
});
