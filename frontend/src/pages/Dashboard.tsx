import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { api } from "@/lib/api";
import { DashboardStats } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Layers,
  Activity,
  Database,
  Globe,
  ArrowRight,
  Loader2,
  Play,
  Paperclip,
  FileText,
  X,
  Image as ImageIcon,
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  // File Upload State
  const [attachedFile, setAttachedFile] = useState<{
    file: File;
    previewUrl?: string;
    content?: string;
    name: string;
    size: string;
    type: string;
    isImage: boolean;
    isPdf: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isMac =
    typeof window !== "undefined" &&
    /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent || navigator.platform || "");

  useEffect(() => {
    api.getDashboardStats().then(setStats).catch(console.error);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileProcess = async (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isTextual =
      file.type.startsWith("text/") ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".json") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md");

    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
    let content: string | undefined = undefined;

    if (isTextual && file.size < 5 * 1024 * 1024) {
      try {
        content = await file.text();
      } catch (e) {
        console.warn("Failed to read file text content", e);
      }
    }

    setAttachedFile({
      file,
      previewUrl,
      content,
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type || "application/octet-stream",
      isImage,
      isPdf,
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleRemoveFile = () => {
    if (attachedFile?.previewUrl) {
      URL.revokeObjectURL(attachedFile.previewUrl);
    }
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleCreateTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const fileMeta = attachedFile
      ? `[Attached File: ${attachedFile.name} (${attachedFile.isPdf ? "PDF Document" : attachedFile.isImage ? "Image/Photo" : "File"}, Size: ${attachedFile.size})]${
          attachedFile.content
            ? `\n\nFile Content Preview:\n\`\`\`\n${attachedFile.content.slice(0, 30000)}\n\`\`\``
            : ""
        }`
      : "";

    const finalPrompt = prompt.trim()
      ? (fileMeta ? `${fileMeta}\n\n${prompt.trim()}` : prompt.trim())
      : (attachedFile ? `Analyze attached ${attachedFile.isPdf ? "PDF document" : attachedFile.isImage ? "photo" : "file"} (${attachedFile.name}) and extract all key data.` : "");

    if (!finalPrompt || loading) return;

    setLoading(true);

    try {
      await api.createTask(finalPrompt);
      if (attachedFile?.previewUrl) {
        URL.revokeObjectURL(attachedFile.previewUrl);
      }
      navigate("/workflows");
    } catch (err: any) {
      console.error("Failed to create task", err);
      toast.error(err?.response?.data?.message || err?.message || "Failed to create workflow task");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 1. Ignore if in IME composition or macOS inline predictive text
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }

    // 2. Identify the Enter/Return key across all OS and browsers
    const isEnterKey =
      e.key === "Enter" ||
      e.key === "Return" ||
      e.code === "Enter" ||
      e.code === "NumpadEnter" ||
      e.keyCode === 13 ||
      e.which === 13;

    if (!isEnterKey) return;

    // 3. Modifier handling:
    // - Shift + Enter: allow newline in textarea
    // - Cmd + Enter (Mac: e.metaKey): force submit
    // - Ctrl + Enter (PC/Mac: e.ctrlKey): force submit
    // - Plain Enter (without Shift): submit
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;

    if (e.shiftKey && !isCmdOrCtrl) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (!prompt.trim() && !attachedFile) {
      toast.info("Please enter a prompt or attach a file first.");
      return;
    }

    if (loading) return;

    handleCreateTask();
  };


  return (
    <AppLayout>
      <div className="relative w-full h-full overflow-hidden bg-black text-white">

        {/* grid  */}
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

        <div className="relative mx-auto max-w-6xl space-y-10 px-6 py-10">

          

          {/* main  */}
          <section>

            

           

              <div className="mx-auto max-w-3xl">

                <div className="mb-7 text-center">
                  

                  <h2 className="text-4xl font-semibold tracking-tight text-white mt-15 mb-15 text-shadow-lg shadow-blue-500/50">
                    Collect Datas Easier Then Before
                  </h2>

                  
                </div>

                <form ref={formRef} onSubmit={handleCreateTask} onKeyDown={handleKeyDown}>

                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative overflow-hidden rounded-xl border bg-black transition-all ${
                      isDragging
                        ? "border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-950/20 ring-1 ring-emerald-500"
                        : "border-zinc-800 focus-within:border-zinc-600"
                    }`}
                  >

                    {/* Attached File Preview Chip */}
                    {attachedFile && (
                      <div className="mx-3 mt-3 flex items-center justify-between rounded-lg border border-zinc-800/90 bg-zinc-900/90 p-2.5 backdrop-blur-sm">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {attachedFile.isImage && attachedFile.previewUrl ? (
                            <img
                              src={attachedFile.previewUrl}
                              alt="Upload preview"
                              className="h-10 w-10 shrink-0 rounded-md border border-zinc-700 object-cover"
                            />
                          ) : attachedFile.isImage ? (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-sky-800/60 bg-sky-950/80 text-sky-400">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                          ) : attachedFile.isPdf ? (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-red-800/60 bg-red-950/80 text-red-400">
                              <span className="font-mono text-[11px] font-bold">PDF</span>
                            </div>
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300">
                              <FileText className="h-5 w-5" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1 overflow-hidden">
                            <p className="truncate text-xs font-medium text-zinc-100" title={attachedFile.name}>
                              {attachedFile.name}
                            </p>
                            <p className="text-[10px] text-zinc-500">
                              {attachedFile.isPdf ? "PDF Document" : attachedFile.isImage ? "Photo / Image" : "Document"} • {attachedFile.size}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                          title="Remove file"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        attachedFile
                          ? `Ask anything about ${attachedFile.name} (e.g. extract contacts, parse tables) or hit Enter to run...`
                          : "e.g. Find the top 20 SaaS companies in India and collect their pricing, website, and funding information..."
                      }
                      className="min-h-[100px] resize-none border-0 bg-transparent px-4 py-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-0"
                    />

                    {isDragging && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xs">
                        <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                          <Paperclip className="h-4 w-4 animate-bounce" />
                          <span>Drop your PDF, Photo, or file here</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-zinc-800/80 px-3 py-2.5">

                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                          accept=".pdf,image/*,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.txt"
                          className="hidden"
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-8 gap-1.5 rounded-md px-2.5 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
                          title="Attach PDF, Photo, or File"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="text-xs">Attach file</span>
                        </Button>

                        <span className="text-[11px] text-zinc-500 hidden sm:inline-flex items-center gap-1">
                          Press <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 font-mono text-[10px] text-zinc-300">{isMac ? "Return ↵" : "Enter ↵"}</kbd>
                          {isMac && (
                            <>
                              {" or "}
                              <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 font-mono text-[10px] text-zinc-300">⌘ Return</kbd>
                            </>
                          )}
                          {" to run"}
                        </span>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading || (!prompt.trim() && !attachedFile)}
                        className="ml-auto h-9 rounded-md bg-white px-4 text-xs font-medium text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-3.5 w-3.5" />
                            Run workflow
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                </form>

              </div>
          
          </section>

          {/* stats  */}
          <section>
            <div className="mb-4">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-zinc-600">
                Overview
              </p>
            </div>

            <div className="grid grid-cols-1 divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">

              <MetricCard
                title="Total Workflows"
                value={stats?.totalWorkflows ?? 0}
                icon={Layers}
                description="Active & completed"
              />

              <MetricCard
                title="Active Tasks"
                value={stats?.activeTasks ?? 0}
                icon={Activity}
                description="Currently processing"
                highlight={Boolean(stats?.activeTasks)}
              />

              <MetricCard
                title="Records Collected"
                value={stats?.totalRecordsCollected ?? 0}
                icon={Database}
                description="Data points extracted"
              />

              <MetricCard
                title="Sources Processed"
                value={stats?.totalSourcesProcessed ?? 0}
                icon={Globe}
                description="Websites & APIs"
              />

            </div>
          </section>

          {/* recent workflows  */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-zinc-600">
                  Activity
                </p>

                <h2 className="mt-1 text-lg font-medium text-white">
                  Recent workflows
                </h2>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/workflows")}
                className="text-xs text-zinc-500 hover:bg-zinc-900 hover:text-white"
              >
                View all
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>

            <Card className="overflow-hidden rounded-lg border-zinc-800 bg-zinc-950 shadow-none">

              <CardContent className="p-0">

                {stats?.recentActivity &&
                stats.recentActivity.length > 0 ? (
                  <div className="divide-y divide-zinc-800">

                    {stats.recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="group flex items-center justify-between px-5 py-4 transition-colors hover:bg-zinc-900/60"
                      >
                        <div className="flex min-w-0 items-center gap-4">

                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
                            <Layers className="h-3.5 w-3.5 text-zinc-500" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-200">
                              {activity.title}
                            </p>

                            <p className="mt-1 text-xs text-zinc-600">
                              {activity.timestamp}
                            </p>
                          </div>

                        </div>

                        <Badge
                          variant="outline"
                          className="ml-4 shrink-0 border-zinc-800 bg-transparent text-xs font-normal text-zinc-500"
                        >
                          {activity.status}
                        </Badge>

                      </div>
                    ))}

                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">

                    

                    <p className="text-sm text-zinc-400">
                      No workflows yet
                    </p>

                    <p className="mt-1 max-w-sm text-xs text-zinc-600">
                      Launch a workflow above and your recent activity will
                      appear here.
                    </p>

                  </div>
                )}

              </CardContent>
            </Card>
          </section>

        </div>
      </div>
    </AppLayout>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  highlight = false,
}: {
  title: string;
  value: number;
  icon: any;
  description: string;
  highlight?: boolean;
}) {
  return (
    <div className="group px-5 py-5 transition-colors hover:bg-zinc-900/50">

      <div className="flex items-center justify-between">

        <span className="text-xs text-zinc-500">
          {title}
        </span>

        <Icon
          className={`h-3.5 w-3.5 ${
            highlight ? "text-emerald-500" : "text-zinc-700"
          }`}
        />

      </div>

      <div className="mt-4">

        <div className="text-2xl font-semibold tracking-tight text-white">
          {value.toLocaleString()}
        </div>

        <p className="mt-1 text-xs text-zinc-600">
          {description}
        </p>

      </div>
    </div>
  );
}