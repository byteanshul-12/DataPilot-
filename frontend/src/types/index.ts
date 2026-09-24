// Data intelligence platform type definitions.
export interface CollectionTask {
  id: string;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  resultCount?: number;
}

export interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  sources: string[];
  status: string;
}
