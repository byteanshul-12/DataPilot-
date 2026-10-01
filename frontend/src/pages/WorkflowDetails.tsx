import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { api } from "@/lib/api";
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
  FileSpreadsheet,
  Table,
  Code2,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

export default function WorkflowDetails() {
  const { id } = useParams<{ id: string }>();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [activeTab, setActiveTab] = useState<
    "dataset" | "stepper" | "sources"
  >("dataset");
  const [showResult, setShowResult] = useState(false);

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
      api.getWorkflowById(id).then(setWorkflow).catch(console.error);

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

  const isGeneralPrompt =
    Boolean(
      workflow?.executionSteps?.some((s) => s.step === "general_response")
    ) ||
    Boolean(
      !workflow?.planResponse &&
        records.length === 0 &&
        !workflow?.recordsCount &&
        workflow?.status === "completed"
    );

  const isRunning =
    workflow?.status === "running" || workflow?.status === "queued";

  const handleDeduplicate = async () => {
    if (!id) return;

    setDeduping(true);

    try {
      await api.deduplicateDataset(id, dedupMatchField, dedupThreshold);

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
        <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.045]"
            style={{
              backgroundImage: `
                linear-gradient(to right, currentColor 1px, transparent 1px),
                linear-gradient(to bottom, currentColor 1px, transparent 1px)
              `,
              backgroundSize: "48px 48px",
            }}
          />

          <div className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <RotateCw className="h-4 w-4 animate-spin text-zinc-500" />
              </div>

              <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
      <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">

        {/* =====================================================
            BACKGROUND GRID
        ===================================================== */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025] dark:opacity-[0.035]"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">

          {/* =====================================================
              HEADER
          ===================================================== */}
          <div className="mb-7 border-b border-zinc-200 pb-7 dark:border-zinc-800">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">

              <div className="min-w-0">

                {/* Breadcrumb */}
                <div className="mb-4 flex items-center gap-2.5">
                  <Link
                    to="/workflows"
                    className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-200"
                  >
                    Workflows
                  </Link>

                  <span className="text-zinc-300 dark:text-zinc-700">
                    /
                  </span>

                  <StatusBadge status={workflow.status} />
                </div>

                <h1 className="max-w-3xl text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
                  {workflow.prompt}
                </h1>

                <p className="mt-2 truncate font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
                  {workflow.id}
                </p>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => api.rerunWorkflow(workflow.id)}
                  className="h-8 rounded-lg cursor-pointer border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-600 shadow-none hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                >
                  <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                  Rerun
                </Button>




                {workflow.status === "running" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => api.cancelWorkflow(workflow.id)}
                    className="h-8 rounded-lg border-red-200 bg-white px-3 text-xs font-medium text-red-500 shadow-none hover:bg-red-50 dark:border-red-500/20 dark:bg-zinc-950 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* =====================================================
              CASE 1 — GENERAL AI RESPONSE
          ===================================================== */}
          {isGeneralPrompt ? (
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-zinc-800/80 dark:bg-zinc-950 dark:shadow-[0_20px_60px_rgba(0,0,0,0.2)]">

              {/* Response Header */}
              <div className="flex items-center gap-3 border-b border-zinc-200/80 px-6 py-4 dark:border-zinc-800/80 sm:px-7">

                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                  <Sparkles className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    DataPilot
                  </p>

                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    AI Response
                  </p>
                </div>
              </div>

              {/* Response Content */}
              <div className="px-6 py-6 sm:px-7 sm:py-8">
                <div className="prose prose-zinc dark:prose-invert max-w-none text-sm leading-7 text-zinc-700 dark:text-zinc-300">
                  <MarkdownRenderer
                    content={workflow.aiResponse || "No response provided."}
                  />
                </div>
              </div>
            </div>

          ) : isRunning ? (

            /* =====================================================
               CASE 2A — TASK RUNNING
            ===================================================== */
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white px-6 py-12 text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-zinc-800/80 dark:bg-zinc-950 dark:shadow-[0_20px_60px_rgba(0,0,0,0.2)] sm:px-12 sm:py-16">

              {/* Subtle grid */}
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.025] dark:opacity-[0.035]"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, currentColor 1px, transparent 1px),
                    linear-gradient(to bottom, currentColor 1px, transparent 1px)
                  `,
                  backgroundSize: "32px 32px",
                }}
              />

              <div className="relative">

                {/* Scanning Animation */}
                <div className="relative mx-auto mb-7 flex h-24 w-24 items-center justify-center">
  {/* Outer animated ring */}
  <div className="absolute inset-0 rounded-full border border-zinc-300 opacity-30 animate-ping dark:border-zinc-700" />

  {/* Inner animated ring */}
  <div className="absolute inset-3 rounded-full border border-zinc-300/70 animate-pulse dark:border-zinc-700/70" />

  {/* Center */}
  <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
    <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-zinc-900 dark:bg-zinc-100" />
  </div>
</div> 

                {/* Status */}
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-900 dark:bg-zinc-100" />

                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                    Workflow Running
                  </span>
                </div>

                <h3 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-2xl">
                  Scraping & Extracting Data
                </h3>

                <p className="mx-auto mt-2 max-w-lg text-xs leading-6 text-zinc-500 dark:text-zinc-400 sm:text-sm">
                  Discovering target sources, executing browser workflows,
                  validating records, and preparing your dataset.
                </p>

                {/* Progress Tracker */}
                <div className="mx-auto mt-9 max-w-md space-y-2 text-left">

                  {/* Active */}
                  <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-900 dark:bg-zinc-100" />
                    </div>

                    <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                      Scanning permitted directories & corporate sites
                    </span>
                  </div>

                  {/* Processing */}
                  <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400 dark:bg-zinc-600" />
                    </div>

                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Extracting entity attributes & contact endpoints
                    </span>
                  </div>

                  {/* Pending */}
                  <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                    </div>

                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      Enriching profiles & preparing Excel
                    </span>
                  </div>
                </div>
              </div>
            </div>

          ) : !showResult ? (

            /* =====================================================
               CASE 2B — COMPLETED / SUMMARY
            ===================================================== */
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white px-6 py-10 text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-zinc-800/80 dark:bg-zinc-950 dark:shadow-[0_20px_60px_rgba(0,0,0,0.2)] sm:px-12 sm:py-14">

              {/* Success Icon */}
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <CheckCircle2 className="h-7 w-7 text-zinc-800 dark:text-zinc-200" />
              </div>

              {/* Status */}
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />

                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                  Workflow Complete
                </span>
              </div>

              <h3 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                Data Ready for Review
              </h3>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Your collected records have been processed and prepared for
                review, including available profiles and contact information.
              </p>

              {/* Metric Chips */}
              <div className="my-7 flex flex-wrap items-center justify-center gap-2.5">

                <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/70">
                  <Database className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />

                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {records.length || workflow.recordsCount || 20}
                  </span>

                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Records
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/70">
                  <Globe className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />

                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    Social Profiles
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/70">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />

                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    Excel Generated
                  </span>
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col items-center justify-center gap-2.5 sm:flex-row">

                <Button
                  size="lg"
                  onClick={() => {
                    setShowResult(true);
                    setActiveTab("dataset");
                  }}
                  className="h-10.5 rounded-lg bg-zinc-950 px-6 text-sm font-medium text-white shadow-sm transition-all hover:bg-zinc-800 hover:shadow-md dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 cursor-pointer"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Result
                </Button>

                <a
                  href={api.getExportUrl(workflow.id, "xlsx")}
                  download
                >
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-10.5 cursor-pointer rounded-lg border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-700 shadow-none hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Excel
                  </Button>
                </a>
              </div>
            </div>

          ) : (

            /* =====================================================
               CASE 2C — DATASET RESULT
            ===================================================== */
            <div>

              {/* =================================================
                  RESULTS ACTION BAR
              ================================================= */}
              <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-zinc-800/80 dark:bg-zinc-950 dark:shadow-[0_20px_60px_rgba(0,0,0,0.2)] sm:flex-row sm:items-center sm:justify-between">

                <div className="flex items-center gap-3">

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowResult(false)}
                    className="h-8 gap-1.5 rounded-lg border-zinc-200 bg-white px-2.5 text-xs text-zinc-500 shadow-none hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Summary</span>
                  </Button>

                  <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800" />

                  <div className="flex items-center gap-2.5">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Collected Dataset
                    </p>

                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {records.length || workflow.recordsCount || 20} records
                    </span>

                    <span className="hidden items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 sm:inline-flex">
                      <span className="h-1 w-1 rounded-full bg-zinc-700 dark:bg-zinc-300" />
                      Verified
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={api.getExportUrl(workflow.id, "xlsx")}
                    download
                  >
                    <Button
                      size="sm"
                      className="h-9 cursor-pointer rounded-lg bg-zinc-950 px-4 text-xs font-medium text-white shadow-sm transition-all hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download Excel
                    </Button>
                  </a>
                </div>
              </div>

              {/* =================================================
                  RESULT TABS
              ================================================= */}
              <div className="mb-7 flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">

                <TabButton
                  active={activeTab === "dataset"}
                  onClick={() => setActiveTab("dataset")}
                  icon={Database}
                >
                  Dataset Records {records.length > 0 && `(${records.length})`}
                </TabButton>

                <TabButton
                  active={activeTab === "stepper"}
                  onClick={() => setActiveTab("stepper")}
                  icon={Layers}
                >
                  Execution Timeline
                </TabButton>

                <TabButton
                  active={activeTab === "sources"}
                  onClick={() => setActiveTab("sources")}
                  icon={Globe}
                >
                  Source Lineage
                </TabButton>

              </div>

              {/* =================================================
                  EXECUTION TIMELINE
              ================================================= */}
              {activeTab === "stepper" && (
                <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-zinc-800/80 dark:bg-zinc-950 dark:shadow-[0_20px_60px_rgba(0,0,0,0.18)]">

                  <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
                      Execution pipeline
                    </p>

                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-600">
                      Multi-agent workflow execution steps.
                    </p>
                  </div>

                  <div className="p-6">
                    <div className="relative pl-8">

                      {/* Timeline line */}
                      <div className="absolute bottom-3 left-[11px] top-3 w-px bg-zinc-200 dark:bg-zinc-800" />

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
                            <div className="absolute -left-8 flex h-6 w-6 items-center justify-center bg-white dark:bg-zinc-950">
                              {stepItem.status === "completed" ? (
                                <CheckCircle2 className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                              ) : (
                                <Clock className="h-4 w-4 text-zinc-400 dark:text-zinc-700" />
                              )}
                            </div>

                            <div>
                              <p className="text-sm font-medium capitalize text-zinc-900 dark:text-zinc-200">
                                {stepItem.step.replace(/_/g, " ")}
                              </p>

                              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-600">
                                {stepItem.status === "completed"
                                  ? "Successfully completed"
                                  : "Pending execution"}
                              </p>
                            </div>

                            <Badge
                              variant="outline"
                              className="shrink-0 rounded-full border-zinc-200 bg-zinc-50 text-[10px] font-medium capitalize text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500"
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

              {/* =================================================
                  DATASET
              ================================================= */}
              {activeTab === "dataset" && (
                <div className="space-y-4">

                  {/* Dataset Toolbar */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                    <div className="relative w-full sm:w-80">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-600" />

                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search dataset records..."
                        className="h-9 rounded-lg border-zinc-200 bg-white pl-9 text-xs text-zinc-800 shadow-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-0 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:placeholder:text-zinc-700 dark:focus:border-zinc-600"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeduplicate}
                        disabled={deduping}
                        className="h-9 cursor-pointer rounded-lg border-zinc-200 bg-white text-xs text-zinc-500 shadow-none hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
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
                          className="h-9 rounded-lg cursor-pointer border-zinc-200 bg-white text-xs text-zinc-600 shadow-none hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                        >
                          <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                          Excel
                        </Button>
                      </a>

                      <a
                        href={api.getExportUrl(workflow.id, "csv")}
                        download
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-lg cursor-pointer  border-zinc-200 bg-white text-xs text-zinc-500 shadow-none hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
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
                          className="h-9 rounded-lg cursor-pointer  border-zinc-200 bg-white text-xs text-zinc-500 shadow-none hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                        >
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          JSON
                        </Button>
                      </a>
                    </div>
                  </div>

                  {/* Dataset Card */}
                  <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-zinc-800/80 dark:bg-zinc-950 dark:shadow-[0_20px_60px_rgba(0,0,0,0.18)]">

                    <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
                            Dataset Records
                          </p>

                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-600">
                            {records
                              .filter((rec) => {
                                if (!searchQuery.trim()) return true;

                                const q = searchQuery.toLowerCase().trim();
                                const d = rec.data || {};

                                return (
                                  JSON.stringify(d)
                                    .toLowerCase()
                                    .includes(q) ||
                                  (rec.source || "")
                                    .toLowerCase()
                                    .includes(q)
                                );
                              })
                              .length.toLocaleString()}{" "}
                            {searchQuery ? "matching" : ""} records collected &
                            validated
                          </p>
                        </div>

                        {/* View Toggle */}
                        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">

                          <button
                            type="button"
                            onClick={() => setViewFormat("ui")}
                            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                              viewFormat === "ui"
                                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300"
                            }`}
                          >
                            <Table className="h-3.5 w-3.5" />
                            UI List
                          </button>

                          <button
                            type="button"
                            onClick={() => setViewFormat("json")}
                            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                              viewFormat === "json"
                                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300"
                            }`}
                          >
                            <Code2 className="h-3.5 w-3.5" />
                            Raw JSON
                          </button>

                        </div>
                      </div>
                    </div>

                    <div className="p-0">
                      {(() => {
                        const filteredRecords = records.filter((rec) => {
                          if (!searchQuery.trim()) return true;

                          const q = searchQuery.toLowerCase().trim();
                          const d = rec.data || {};

                          return (
                            JSON.stringify(d).toLowerCase().includes(q) ||
                            (rec.source || "").toLowerCase().includes(q)
                          );
                        });

                        if (filteredRecords.length > 0) {
                          return viewFormat === "ui" ? (
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse text-left">

                                <thead>
                                  <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-500">
                                    <th className="px-4 py-3">#</th>
                                    <th className="px-4 py-3">Title / Role</th>
                                    <th className="px-4 py-3">Company / Org</th>
                                    <th className="px-4 py-3">Location</th>
                                    <th className="px-4 py-3">
                                      Details / Salary
                                    </th>
                                    <th className="px-4 py-3">
                                      Social & Profiles
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                      Action
                                    </th>
                                  </tr>
                                </thead>

                                <tbody className="divide-y divide-zinc-200 text-xs dark:divide-zinc-800/70">
                                  {filteredRecords.map((rec, idx) => {
                                    const d = (rec.data || {}) as Record<
                                      string,
                                      any
                                    >;

                                    const title = String(
                                      d.job_title ||
                                        d.company_name ||
                                        d.title ||
                                        d.name ||
                                        `Item ${idx + 1}`
                                    );

                                    const org = String(
                                      d.company ||
                                        d.organization ||
                                        d.category ||
                                        d.industry ||
                                        "—"
                                    );

                                    const loc = String(
                                      d.location ||
                                        d.headquarters ||
                                        "—"
                                    );

                                    const details = String(
                                      d.salary_range
                                        ? `${d.salary_range} • ${
                                            d.tech_stack || ""
                                          }`
                                        : d.funding_raised ||
                                            d.key_skills ||
                                            d.key_attributes ||
                                            d.description ||
                                            "—"
                                    );

                                    const link = String(
                                      d.apply_url ||
                                        d.website ||
                                        rec.source ||
                                        "#"
                                    );

                                    return (
                                      <tr
                                        key={rec.id || idx}
                                        className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                                      >
                                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-400 dark:text-zinc-600">
                                          {idx + 1}
                                        </td>

                                        <td className="max-w-xs truncate px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                                          {title}
                                        </td>

                                        <td className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                                          {org}
                                        </td>

                                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                                          {loc}
                                        </td>

                                        <td
                                          className="max-w-xs truncate px-4 py-3 text-zinc-500 dark:text-zinc-400"
                                          title={details}
                                        >
                                          {details}
                                        </td>

                                        <td className="px-4 py-3">
                                          <div className="flex max-w-xs flex-wrap items-center gap-1.5">

                                            {d.linkedin && (
                                              <a
                                                href={d.linkedin}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                                              >
                                                <span>LinkedIn</span>
                                                <ExternalLink className="h-2.5 w-2.5" />
                                              </a>
                                            )}

                                            {d.github && (
                                              <a
                                                href={d.github}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                                              >
                                                <span>GitHub</span>
                                                <ExternalLink className="h-2.5 w-2.5" />
                                              </a>
                                            )}

                                            {d.twitter && (
                                              <a
                                                href={d.twitter}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                                              >
                                                <span>X / Twitter</span>
                                                <ExternalLink className="h-2.5 w-2.5" />
                                              </a>
                                            )}

                                            {d.contact_email &&
                                              !d.linkedin &&
                                              !d.github && (
                                                <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                                                  {d.contact_email}
                                                </span>
                                              )}

                                            {!d.linkedin &&
                                              !d.github &&
                                              !d.twitter &&
                                              !d.contact_email && (
                                                <span className="text-zinc-400 dark:text-zinc-700">
                                                  —
                                                </span>
                                              )}
                                          </div>
                                        </td>

                                        <td className="px-4 py-3 text-right">
                                          <a
                                            href={link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                                          >
                                            <span>
                                              {d.apply_url
                                                ? "Apply"
                                                : "Source Link"}
                                            </span>

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
                            <pre className="max-h-[600px] overflow-auto bg-zinc-950 p-4 font-mono text-[11px] leading-5 text-zinc-400 dark:bg-black">
                              {JSON.stringify(filteredRecords, null, 2)}
                            </pre>
                          );
                        }

                        return (
                          <div className="py-16 text-center">
                            <Database className="mx-auto mb-3 h-5 w-5 text-zinc-400 dark:text-zinc-700" />

                            <p className="text-sm text-zinc-500">
                              {searchQuery
                                ? `No records matching "${searchQuery}"`
                                : "No dataset records"}
                            </p>

                            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-700">
                              {searchQuery
                                ? "Try searching for a different keyword."
                                : "Records collected by this workflow will appear here."}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================
                  SOURCE LINEAGE
              ================================================= */}
              {activeTab === "sources" && (
                <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:border-zinc-800/80 dark:bg-zinc-950 dark:shadow-[0_20px_60px_rgba(0,0,0,0.18)]">

                  <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">

                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
                        Source lineage
                      </p>

                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-600">
                        URL provenance and extraction metrics.
                      </p>
                    </div>

                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                      <Globe className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-600" />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left">

                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800">

                          <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                            Source
                          </th>

                          <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                            Domain
                          </th>

                          <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                            Status
                          </th>

                          <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                            Records
                          </th>

                        </tr>
                      </thead>

                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/70">

                        {sources.length > 0 ? (
                          sources.map((src, idx) => (
                            <tr
                              key={idx}
                              className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                            >

                              <td className="px-5 py-4">
                                <a
                                  href={src.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex max-w-md items-center gap-2 font-mono text-xs text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                                >
                                  <span className="truncate">
                                    {src.url}
                                  </span>

                                  <ExternalLink className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-700" />
                                </a>
                              </td>

                              <td className="px-5 py-4 font-mono text-xs text-zinc-500 dark:text-zinc-600">
                                {src.domain}
                              </td>

                              <td className="px-5 py-4">
                                <Badge
                                  variant="outline"
                                  className="rounded-full border-zinc-200 bg-zinc-50 text-[10px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                                >
                                  {src.status}
                                </Badge>
                              </td>

                              <td className="px-5 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                                {src.recordsExtracted.toLocaleString()}
                              </td>

                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-5 py-16 text-center">

                              <Globe className="mx-auto mb-3 h-5 w-5 text-zinc-400 dark:text-zinc-700" />

                              <p className="text-sm text-zinc-500">
                                No sources found
                              </p>

                              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-700">
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
          )}
        </div>
      </div>
    </AppLayout>
  );
}

/* =========================================================
   TAB BUTTON
========================================================= */

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
      type="button"
      onClick={onClick}
      className={`
        relative flex shrink-0 items-center gap-2 px-3 pb-3 pt-1
        text-xs font-medium transition-colors
        ${
          active
            ? "text-zinc-950 dark:text-white"
            : "text-zinc-400 hover:text-zinc-800 dark:text-zinc-600 dark:hover:text-zinc-300"
        }
      `}
    >
      <Icon className="h-3.5 w-3.5" />

      {children}

      {active && (
        <span className="absolute bottom-0 left-2 right-2 h-px bg-zinc-950 dark:bg-white" />
      )}
    </button>
  );
}


