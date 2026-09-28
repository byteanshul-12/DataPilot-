import axios from 'axios';


const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : "http://localhost:8000/api/v1";


// axios instance 
export const apiClient = axios.create({
    baseURL: API_BASE,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true, // send cookies
});

import { DashboardStats, CollectionTask, WorkflowStep, Workflow, DatasetRecord, DatasetResponse, SourceItem } from '@/types';

export const api = {
    // dashboard 
    getDashboardStats: async (): Promise<DashboardStats> => {
        const {data} = await apiClient.get<DashboardStats>("/dashboard/stats");
        return data;
    },

    // tasks 
    getTasks: async(): Promise<CollectionTask[]> => {
        const {data} = await apiClient.get<CollectionTask[]>("/tasks");
        return data;
    },

    createTask: async (prompt: string): Promise<CollectionTask>=> {
        const {data} = await apiClient.post<CollectionTask>("/tasks", {prompt});
        return data;
    }, 

    // workflows

    getWorkflows: async (status = "all", page = 1, limit = 10): Promise<{ data: Workflow[]; meta: { page: number; limit: number; total: number } }> => {
    const { data } = await apiClient.get<{data: Workflow[]; meta: { page: number; limit: number; total: number };
    }>("/workflows", {params: { status, page, limit },});
    return data;
  },

  getWorkflowById: async (id: string): Promise<Workflow> => {
    const {data} = await apiClient.get<Workflow>(`/workflows/${id}`);
    return data;
  },

  cancelWorkflow: async (id: string): Promise<{id: string, status: string}> => {
    const {data} = await apiClient.post<{id: string; status: string}>(`/workflows/${id}/cancel`)
    return data;
  },

  rerunWorkflow: async (id: string): Promise<{newWorkflowId: string; originalWorkflowId: string}>=> {
    const {data} = await apiClient.post<{newWorkflowId: string; originalWorkflowId: string}>(`/workflows/${id}`);
    return data;
  },

  deleteWorkflow: async (id: string): Promise<{message: string}> => {
    const {data} = await apiClient.delete<{message: string}>(`/workflows/${id}`);
    return data;
  },

  // get dataset
  getDataset: async (workflowId: string, search= "", page = 1, limit = 50): Promise<DatasetResponse> => {
    const {data} = await apiClient.get<DatasetResponse>(`/datasets/${workflowId}`, {params: {search, page, limit}, 
    });
    return data;
  }, 

   getExportUrl: (workflowId: string, format: "csv" | "json"): string =>
    `${API_BASE}/datasets/${workflowId}/export?format=${format}`,
   
  deduplicateDataset: async (
    workflowId: string,
    matchField: string,
    similarityThreshold: number
  ): Promise<{ removedDuplicates: number; remainingRecords: number }> => {
    const { data } = await apiClient.post<{ removedDuplicates: number; remainingRecords: number }>(
      `/datasets/${workflowId}/deduplicate`,
      { matchField, similarityThreshold }
    );
    return data;
  },


  // Sources
  getSources: async (workflowId: string): Promise<{ workflowId: string; sources: SourceItem[] }> => {
    const { data } = await apiClient.get<{ workflowId: string; sources: SourceItem[] }>(
      `/sources/${workflowId}`
    );
    return data;
  },





}