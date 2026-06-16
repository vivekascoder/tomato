import { CalendarDays, CheckCircle2, Clock3, FileText, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { LogData, SessionAnnotation, WorkSession } from "./types";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short"
});

const dayFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "2-digit",
  month: "short"
});

const chartConfig = {
  completed: {
    label: "Completed",
    color: "var(--chart-2)"
  },
  stopped: {
    label: "Stopped early",
    color: "var(--chart-1)"
  }
} satisfies ChartConfig;

function formatDuration(seconds: number) {
  const rounded = Math.round(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  if (mins === 0) return `${secs}s`;
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
}

function dayKey(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(timestamp * 1000));
}

function buildChartData(sessions: WorkSession[]) {
  const days = new Map<string, { day: string; completed: number; stopped: number }>();

  for (const session of sessions) {
    const key = dayKey(session.start);
    const row = days.get(key) ?? {
      day: dayFormatter.format(new Date(session.start * 1000)),
      completed: 0,
      stopped: 0
    };

    row[session.result] += Number((session.durationSeconds / 60).toFixed(2));
    days.set(key, row);
  }

  return [...days.values()];
}

export default function App() {
  const [data, setData] = useState<LogData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, SessionAnnotation>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const next = await window.pomodoro.getLogData();
      setData(next);
      setDrafts(
        Object.fromEntries(
          next.sessions.map((session) => [
            session.id,
            {
              title: session.title
            }
          ])
        )
      );
      setSaveStates({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to read the TomatoBar log.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const sessions = data?.sessions ?? [];

  const summary = useMemo(() => {
    const totalSeconds = sessions.reduce((sum, session) => sum + session.durationSeconds, 0);
    return {
      totalSeconds,
      completed: sessions.filter((session) => session.result === "completed").length,
      stopped: sessions.filter((session) => session.result === "stopped").length,
      activeDays: new Set(sessions.map((session) => dayKey(session.start))).size
    };
  }, [sessions]);

  const chartData = useMemo(() => buildChartData(sessions), [sessions]);

  function updateDraft(sessionId: string, title: string) {
    setDrafts((current) => ({
      ...current,
      [sessionId]: {
        title
      }
    }));
    setSaveStates((current) => ({ ...current, [sessionId]: "dirty" }));
  }

  async function saveSession(sessionId: string) {
    const draft = drafts[sessionId] ?? { title: "" };
    setSaveStates((current) => ({ ...current, [sessionId]: "saving" }));

    try {
      await window.pomodoro.saveAnnotation(sessionId, draft);
      setSaveStates((current) => ({ ...current, [sessionId]: "saved" }));
    } catch {
      setSaveStates((current) => ({ ...current, [sessionId]: "error" }));
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col gap-3 bg-background p-3 text-foreground">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">TomatoBar</p>
          <h1 className="truncate font-heading text-2xl font-semibold tracking-normal">Pomodoro</h1>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" size="icon" variant="outline" onClick={() => void loadData()} disabled={loading} title="Refresh log">
            <RefreshCw data-icon="inline-start" />
          </Button>
          <Button type="button" size="icon" variant="outline" onClick={() => void window.pomodoro.showLogFile()} title="Show log file">
            <FileText data-icon="inline-start" />
          </Button>
        </div>
      </header>

      {error ? (
        <Card size="sm" className="border-destructive/30 bg-destructive/5">
          <CardContent className="text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <section className="grid grid-cols-2 gap-2" aria-label="Pomodoro summary">
        <Metric icon={<Clock3 />} label="Work" value={formatDuration(summary.totalSeconds)} />
        <Metric icon={<CheckCircle2 />} label="Done" value={`${summary.completed}`} />
        <Metric icon={<RefreshCw />} label="Stopped" value={`${summary.stopped}`} />
        <Metric icon={<CalendarDays />} label="Days" value={`${summary.activeDays}`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Daily Focus</CardTitle>
          <CardDescription>{sessions.length} blocks from TomatoBar</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-[190px] w-full rounded-lg" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : chartData.length === 0 ? (
            <Empty className="min-h-[190px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Clock3 />
                </EmptyMedia>
                <EmptyTitle>No blocks yet</EmptyTitle>
                <EmptyDescription>Start a TomatoBar work timer to populate this chart.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} tickMargin={8} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="stopped" stackId="focus" fill="var(--color-stopped)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" stackId="focus" fill="var(--color-completed)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-2">
        {sessions.map((session) => {
          const draft = drafts[session.id] ?? { title: "" };
          const saveState = saveStates[session.id] ?? "idle";

          return (
            <Card size="sm" key={session.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>{formatDuration(session.durationSeconds)}</span>
                  <Badge variant={session.result === "completed" ? "default" : "secondary"}>
                    {session.result === "completed" ? "Done" : "Stopped"}
                  </Badge>
                </CardTitle>
                <CardDescription>{timeFormatter.format(new Date(session.start * 1000))}</CardDescription>
                <CardAction>
                  <Button type="button" size="icon-sm" variant="outline" disabled={saveState === "saving"} onClick={() => void saveSession(session.id)} title="Save title">
                    <Save data-icon="inline-start" />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={`title-${session.id}`}>Title</FieldLabel>
                    <Input
                      id={`title-${session.id}`}
                      value={draft.title}
                      placeholder="What did this block move?"
                      onChange={(event) => updateDraft(session.id, event.target.value)}
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter className="justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground">Ended {timeFormatter.format(new Date(session.end * 1000))}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : saveState === "error" ? "Retry" : ""}
                </span>
              </CardFooter>
            </Card>
          );
        })}
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">{icon}</div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
