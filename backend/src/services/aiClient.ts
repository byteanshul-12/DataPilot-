// Client module for communicating with the AI microservice workflow engine.
import { env } from '../config/env.js';

export interface AIExecutionResult {
  taskId: string;
  status: 'completed' | 'failed';
  progress: number;
  aiResponse?: string;
  planResponse?: string;
  executionSteps: Array<{ step: string; status: string }>;
  records: Array<{
    id?: string;
    source: string;
    data: Record<string, any>;
  }>;
  sources: Array<{
    url: string;
    domain: string;
    status: 'scraped' | 'pending' | 'failed';
    recordsExtracted: number;
    scrapedAt: string;
  }>;
}

export async function executeAIWorkflow(taskId: string, prompt: string): Promise<AIExecutionResult> {
  let baseUrl = (env.AI_SERVICE_URL || 'http://localhost:8001').trim();

  // If no protocol is specified:
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    if (baseUrl.includes('.onrender.com')) {
      baseUrl = `https://${baseUrl}`;
    } else {
      // Internal Render private network or localhost
      baseUrl = `http://${baseUrl}`;
    }
  }

  // If internal service name without port (e.g., http://datapilot-ai), attach port 8001
  try {
    const parsed = new URL(baseUrl);
    if (!parsed.port && !parsed.hostname.includes('.')) {
      parsed.port = '8001';
      baseUrl = parsed.toString().replace(/\/$/, '');
    }
  } catch (e) {}

  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/api/v1/execute`;

  // Pre-warm: ping /health first to wake the AI service from cold start before sending the real request.
  // On Render free tier the service can take 50-90 seconds to boot, which would otherwise burn through
  // the main request timeout before execution even begins.
  try {
    console.log(`[AIClient] Pre-warming AI service at: ${base}/health`);
    await fetch(`${base}/health`, {
      signal: AbortSignal.timeout(90000), // allow up to 90s for cold boot
    });
    console.log(`[AIClient] AI service warm — proceeding with workflow.`);
  } catch (warmErr) {
    console.warn(`[AIClient] Pre-warm ping failed (service may still be booting): ${warmErr}`);
    // Don't abort — try the main call anyway
  }

  console.log(`[AIClient] Calling AI engine for taskId=${taskId} at: ${url}`);

  const attemptCall = async (): Promise<AIExecutionResult> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, prompt }),
      signal: AbortSignal.timeout(300000), // 5 min timeout — covers cold start + execution
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI service responded with status ${response.status}: ${errText}`);
    }

    return (await response.json()) as AIExecutionResult;
  };

  try {
    return await attemptCall();
  } catch (firstErr) {
    console.warn(`[AIClient] First attempt failed for taskId=${taskId}: ${firstErr}. Retrying in 5s...`);
    // One retry after a short delay — handles transient cold-start failures
    await new Promise((r) => setTimeout(r, 5000));
    try {
      return await attemptCall();
    } catch (err) {
      console.error(`Error executing AI workflow for taskId=${taskId}:`, err);
      return {
        taskId,
        status: 'failed',
        progress: 100,
        aiResponse: `Workflow execution error: ${err instanceof Error ? err.message : String(err)}`,
        planResponse: undefined,
        executionSteps: [
          { step: 'intent_parsing', status: 'completed' },
          { step: 'execution', status: 'failed' },
        ],
        records: [],
        sources: [],
      };
    }
  }
}
