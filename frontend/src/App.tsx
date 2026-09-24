// Root application component with routing and TanStack Query provider setup.
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutDashboard, Database, GitFork, Settings } from 'lucide-react';

const queryClient = new QueryClient();

function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">AI Data Intelligence Dashboard</h1>
      <p className="text-slate-400">Describe your data requirements to start automated workflow collection.</p>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen flex bg-slate-900 text-slate-100">
          <aside className="w-64 border-r border-slate-800 p-4">
            <h2 className="text-xl font-bold tracking-wider mb-6 text-indigo-400">DataPilot</h2>
            <nav className="space-y-2">
              <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-slate-800">
                <LayoutDashboard className="w-5 h-5" /> Dashboard
              </Link>
              <Link to="/workflows" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-slate-800">
                <GitFork className="w-5 h-5" /> Workflows
              </Link>
              <Link to="/datasets" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-slate-800">
                <Database className="w-5 h-5" /> Datasets
              </Link>
              <Link to="/settings" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-slate-800">
                <Settings className="w-5 h-5" /> Settings
              </Link>
            </nav>
          </aside>
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/workflows" element={<div className="p-6">Workflows Overview</div>} />
              <Route path="/datasets" element={<div className="p-6">Datasets Overview</div>} />
              <Route path="/settings" element={<div className="p-6">Settings Overview</div>} />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  );
}
