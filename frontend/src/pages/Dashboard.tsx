import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { api } from "@/lib/api";
import { DashboardStats } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Layers,
  Activity,
  Database,
  Globe,
  ArrowRight,
  Loader2,
  Play,
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getDashboardStats().then(setStats).catch(console.error);
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) return;

    setLoading(true);

    try {
      await api.createTask(prompt);
      navigate("/workflows");
    } catch (err) {
      console.error("Failed to create task", err);
    } finally {
      setLoading(false);
    }
  };


  return (
    <AppLayout>
      <div className="relative w-full h-full overflow-hidden bg-black text-white">

        {/* grid  */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.070]"
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
                  

                  <h2 className="text-2xl font-semibold tracking-tight text-white mt-15 mb-15">
                    Collect Datas Easier Then Before
                  </h2>

                  
                </div>

                <form onSubmit={handleCreateTask}>

                  <div className="overflow-hidden rounded-lg border border-zinc-800 bg-black transition-colors focus-within:border-zinc-600">

                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g. Find the top 20 SaaS companies in India and collect their pricing, website, and funding information..."
                      className="min-h-[100px] resize-none border-0 bg-transparent px-4 py-4 text-sm text-zinc-100 placeholder:text-zinc-700 focus-visible:ring-0"
                    />

                    <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-3">

                     

                      <Button
                        type="submit"
                        disabled={loading || !prompt.trim()}
                        className="ml-auto h-9 rounded-md bg-white px-4 text-xs font-medium text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500"
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