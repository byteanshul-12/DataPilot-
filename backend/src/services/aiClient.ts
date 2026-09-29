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

  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/execute`;
  console.log(`[AIClient] Calling AI engine for taskId=${taskId} at: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, prompt }),
      signal: AbortSignal.timeout(120000), // 2 min timeout for cold starts
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI service responded with status ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as AIExecutionResult;
    return data;
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
