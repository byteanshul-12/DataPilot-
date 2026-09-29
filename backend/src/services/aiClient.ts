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
  const url = `${env.AI_SERVICE_URL.replace(/\/$/, '')}/api/v1/execute`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, prompt }),
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
