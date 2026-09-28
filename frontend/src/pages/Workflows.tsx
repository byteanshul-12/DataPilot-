import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { api} from "@/lib/api";
import { Workflow } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Layers,
  RotateCw,
  XCircle,
  Trash2,
  ArrowUpRight,
} from "lucide-react";

export default function Workflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = async () => {
    setLoading(true);

    try {
      const res = await api.getWorkflows(statusFilter);
      setWorkflows(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, [statusFilter]);

  const handleCancel = async (id: string) => {
    await api.cancelWorkflow(id);
    fetchWorkflows();
  };

  const handleRerun = async (id: string) => {
    await api.rerunWorkflow(id);
    fetchWorkflows();
  };

  const handleDelete = async (id: string) => {
    await api.deleteWorkflow(id);
    fetchWorkflows();
  };

  return (
    <AppLayout>
      <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-black text-white">

        {/* Background grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #ffffff 1px, transparent 1px),
              linear-gradient(to bottom, #ffffff 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-6 py-10">

          {/* page header  */}
          <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">
                <Layers className="h-3.5 w-3.5" />
                Data collection
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Workflows
              </h1>

              <p className="mt-2 text-sm text-zinc-500">
                Manage your data collection pipelines and execution history.
              </p>
            </div>

            {/* status filter  */}
            <div className="flex items-center overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-1">

              {["all", "queued", "running", "completed", "failed"].map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`
                      whitespace-nowrap rounded-md px-3 py-1.5
                      text-xs font-medium capitalize
                      transition-colors
                      ${
                        statusFilter === status
                          ? "bg-zinc-800 text-white"
                          : "text-zinc-600 hover:text-zinc-300"
                      }
                    `}
                  >
                    {status}
                  </button>
                )
              )}

            </div>
          </div>

          {/* workflow table  */}
          <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">

            <div className="overflow-x-auto">

              <table className="w-full min-w-[800px] text-left">

                {/* table header  */}
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950">

                    <th className="px-5 py-3.5 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                      Workflow
                    </th>

                    <th className="px-5 py-3.5 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                      Status
                    </th>

                    <th className="px-5 py-3.5 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                      Records
                    </th>

                    <th className="px-5 py-3.5 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                      Created
                    </th>

                    <th className="px-5 py-3.5 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                      Actions
                    </th>

                  </tr>
                </thead>

                {/* table body  */}
                <tbody className="divide-y divide-zinc-800/70">

                  {workflows.length > 0 ? (

                    workflows.map((wf) => (

                      <tr
                        key={wf.id}
                        className="group transition-colors hover:bg-zinc-900/50"
                      >

                        {/* Workflow */}
                        <td className="max-w-md px-5 py-4">

                          <Link
                            to={`/workflows/${wf.id}`}
                            className="group/link flex items-center gap-3"
                          >

                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
                              <Layers className="h-3.5 w-3.5 text-zinc-600" />
                            </div>

                            <div className="min-w-0">

                              <p className="truncate text-sm font-medium text-zinc-200 group-hover/link:text-white">
                                {wf.prompt}
                              </p>

                              <p className="mt-1 truncate text-[11px] text-zinc-700">
                                ID: {wf.id}
                              </p>

                            </div>

                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-700 transition-colors group-hover/link:text-zinc-400" />

                          </Link>

                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <StatusBadge status={wf.status} />
                        </td>

                        {/* Records */}
                        <td className="px-5 py-4">

                          <span className="text-sm text-zinc-400">
                            {(wf.recordsCount ?? 0).toLocaleString()}
                          </span>

                          <span className="ml-1 text-xs text-zinc-700">
                            records
                          </span>

                        </td>

                        {/* Created */}
                        <td className="px-5 py-4">

                          <span className="text-xs text-zinc-500">
                            {new Date(wf.createdAt).toLocaleDateString()}
                          </span>

                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">

                          <div className="flex items-center justify-end gap-1">

                            {wf.status === "running" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCancel(wf.id)}
                                className="h-8 px-2 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                              >
                                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                                Cancel
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRerun(wf.id)}
                              className="h-8 px-2 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-white"
                            >
                              <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                              Rerun
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(wf.id)}
                              className="h-8 w-8 p-0 text-zinc-700 hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>

                          </div>

                        </td>

                      </tr>

                    ))

                  ) : (

                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-20 text-center"
                      >

                        {loading ? (
                          <div className="flex flex-col items-center">

                            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
                              <RotateCw className="h-4 w-4 animate-spin text-zinc-600" />
                            </div>

                            <p className="text-sm text-zinc-500">
                              Loading workflows...
                            </p>

                          </div>
                        ) : (
                          <div className="flex flex-col items-center">

                            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
                              <Layers className="h-4 w-4 text-zinc-700" />
                            </div>

                            <p className="text-sm text-zinc-400">
                              No workflows found
                            </p>

                            <p className="mt-1 text-xs text-zinc-700">
                              Try changing the status filter or create a new workflow.
                            </p>

                          </div>
                        )}

                      </td>
                    </tr>

                  )}

                </tbody>

              </table>

            </div>

          </div>

          {/* footer  */}
          {workflows.length > 0 && (
            <div className="mt-3 flex items-center justify-between px-1">

              <p className="text-xs text-zinc-700">
                {workflows.length} workflow
                {workflows.length !== 1 ? "s" : ""}
              </p>

              <p className="text-xs text-zinc-700">
                Showing {statusFilter === "all" ? "all" : statusFilter}
              </p>

            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed:
      "bg-transparent text-zinc-300 border-zinc-700",
    running:
      "bg-transparent text-zinc-200 border-zinc-600",
    queued:
      "bg-transparent text-zinc-400 border-zinc-700",
    failed:
      "bg-transparent text-red-400 border-red-500/30",
    cancelled:
      "bg-transparent text-zinc-600 border-zinc-800",
  };

  return (
    <Badge
      variant="outline"
      className={`capitalize border px-2 py-0.5 text-[11px] font-normal ${
        styles[status] || styles.queued
      }`}
    >
      {status}
    </Badge>
  );
}

