import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, FileText, Moon, Pencil, RefreshCw, Save, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { LogData, SessionAnnotation, WorkSession } from "./types";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type SessionFilter = "all" | "completed" | "stopped";

const iconButtonClass = "size-8 rounded-full border-0 p-2 shadow-none hover:bg-muted [&_svg]:size-3.5";

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short"
});

const compactStartFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

const relativeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto"
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

function formatRelativeTime(timestamp: number) {
  const diffSeconds = timestamp - Date.now() / 1000;
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) return relativeFormatter.format(Math.round(diffSeconds), "second");
  if (absSeconds < 3600) return relativeFormatter.format(Math.round(diffSeconds / 60), "minute");
  if (absSeconds < 86400) return relativeFormatter.format(Math.round(diffSeconds / 3600), "hour");
  if (absSeconds < 604800) return relativeFormatter.format(Math.round(diffSeconds / 86400), "day");
  return relativeFormatter.format(Math.round(diffSeconds / 604800), "week");
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
  const days = new Map<string, { day: string; completed: number }>();

  for (const session of sessions.filter((item) => item.result === "completed")) {
    const key = dayKey(session.start);
    const row = days.get(key) ?? {
      day: dayFormatter.format(new Date(session.start * 1000)),
      completed: 0
    };

    row.completed += Number((session.durationSeconds / 60).toFixed(2));
    days.set(key, row);
  }

  return [...days.values()];
}

export default function App() {
  const [data, setData] = useState<LogData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, SessionAnnotation>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showBlocks, setShowBlocks] = useState(false);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    const interval = window.setInterval(() => {
      void loadData(true);
    }, 10000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("pomodoro-theme");
    const nextTheme = stored === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");

    const storedFilter = window.localStorage.getItem("pomodoro-session-filter");
    if (storedFilter === "completed" || storedFilter === "stopped" || storedFilter === "all") {
      setSessionFilter(storedFilter);
    }
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem("pomodoro-theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }

  const sessions = data?.sessions ?? [];
  const filteredSessions = useMemo(
    () => sessions.filter((session) => sessionFilter === "all" || session.result === sessionFilter),
    [sessions, sessionFilter]
  );

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

  function updateSessionFilter(filter: SessionFilter) {
    setSessionFilter(filter);
    window.localStorage.setItem("pomodoro-session-filter", filter);
  }

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
    <main className="relative h-svh w-full overflow-hidden bg-background text-foreground">
      <motion.div
        className="flex h-full w-[200%]"
        animate={{ x: showBlocks ? "-50%" : "0%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Tomato Screen */}
        <div className="flex h-full w-1/2 flex-col gap-3 overflow-y-auto p-3">
          <header className="flex items-center justify-between gap-3 border-b bg-background px-3 py-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="truncate font-heading text-2xl font-semibold tracking-normal">🍅 Tomato</h1>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={iconButtonClass}
                onClick={() => void window.pomodoro.showLogFile()}
                title="Show log file"
              >
                <FileText data-icon="inline-start" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={iconButtonClass}
                onClick={toggleTheme}
                title="Toggle theme"
              >
                {theme === "dark" ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
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
                    <Bar dataKey="completed" fill="var(--color-completed)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="mx-auto inline-flex w-fit items-center gap-2 border-b border-dashed border-muted-foreground pb-0.5 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setShowBlocks(true)}
          >
            View {sessions.length} work blocks
            <ArrowRight data-icon="inline-start" className="size-3.5" />
          </motion.button>
        </div>

        {/* Work Blocks Screen */}
        <div className="flex h-full w-1/2 flex-col overflow-y-auto bg-background">
          <header className="sticky top-0 z-10 flex flex-row items-center gap-3 border-b bg-popover/95 px-3 py-3 shadow-sm backdrop-blur">
            <Button type="button" size="icon" variant="ghost" className={iconButtonClass} onClick={() => setShowBlocks(false)} title="Back">
              <ArrowLeft data-icon="inline-start" />
            </Button>
            <div className="min-w-0">
              <h2 className="truncate font-heading text-xl font-semibold">Work Blocks</h2>
              <p className="truncate text-xs text-muted-foreground">
                {filteredSessions.length} of {sessions.length} Pomodoro blocks
              </p>
            </div>
          </header>

          <div className="flex flex-col gap-2 px-3 pb-3 pt-2">
            <FilterBadges
              activeFilter={sessionFilter}
              completedCount={summary.completed}
              stoppedCount={summary.stopped}
              totalCount={sessions.length}
              onChange={updateSessionFilter}
            />

            <SessionList
              sessions={filteredSessions}
              drafts={drafts}
              saveStates={saveStates}
              inputRefs={inputRefs}
              activeFilter={sessionFilter}
              onFilterChange={updateSessionFilter}
              updateDraft={updateDraft}
              saveSession={saveSession}
            />
          </div>
        </div>
      </motion.div>
    </main>
  );
}

function SessionList({
  sessions,
  drafts,
  saveStates,
  inputRefs,
  activeFilter,
  onFilterChange,
  updateDraft,
  saveSession
}: {
  sessions: WorkSession[];
  drafts: Record<string, SessionAnnotation>;
  saveStates: Record<string, SaveState>;
  inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  activeFilter: SessionFilter;
  onFilterChange: (filter: SessionFilter) => void;
  updateDraft: (sessionId: string, title: string) => void;
  saveSession: (sessionId: string) => Promise<void>;
}) {
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());

  if (sessions.length === 0) {
    return (
      <Empty className="min-h-[360px]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Clock3 />
          </EmptyMedia>
          <EmptyTitle>No work blocks</EmptyTitle>
          <EmptyDescription>TomatoBar sessions will show up here after you run a work timer.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  function enterEdit(sessionId: string) {
    setEditingIds((prev) => new Set(prev).add(sessionId));
    setTimeout(() => {
      const input = inputRefs.current[sessionId];
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  async function handleSave(sessionId: string) {
    await saveSession(sessionId);
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });
  }

  return (
    <motion.section
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035 } } }}
      className="flex flex-col gap-3"
    >
      {sessions.map((session) => {
        const draft = drafts[session.id] ?? { title: "" };
        const saveState = saveStates[session.id] ?? "idle";
        const wasLoadedWithTitle = session.title.trim().length > 0;
        const isEditing = editingIds.has(session.id);
        const shouldShowInput = !wasLoadedWithTitle || isEditing;

        const displayTitle =
          saveState === "saved" || saveState === "saving" || saveState === "dirty"
            ? draft.title
            : session.title;

        return (
          <motion.div
            key={session.id}
            variants={{
              hidden: { opacity: 0, y: 8 },
              show: { opacity: 1, y: 0 }
            }}
            transition={{ duration: 0.18 }}
          >
            <Card size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <span>
                    {formatRelativeTime(session.start)} ({formatDuration(session.durationSeconds)})
                  </span>
                  <button
                    type="button"
                    onClick={() => onFilterChange(activeFilter === session.result ? "all" : session.result)}
                  >
                    <Badge variant={session.result === "completed" ? "default" : "secondary"}>
                      {session.result === "completed" ? "Done" : "Stopped"}
                    </Badge>
                  </button>
                </CardTitle>
                <CardAction>
                  {shouldShowInput ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={iconButtonClass}
                      disabled={saveState === "saving"}
                      onClick={() => void handleSave(session.id)}
                      title="Save title"
                    >
                      <Save data-icon="inline-start" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={iconButtonClass}
                      onClick={() => enterEdit(session.id)}
                      title="Edit title"
                    >
                      <Pencil data-icon="inline-start" />
                    </Button>
                  )}
                </CardAction>
              </CardHeader>

              <CardContent className="-mt-2">
                {shouldShowInput ? (
                  <FieldGroup>
                    <Field>
                      <Input
                        id={`title-${session.id}`}
                        ref={(element) => {
                          inputRefs.current[session.id] = element;
                        }}
                        value={draft.title}
                        placeholder="What did this block move?"
                        className="border-transparent bg-card px-0 text-base shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-card"
                        onChange={(event) => updateDraft(session.id, event.target.value)}
                      />
                    </Field>
                  </FieldGroup>
                ) : (
                  <p
                    className="cursor-text px-0 text-base font-medium text-foreground"
                    onClick={() => enterEdit(session.id)}
                  >
                    {displayTitle}
                  </p>
                )}
              </CardContent>

              <CardFooter className="justify-between gap-2">
                <span
                  className="truncate text-xs text-muted-foreground"
                  title={timeFormatter.format(new Date(session.start * 1000))}
                >
                  {compactStartFormatter.format(new Date(session.start * 1000))}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {saveState === "saving"
                    ? "Saving"
                    : saveState === "saved"
                      ? "Saved"
                      : saveState === "error"
                        ? "Retry"
                        : ""}
                </span>
              </CardFooter>
            </Card>
          </motion.div>
        );
      })}
    </motion.section>
  );
}

function FilterBadges({
  activeFilter,
  completedCount,
  stoppedCount,
  totalCount,
  onChange
}: {
  activeFilter: SessionFilter;
  completedCount: number;
  stoppedCount: number;
  totalCount: number;
  onChange: (filter: SessionFilter) => void;
}) {
  const filters: Array<{ id: SessionFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: totalCount },
    { id: "completed", label: "Done", count: completedCount },
    { id: "stopped", label: "Stopped", count: stoppedCount }
  ];

  return (
    <div className="flex flex-wrap justify-center gap-1 pb-0">
      {filters.map((filter) => (
        <button type="button" key={filter.id} onClick={() => onChange(filter.id)}>
          <Badge variant={activeFilter === filter.id ? "default" : "secondary"}>
            {filter.label} {filter.count}
          </Badge>
        </button>
      ))}
    </div>
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
