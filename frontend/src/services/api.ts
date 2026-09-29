// REST API service methods for backend communication.
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_URL = rawApiUrl.startsWith('http') ? rawApiUrl : `https://${rawApiUrl}`;

export async function fetchTasks() {
  const response = await fetch(`${API_URL}/api/v1/tasks`);
  if (!response.ok) {
    throw new Error('Failed to fetch collection tasks');
  }
  return response.json();
}

export async function createCollectionTask(prompt: string) {
  const response = await fetch(`${API_URL}/api/v1/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) {
    throw new Error('Failed to create task');
  }
  return response.json();
}
