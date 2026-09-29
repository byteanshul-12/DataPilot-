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
  Sparkles,
  FileText,
} from "lucide-react";

export default function WorkflowDetails() {
  const { id } = useParams<{ id: string }>();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [activeTab, setActiveTab] = useState<
    "plan" | "stepper" | "dataset" | "sources"
  >("plan");

  // Dataset
  const [records, setRecords] = useState<DatasetRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewFormat, setViewFormat] = useState<"ui" | "json">("ui");

  // Sources
  const [sources, setSources] = useState<SourceItem[]>([]);

  // Deduplication
  const [dedupMatchField] = useState("name");
  const [dedupThreshold] = useState(85);
  const [deduping, setDeduping] = useState(false);

  useEffect(() => {
    if (!id) return;

    const loadDetails = () => {
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
    };

    loadDetails();

    const interval = setInterval(() => {
      loadDetails();
    }, 2000);

    return () => clearInterval(interval);
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
              active={activeTab === "plan"}
              onClick={() => setActiveTab("plan")}
              icon={Sparkles}
            >
              AI Plan & Response
            </TabButton>

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

          {/* AI Plan & Response */}
          {activeTab === "plan" && (
            <div className="space-y-6">

              {/* AI Response Card */}
              {workflow.aiResponse && (
                <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                  <div className="flex items-center gap-2 border-b border-zinc-800 px-5 py-3.5">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    <p className="text-sm font-medium text-white">AI Model Response</p>
                  </div>
                  <div className="p-5 text-sm leading-relaxed text-zinc-300">
                    {workflow.aiResponse}
                  </div>
                </div>
              )}

              {/* Workflow Execution Plan Card */}
              <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-400" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        Workflow & Scraper Execution Plan
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Dynamic multi-phase strategy generated by AI Model
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-zinc-800 bg-zinc-900 text-xs font-normal text-zinc-400">
                    Maxun Scraping Engine
                  </Badge>
                </div>

                <div className="p-6">
                  {workflow.planResponse ? (
                    <div className="prose prose-invert max-w-none space-y-4 font-mono text-xs leading-6 text-zinc-300 whitespace-pre-wrap rounded-md border border-zinc-800/80 bg-black/60 p-5">
                      {workflow.planResponse}
                    </div>
                  ) : (
                    <div className="py-10 text-center">
                      <FileText className="mx-auto mb-3 h-5 w-5 text-zinc-700" />
                      <p className="text-sm text-zinc-500">No execution plan generated</p>
                      <p className="mt-1 text-xs text-zinc-700">
                        Plans are dynamically created when initiating collection tasks.
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

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
                  <div className="flex items-center overflow-hidden rounded-md border border-zinc-800 bg-black p-0.5">
                    <button
                      onClick={() => setViewFormat("ui")}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors rounded-sm ${
                        viewFormat === "ui" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      UI List
                    </button>
                    <button
                      onClick={() => setViewFormat("json")}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors rounded-sm ${
                        viewFormat === "json" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Raw JSON
                    </button>
                  </div>

                </div>

              </div>

              {/* dataset  */}
              <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">

                <div className="border-b border-zinc-800 px-5 py-4">

                  <div className="flex items-center justify-between">

                    <div>
                      <p className="text-sm font-medium text-zinc-200">
                        Dataset Records
                      </p>

                      <p className="mt-1 text-xs text-zinc-600">
                        {records.filter((rec) => {
                          if (!searchQuery.trim()) return true;
                          const q = searchQuery.toLowerCase().trim();
                          const d = rec.data || {};
                          return JSON.stringify(d).toLowerCase().includes(q) || (rec.source || "").toLowerCase().includes(q);
                        }).length.toLocaleString()} {searchQuery ? "matching" : ""} records collected & validated
                      </p>
                    </div>

                    <Database className="h-4 w-4 text-zinc-700" />

                  </div>

                </div>

                <div className="p-5">

                  {(() => {
                    const filteredRecords = records.filter((rec) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase().trim();
                      const d = rec.data || {};
                      return JSON.stringify(d).toLowerCase().includes(q) || (rec.source || "").toLowerCase().includes(q);
                    });

                    if (filteredRecords.length > 0) {
                      return viewFormat === "ui" ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                                <th className="px-4 py-3">#</th>
                                <th className="px-4 py-3">Title / Role</th>
                                <th className="px-4 py-3">Organization</th>
                                <th className="px-4 py-3">Location</th>
                                <th className="px-4 py-3">Details / Salary</th>
                                <th className="px-4 py-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60 text-xs">
                              {filteredRecords.map((rec, idx) => {
                                const d = (rec.data || {}) as Record<string, any>;
                                const title = String(d.job_title || d.company_name || d.title || d.name || `Item ${idx + 1}`);
                                const org = String(d.company || d.category || d.industry || "—");
                                const loc = String(d.location || d.headquarters || "—");
                                const details = String(d.salary_range || d.funding_raised || d.key_skills || d.description || "—");
                                const link = String(d.apply_url || d.website || rec.source || "#");

                                return (
                                  <tr key={rec.id || idx} className="hover:bg-zinc-900/40 transition-colors">
                                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-600">{idx + 1}</td>
                                    <td className="px-4 py-3 font-medium text-zinc-100 max-w-xs truncate">{title}</td>
                                    <td className="px-4 py-3 text-zinc-400">{org}</td>
                                    <td className="px-4 py-3 text-zinc-400">{loc}</td>
                                    <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">{details}</td>
                                    <td className="px-4 py-3 text-right">
                                      <a
                                        href={link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                                      >
                                        <span>Source Link</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <pre className="max-h-[600px] overflow-auto rounded-md border border-zinc-800 bg-black p-4 font-mono text-[11px] leading-5 text-zinc-400">
                          {JSON.stringify(filteredRecords, null, 2)}
                        </pre>
                      );
                    }

                    return (
                      <div className="py-16 text-center">

                        <Database className="mx-auto mb-3 h-5 w-5 text-zinc-700" />

                        <p className="text-sm text-zinc-500">
                          {searchQuery ? `No records matching "${searchQuery}"` : "No dataset records"}
                        </p>

                        <p className="mt-1 text-xs text-zinc-700">
                          {searchQuery ? "Try searching for a different keyword." : "Records collected by this workflow will appear here."}
                        </p>

                      </div>
                    );
                  })()}

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

