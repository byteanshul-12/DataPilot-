// Data intelligence platform type definitions.
export interface DashboardStats {
  totalWorkflows: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalRecordsCollected: number;
  totalSourcesProcessed: number;
  recentActivity: Array<{ id: string; title: string; status: string; timestamp: string }>;
}
export interface CollectionTask {
  id: string;
  prompt: string;
  userId?: string;
  guestId?: string;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
}
export interface WorkflowStep {
  step: string;
  status: "pending" | "running" | "completed" | "failed";
}
export interface Workflow {
  id: string;
  prompt: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress?: number;
  sourcesCount?: number;
  recordsCount?: number;
  aiResponse?: string;
  planResponse?: string;
  executionSteps?: WorkflowStep[];
  createdAt: string;
  updatedAt?: string;
}
export interface DatasetRecord {
  id: string;
  source: string;
  data: Record<string, unknown>;
  timestamp: string;
}
export interface DatasetResponse {
  workflowId: string;
  records: DatasetRecord[];
  meta: { page: number; limit: number; total: number; searchQuery: string | null };
}
export interface SourceItem {
  url: string;
  domain: string;
  status: "scraped" | "pending" | "failed";
  recordsExtracted: number;
  scrapedAt: string;
}