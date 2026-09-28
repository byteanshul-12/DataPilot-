import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { api} from "@/lib/api";
import { Workflow, DatasetRecord, SourceItem } from "@/types";
import { StatusBadge } from "@/pages/Workflows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  Download,
  RotateCw,
  XCircle,
  Search,
  SlidersHorizontal,
  ExternalLink,
  Layers,
  Database,
  Globe,
  FileSpreadsheet,
  Code2,
  Table,
} from "lucide-react";

export default function WorkflowDetails() {
  const { id } = useParams<{ id: string }>();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [activeTab, setActiveTab] = useState<
    "stepper" | "dataset" | "sources"
  >("stepper");

  // Dataset
  const [records, setRecords] = useState<DatasetRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "json">("table");

  // Sources
  const [sources, setSources] = useState<SourceItem[]>([]);

  // Deduplication
  const [dedupMatchField, setDedupMatchField] = useState("name");
  const [dedupThreshold, setDedupThreshold] = useState(85);
  const [deduping, setDeduping] = useState(false);

  useEffect(() => {
    if (!id) return;

    api
      .getWorkflowById(id)
      .then(setWorkflow)
      .catch(console.error);

    api
      .getDataset(id)
      .then((res) => setRecords(res.records))
      .catch(console.error);

    api
      .getSources(id)
      .then((res) => setSources(res.sources))
      .catch(console.error);
  }, [id]);

  const handleDeduplicate = async () => {
    if (!id) return;

    setDeduping(true);

    try {
      await api.deduplicateDataset(
        id,
        dedupMatchField,
        dedupThreshold
      );

      const res = await api.getDataset(id);
      setRecords(res.records);
    } catch (err) {
      console.error(err);
    } finally {
      setDeduping(false);
    }
  };

  if (!workflow) {
    return (
      <AppLayout>
        <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-black text-white">

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

          <div className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
            <div className="text-center">

              <div className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950">
                <RotateCw className="h-4 w-4 animate-spin text-zinc-600" />
              </div>

              <p className="text-sm text-zinc-500">
                Loading workflow details...
              </p>

            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-black text-white">

        {/* Background Grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #ffffff 1px, transparent 1px),
              linear-gradient(to bottom, #ffffff 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-6 py-10">

          {/* header  */}
          <div className="mb-8 border-b border-zinc-800 pb-7">

            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">

              <div className="min-w-0">

                <div className="mb-3 flex items-center gap-3">

                  <Link
                    to="/workflows"
                    className="text-xs text-zinc-600 transition-colors hover:text-zinc-300"
                  >
                    ← Workflows
                  </Link>

                  <span className="text-zinc-800">/</span>

                  <StatusBadge status={workflow.status} />

                </div>

                <h1 className="max-w-3xl text-2xl font-semibold tracking-tight text-white">
                  {workflow.prompt}
                </h1>

                <p className="mt-2 font-mono text-[11px] text-zinc-700">
                  {workflow.id}
                </p>

              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2">

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => api.rerunWorkflow(workflow.id)}
                  className="h-8 rounded-md border-zinc-800 bg-zinc-950 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-white"
                >
                  <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                  Rerun
                </Button>

                {workflow.status === "running" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => api.cancelWorkflow(workflow.id)}
                    className="h-8 rounded-md border-red-500/20 bg-transparent text-xs text-red-400 hover:bg-red-500/10"
                  >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Cancel
                  </Button>
                )}

              </div>

            </div>
          </div>

          {/* tabs  */}
          <div className="mb-7 flex overflow-x-auto border-b border-zinc-800">

            <TabButton
              active={activeTab === "stepper"}
              onClick={() => setActiveTab("stepper")}
              icon={Layers}
            >
              Execution Timeline
            </TabButton>

            <TabButton
              active={activeTab === "dataset"}
              onClick={() => setActiveTab("dataset")}
              icon={Database}
            >
              Dataset Records
            </TabButton>

            <TabButton
              active={activeTab === "sources"}
              onClick={() => setActiveTab("sources")}
              icon={Globe}
            >
              Source Lineage
            </TabButton>

          </div>

          {/* execution timeline  */}

          {activeTab === "stepper" && (
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">

              <div className="border-b border-zinc-800 px-5 py-4">

                <p className="text-sm font-medium text-zinc-200">
                  Execution pipeline
                </p>

                <p className="mt-1 text-xs text-zinc-600">
                  Multi-agent workflow execution steps.
                </p>

              </div>

              <div className="p-6">

                <div className="relative pl-8">

                  {/* Timeline line */}
                  <div className="absolute bottom-3 left-[11px] top-3 w-px bg-zinc-800" />

                  <div className="space-y-8">

                    {(
                      workflow.executionSteps || [
                        {
                          step: "intent_parsing",
                          status: "completed",
                        },
                        {
                          step: "source_discovery",
                          status: "completed",
                        },
                        {
                          step: "data_scraping",
                          status: "completed",
                        },
                        {
                          step: "deduplication",
                          status: "completed",
                        },
                      ]
                    ).map((stepItem, index) => (

                      <div
                        key={index}
                        className="relative flex items-center justify-between gap-4"
                      >

                        {/* Icon */}
                        <div className="absolute -left-8 flex h-6 w-6 items-center justify-center bg-zinc-950">

                          {stepItem.status === "completed" ? (
                            <CheckCircle2 className="h-4 w-4 text-zinc-300" />
                          ) : (
                            <Clock className="h-4 w-4 text-zinc-700" />
                          )}

                        </div>

                        <div>

                          <p className="text-sm font-medium capitalize text-zinc-200">
                            {stepItem.step.replace(/_/g, " ")}
                          </p>

                          <p className="mt-1 text-xs text-zinc-600">
                            {stepItem.status === "completed"
                              ? "Successfully completed"
                              : "Pending execution"}
                          </p>

                        </div>

                        <Badge
                          variant="outline"
                          className="shrink-0 border-zinc-800 bg-transparent text-[11px] font-normal capitalize text-zinc-500"
                        >
                          {stepItem.status}
                        </Badge>

                      </div>

                    ))}

                  </div>
                </div>

              </div>
            </div>
          )}

          {/* dataset  */}

          {activeTab === "dataset" && (
            <div className="space-y-4">

              {/* dataset toolbar  */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div className="relative w-full sm:w-80">

                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-700" />

                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search dataset records..."
                    className="h-9 border-zinc-800 bg-zinc-950 pl-9 text-xs text-zinc-300 placeholder:text-zinc-700 focus:border-zinc-600 focus:ring-0"
                  />

                </div>

                <div className="flex items-center gap-2">

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeduplicate}
                    disabled={deduping}
                    className="h-9 border-zinc-800 bg-zinc-950 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                  >
                    <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />

                    {deduping ? "Processing..." : "Deduplicate"}
                  </Button>

                  <a
                    href={api.getExportUrl(workflow.id, "xlsx")}
                    download
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 border-emerald-800/40 bg-emerald-950/20 text-xs text-emerald-400 hover:bg-emerald-900/30 hover:text-emerald-300"
                    >
                      <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                      Excel (.xlsx)
                    </Button>
                  </a>

                  <a
                    href={api.getExportUrl(workflow.id, "csv")}
                    download
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 border-zinc-800 bg-zinc-950 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      CSV
                    </Button>
                  </a>

                  <a
                    href={api.getExportUrl(workflow.id, "json")}
                    download
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 border-zinc-800 bg-zinc-950 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      JSON
                    </Button>
                  </a>

                </div>

              </div>

              {/* dataset  */}
              <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">

                <div className="border-b border-zinc-800 px-5 py-4">

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                    <div>
                      <p className="text-sm font-medium text-zinc-200">
                        Collected Dataset
                      </p>

                      <p className="mt-1 text-xs text-zinc-600">
                        {records.length.toLocaleString()} records collected
                      </p>
                    </div>

                    <div className="flex items-center gap-1 rounded-md border border-zinc-800 bg-black p-0.5">
                      <button
                        type="button"
                        onClick={() => setViewMode("table")}
                        className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                          viewMode === "table"
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        <Table className="h-3.5 w-3.5" />
                        Spreadsheet View
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("json")}
                        className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                          viewMode === "json"
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        <Code2 className="h-3.5 w-3.5" />
                        JSON View
                      </button>
                    </div>

                  </div>

                </div>

                <div className="p-0">

                  {records.length > 0 ? (
                    viewMode === "table" ? (
                      <div className="overflow-x-auto">
                        {(() => {
                          const columns = Array.from(
                            new Set(
                              records.flatMap((r) =>
                                Object.keys(r.data || {}).filter(
                                  (k) => !k.startsWith("_")
                                )
                              )
                            )
                          );

                          return (
                            <table className="w-full border-collapse text-left text-xs">
                              <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400">
                                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-zinc-500 w-12 text-center">
                                    #
                                  </th>
                                  {columns.map((col) => (
                                    <th
                                      key={col}
                                      className="px-4 py-3 font-semibold uppercase tracking-wider text-zinc-300"
                                    >
                                      {col.replace(/_/g, " ")}
                                    </th>
                                  ))}
                                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-zinc-400">
                                    Source Link
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-850">
                                {records.map((record, idx) => (
                                  <tr
                                    key={record.id || idx}
                                    className="transition-colors hover:bg-zinc-900/40"
                                  >
                                    <td className="px-4 py-3 font-mono text-zinc-600 text-center">
                                      {idx + 1}
                                    </td>
                                    {columns.map((col) => {
                                      const val = record.data?.[col];
                                      const isUrl =
                                        typeof val === "string" &&
                                        (val.startsWith("http://") ||
                                          val.startsWith("https://"));

                                      if (col === "confidence_score") {
                                        return (
                                          <td key={col} className="px-4 py-3">
                                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                                              {val}%
                                            </span>
                                          </td>
                                        );
                                      }

                                      if (isUrl) {
                                        return (
                                          <td key={col} className="px-4 py-3">
                                            <a
                                              href={val as string}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 text-blue-400 hover:underline"
                                            >
                                              {val as string}
                                              <ExternalLink className="h-3 w-3" />
                                            </a>
                                          </td>
                                        );
                                      }

                                      return (
                                        <td
                                          key={col}
                                          className="px-4 py-3 text-zinc-300"
                                        >
                                          {val !== null && val !== undefined
                                            ? String(val)
                                            : "—"}
                                        </td>
                                      );
                                    })}
                                    <td className="px-4 py-3">
                                      {record.source ? (
                                        <a
                                          href={record.source}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-zinc-400 hover:text-white hover:underline"
                                        >
                                          {record.source.replace(/^https?:\/\//, "").slice(0, 30)}...
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="p-5">
                        <pre className="max-h-[600px] overflow-auto rounded-md border border-zinc-800 bg-black p-4 font-mono text-[11px] leading-5 text-zinc-400">
                          {JSON.stringify(records, null, 2)}
                        </pre>
                      </div>
                    )
                  ) : (
                    <div className="py-16 text-center">
                      <Database className="mx-auto mb-3 h-5 w-5 text-zinc-700" />
                      <p className="text-sm text-zinc-500">
                        No dataset records
                      </p>
                      <p className="mt-1 text-xs text-zinc-700">
                        Records collected by this workflow will appear here.
                      </p>
                    </div>
                  )}

                </div>

              </div>

            </div>
          )}

          {/* sources  */}

          {activeTab === "sources" && (
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">

              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">

                <div>

                  <p className="text-sm font-medium text-zinc-200">
                    Source lineage
                  </p>

                  <p className="mt-1 text-xs text-zinc-600">
                    URL provenance and extraction metrics.
                  </p>

                </div>

                <Globe className="h-4 w-4 text-zinc-700" />

              </div>

              <div className="overflow-x-auto">

                <table className="w-full min-w-[700px] text-left">

                  <thead>

                    <tr className="border-b border-zinc-800">

                      <th className="px-5 py-3.5 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                        Source
                      </th>

                      <th className="px-5 py-3.5 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                        Domain
                      </th>

                      <th className="px-5 py-3.5 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                        Status
                      </th>

                      <th className="px-5 py-3.5 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                        Records
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-zinc-800/70">

                    {sources.length > 0 ? (

                      sources.map((src, idx) => (

                        <tr
                          key={idx}
                          className="group transition-colors hover:bg-zinc-900/50"
                        >

                          <td className="px-5 py-4">

                            <a
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex max-w-md items-center gap-2 font-mono text-xs text-zinc-400 transition-colors hover:text-white"
                            >
                              <span className="truncate">
                                {src.url}
                              </span>

                              <ExternalLink className="h-3 w-3 shrink-0 text-zinc-700" />
                            </a>

                          </td>

                          <td className="px-5 py-4 font-mono text-xs text-zinc-600">
                            {src.domain}
                          </td>

                          <td className="px-5 py-4">

                            <Badge
                              variant="outline"
                              className="border-zinc-700 bg-transparent text-[11px] font-normal text-zinc-400"
                            >
                              {src.status}
                            </Badge>

                          </td>

                          <td className="px-5 py-4 text-sm text-zinc-400">
                            {src.recordsExtracted.toLocaleString()}
                          </td>

                        </tr>

                      ))

                    ) : (

                      <tr>

                        <td
                          colSpan={4}
                          className="px-5 py-16 text-center"
                        >

                          <Globe className="mx-auto mb-3 h-5 w-5 text-zinc-700" />

                          <p className="text-sm text-zinc-500">
                            No sources found
                          </p>

                          <p className="mt-1 text-xs text-zinc-700">
                            Source URLs will appear here after discovery.
                          </p>

                        </td>

                      </tr>

                    )}

                  </tbody>

                </table>

              </div>

            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}

// tab button 

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex shrink-0 items-center gap-2 px-3 pb-3 pt-1
        text-xs font-medium transition-colors
        ${
          active
            ? "text-white"
            : "text-zinc-600 hover:text-zinc-300"
        }
      `}
    >
      <Icon className="h-3.5 w-3.5" />

      {children}

      {active && (
        <span className="absolute bottom-0 left-2 right-2 h-px bg-white" />
      )}
    </button>
  );
}

