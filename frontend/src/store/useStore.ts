// Client state management store powered by Zustand.
import { create } from 'zustand';
import { CollectionTask } from '../types';

interface AppState {
  tasks: CollectionTask[];
  activeTask: CollectionTask | null;
  addTask: (task: CollectionTask) => void;
  setActiveTask: (task: CollectionTask | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  tasks: [],
  activeTask: null,
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  setActiveTask: (task) => set({ activeTask: task }),
}));
