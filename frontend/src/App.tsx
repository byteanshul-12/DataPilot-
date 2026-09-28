import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import AuthPage from "./pages/AuthPage";
import Workflows from "./pages/Workflows";
import WorkflowDetails from "./pages/WorkflowDetails";
import { Providers } from "@/components/providers";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/auth/:path" element={<AuthPage />} />
      <Route path="/workflows" element={<Workflows />} />
      <Route path="/workflows/:id" element={<WorkflowDetails />} />
      <Route path="/" element={<Navigate to="/auth/sign-in" replace />} />
      <Route path="*" element={<Navigate to="/auth/sign-in" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Providers>
          <AppRoutes />
        </Providers>
      </Router>
    </QueryClientProvider>
  );
}