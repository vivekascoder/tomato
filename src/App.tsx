import { CheckCircle2, Clock3, History, List, Moon, Pause, Play, RotateCcw, Settings, SkipForward, Sun, Timer, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { DashboardData, TimerSettings, TimerState, WorkSession } from "./types";

type View = "timer" | "dashboard" | "history" | "settings";

const VIEWS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "timer", label: "Timer", icon: Timer },
  { id: "dashboard", label: "Dashboard", icon: List },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings }
];

const VIEW_INDEX: Record<View, number> = {
  timer: 0,
  dashboard: 1,
  history: 2,
  settings: 3
};

const iconButtonClass = "size-8 rounded-full border-0 p-2 shadow-none hover:bg-muted [&_svg]:size-3.5";
const tomatoRed = "#e54b4b";
const breakGreen = "#22c55e";

function TomatoIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M269 24.54c-3.1.11-5.7 0-7.6.21c-2.8.25-4.7.45-7.2 2.23l-1 69.32c3 1.18 6.4 2.3 9.7 2.51c4.1.3 6.8-.21 9.2-2.41zm-103.4 37.9c.1 5.95.3 11.01 1.5 14.14c2.3 5.22 7 9.88 26 13.92l22.5 4.78l-19.5 11.82c-16.5 10.1-35.2 19.4-51.5 26.5c6.2.7 12.3 1.4 18.2 1.4c17.8-.1 34.6-3.9 55.3-18.1L234 106l.4-24.35c-25.5-5.62-46.5-11.68-68.8-19.21m181.2 6.49c-19.5 6.69-34.4 10.97-56.4 14.16l.9 18.81l-1.7 2.5c-6.8 10-18.4 13.3-27.9 12.7s-17.6-3.9-23.4-7.6l-3.2-2.1l-2.2 18c-1.9 17.1-2.1 28.3-5.2 42.4c14.6-10.4 24.4-18.9 36.5-37.3l7.2-10.7l8.1 10c10.9 13 28.8 22.9 48.5 29c-5.7-6.5-10.9-14.5-12-25l-1.4-14.1l13.9 4.6c20.6 6.6 26.9 6.1 33.9 3.7c2.9-.9 6.7-2.6 10.6-4.5l-80.7-27.61l27.3-8.15c14.2-4.24 20.9-9.1 24.6-13.94c1-1.5 1.9-3.14 2.6-4.87M405.5 132l-1.8.4c-17.4 4.2-24.3 9.5-35 13.1c-7.4 2.3-15.6 2.8-26.7.9c.4.6 1 1.2 1.5 1.8c5 5.5 12.2 11.6 18.8 20.2l13.2 17.2l-21.9-2.6c-29.1-3.5-59.4-13.9-80.3-32.9c-16.3 21.4-31.5 30.4-57.2 48.6l-25.8 18.4l11.3-29.1c8.4-21.1 9.3-31.3 10.7-46.3c-17.3 8.4-33.7 11.5-49.5 11.6c-18.7 0-36.5-3.7-55.2-6.4c-.4 0-.8.1-1.2.2c-59.84 46.2-68.94 115.5-68.87 150.3c.17 94.2 26.73 186.7 222.47 190C408.9 490 475.4 388 474.5 293.2c-.8-60.6-12.3-124.4-69-161.2m-258.4 34.3c13.2-.2 26.4 4.4 28.3 12.4c-92.08 41.9-91.59 97.8-105.21 156.8c-11.1-56.8-7.31-122.5 55.21-163.6c5.6-3.8 13.8-5.5 21.7-5.6"
      />
    </svg>
  );
}

function formatDuration(totalSeconds: number) {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(rounded / 3600);
  const mins = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
  return `${secs}s`;
}

function formatClock(totalSeconds: number) {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const mins = String(Math.floor(rounded / 60)).padStart(2, "0");
  const secs = String(rounded % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

const compactTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true
});

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatRelativeTime(timestamp: number) {
  const diffSeconds = timestamp - Date.now() / 1000;
  const absSeconds = Math.abs(diffSeconds);
  if (absSeconds < 60) return relativeFormatter.format(Math.round(diffSeconds), "second");
  if (absSeconds < 3600) return relativeFormatter.format(Math.round(diffSeconds / 60), "minute");
  if (absSeconds < 86400) return relativeFormatter.format(Math.round(diffSeconds / 3600), "hour");
  return relativeFormatter.format(Math.round(diffSeconds / 86400), "day");
}

function CircularProgress({
  total,
  remaining,
  color,
  children,
  isRunning
}: {
  total: number;
  remaining: number;
  color: string;
  children: React.ReactNode;
  isRunning: boolean;
}) {
  const radius = 110;
  const stroke = 12;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progress = total > 0 ? remaining / total : 0;
  const dashoffset = circumference - progress * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <motion.svg
        width={radius * 2}
        height={radius * 2}
        viewBox={`0 0 ${radius * 2} ${radius * 2}`}
        initial={{ rotate: -90 }}
        animate={{ rotate: -90 }}
        className="block"
      >
        <circle
          stroke="currentColor"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="text-muted/60"
        />
        <motion.circle
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          style={{
            strokeDasharray: `${circumference} ${circumference}`,
            strokeDashoffset: dashoffset
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashoffset }}
        />
      </motion.svg>
      {isRunning && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ boxShadow: `0 0 0 0 ${color}40` }}
          animate={{ boxShadow: [`0 0 0 0px ${color}00`, `0 0 0 12px ${color}00`] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<TimerState | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<TimerSettings | null>(null);
  const [view, setView] = useState<View>("timer");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [sessionName, setSessionName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastStatusRef = useRef<TimerState["status"] | null>(null);

  async function loadInitial() {
    try {
      const [nextState, nextSettings, nextDashboard] = await Promise.all([
        window.pomodoro.getState(),
        window.pomodoro.getSettings(),
        window.pomodoro.getDashboard()
      ]);
      setState(nextState);
      setSettings(nextSettings);
      setDashboard(nextDashboard);
      setSessionName(nextState.sessionName);
      lastStatusRef.current = nextState.status;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pomodoro state.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInitial();
    const unsubscribe = window.pomodoro.onStateChange((next) => {
      setState(next);
      if (lastStatusRef.current !== next.status || next.status === "idle") {
        void window.pomodoro.getDashboard().then(setDashboard);
      }
      lastStatusRef.current = next.status;
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (view === "dashboard" || view === "history") {
      void window.pomodoro.getDashboard().then(setDashboard);
    }
  }, [view]);

  useEffect(() => {
    const stored = window.localStorage.getItem("pomodoro-theme");
    const nextTheme = stored === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }, []);

  useEffect(() => {
    if (!state) return;
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (state.isRunning) void window.pomodoro.pause();
        else if (state.status === "idle") void window.pomodoro.start(sessionName);
        else void window.pomodoro.resume();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state, sessionName]);

  function applyTheme(next: "light" | "dark") {
    window.localStorage.setItem("pomodoro-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    setTheme(next);
  }

  function toggleTheme(event: React.MouseEvent<HTMLButtonElement>) {
    const next = theme === "dark" ? "light" : "dark";
    const doc = document as any;
    if (!("startViewTransition" in doc)) {
      applyTheme(next);
      return;
    }
    document.documentElement.style.setProperty("--theme-x", `${event.clientX}px`);
    document.documentElement.style.setProperty("--theme-y", `${event.clientY}px`);
    doc.startViewTransition(() => {
      applyTheme(next);
    });
  }

  async function handleStart() {
    const next = await window.pomodoro.start(sessionName);
    setState(next);
  }

  async function handlePause() {
    const next = await window.pomodoro.pause();
    setState(next);
  }

  async function handleResume() {
    const next = await window.pomodoro.resume();
    setState(next);
  }

  async function handleStop() {
    const next = await window.pomodoro.stop();
    setState(next);
    const nextDashboard = await window.pomodoro.getDashboard();
    setDashboard(nextDashboard);
  }

  async function handleSkip() {
    const next = await window.pomodoro.skip();
    setState(next);
  }

  async function handleSaveSettings(nextSettings: TimerSettings) {
    const saved = await window.pomodoro.saveSettings(nextSettings);
    setSettings(saved);
  }

  const [renamingSession, setRenamingSession] = useState<WorkSession | null>(null);

  async function handleSaveRename(sessionId: string, title: string) {
    await window.pomodoro.saveAnnotation(sessionId, { title: title.trim() });
    await loadInitial();
    setRenamingSession(null);
  }

  async function handleSessionNameCommit(value: string) {
    const trimmed = value.trim();
    setSessionName(trimmed);
    if (state && state.status !== "idle") {
      try {
        const next = await window.pomodoro.setSessionName(trimmed);
        setState(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update session name.");
      }
    }
  }

  if (loading || !state || !settings) {
    return (
      <main className="flex h-svh w-full items-center justify-center bg-background text-foreground">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="text-4xl"
        >
          <TomatoIcon className="size-10" />
        </motion.div>
      </main>
    );
  }

  return (
    <main className="relative flex h-svh w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <TomatoIcon className="size-6 text-foreground" />
          <h1 className="truncate font-heading text-2xl font-semibold tracking-normal">Tomato</h1>
        </div>
        <div className="flex shrink-0 gap-1">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              type="button"
              size="icon"
              variant={view === id ? "secondary" : "ghost"}
              className={iconButtonClass}
              onClick={() => setView(id)}
              title={label}
            >
              <Icon data-icon="inline-start" />
            </Button>
          ))}
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
        <div className="mx-3 mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="relative flex-1 overflow-hidden">
        <motion.div
          className="flex h-full w-[400%]"
          animate={{ x: `-${VIEW_INDEX[view] * 25}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <section className="h-full w-1/4 shrink-0 overflow-y-auto">
            <TimerView
              state={state}
              sessionName={sessionName}
              onSessionNameChange={setSessionName}
              onSessionNameCommit={handleSessionNameCommit}
              onStart={handleStart}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
              onSkip={handleSkip}
            />
          </section>
          <section className="h-full w-1/4 shrink-0 overflow-y-auto">
            <DashboardView state={state} dashboard={dashboard} onRefresh={loadInitial} />
          </section>
          <section className="h-full w-1/4 shrink-0 overflow-y-auto">
            <HistoryView
              sessions={dashboard?.recentSessions ?? []}
              onRefresh={loadInitial}
              onEditSession={setRenamingSession}
            />
          </section>
          <section className="h-full w-1/4 shrink-0 overflow-y-auto">
            <SettingsView settings={settings} onChange={handleSaveSettings} />
          </section>
        </motion.div>
      </div>

      <SessionRenameSheet
        session={renamingSession}
        onClose={() => setRenamingSession(null)}
        onSave={handleSaveRename}
      />
    </main>
  );
}

function TimerView({
  state,
  sessionName,
  onSessionNameChange,
  onSessionNameCommit,
  onStart,
  onPause,
  onResume,
  onStop,
  onSkip
}: {
  state: TimerState;
  sessionName: string;
  onSessionNameChange: (value: string) => void;
  onSessionNameCommit: (value: string) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSkip: () => void;
}) {
  const color = state.status === "break" ? breakGreen : tomatoRed;
  const isIdle = state.status === "idle";
  const isWork = state.status === "work";
  const isBreak = state.status === "break";
  const primaryAction = isIdle ? onStart : state.isRunning ? onPause : onResume;
  const primaryLabel = isIdle ? "Start" : state.isRunning ? "Pause" : "Resume";
  const primaryIcon = isIdle || !state.isRunning ? <Play /> : <Pause />;

  return (
    <div className="flex flex-col items-center gap-5 px-4 py-6">
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Badge variant={isWork ? "default" : isBreak ? "secondary" : "outline"}>
            {isWork ? "Focus" : isBreak ? "Break" : "Ready"}
          </Badge>
          {state.workIntervalsInSet > 0 && (
            <span>
              Set {Math.min(state.intervalCount + (isWork ? 1 : 0), state.workIntervalsInSet)} / {state.workIntervalsInSet}
            </span>
          )}
        </div>
      </div>

      <CircularProgress
        total={state.totalSeconds}
        remaining={state.remainingSeconds}
        color={color}
        isRunning={state.isRunning}
      >
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-heading text-6xl font-semibold tracking-tight" style={{ color }}>
            {formatClock(state.remainingSeconds)}
          </span>
          <span className="text-sm text-muted-foreground">
            {isIdle ? "Start when ready" : state.isRunning ? "Running" : "Paused"}
          </span>
        </div>
      </CircularProgress>

      <FieldGroup className="w-full gap-3">
        <Field>
          <FieldTitle>Session name</FieldTitle>
          <Input
            value={sessionName}
            onChange={(event) => onSessionNameChange(event.target.value)}
            onBlur={(event) => onSessionNameCommit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            placeholder="What are you focusing on?"
            className="h-10 text-center"
          />
        </Field>
      </FieldGroup>

      <div className="grid w-full grid-cols-3 gap-2">
        <Button type="button" variant="outline" size="lg" className="h-12" onClick={onStop} disabled={isIdle}>
          <RotateCcw />
          Reset
        </Button>
        <Button
          type="button"
          size="lg"
          className={cn("h-12", isIdle ? "bg-[#e54b4b] hover:bg-[#d43d3d] text-white" : "")}
          onClick={primaryAction}
        >
          {primaryIcon}
          {primaryLabel}
        </Button>
        <Button type="button" variant="outline" size="lg" className="h-12" onClick={onSkip} disabled={isIdle}>
          <SkipForward />
          Skip
        </Button>
      </div>
    </div>
  );
}

function DashboardView({
  state,
  dashboard,
  onRefresh
}: {
  state: TimerState;
  dashboard: DashboardData | null;
  onRefresh: () => Promise<void>;
}) {
  useEffect(() => {
    void onRefresh();
  }, []);

  const data = dashboard;

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <section className="grid grid-cols-2 gap-2" aria-label="Pomodoro summary">
        <Metric icon={<CheckCircle2 className="text-[#e54b4b]" />} label="Today done" value={`${data?.todayCompleted ?? 0}`} />
        <Metric icon={<Clock3 className="text-[#e54b4b]" />} label="Today focus" value={formatDuration(data?.todayFocusSeconds ?? 0)} />
        <Metric icon={<CheckCircle2 />} label="Total done" value={`${data?.totalCompleted ?? 0}`} />
        <Metric icon={<Clock3 />} label="Total focus" value={formatDuration(data?.totalFocusSeconds ?? 0)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Current session</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={state.status === "work" ? "default" : state.status === "break" ? "secondary" : "outline"}>
                {state.status === "work" ? "Focusing" : state.status === "break" ? "On break" : "Idle"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Remaining</span>
              <span className="font-medium">{formatClock(state.remainingSeconds)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Work interval</span>
              <span className="font-medium">
                {Math.min(state.intervalCount + (state.status === "work" ? 1 : 0), state.workIntervalsInSet)} / {state.workIntervalsInSet}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Focus trend</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.dailyFocusSeconds?.some((day) => day.focusSeconds > 0) ? (
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dailyFocusSeconds} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    tickFormatter={(value) => `${Math.round(Number(value) / 60)}m`}
                  />
                  <Bar dataKey="focusSeconds" fill="#e54b4b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty className="min-h-[160px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <List />
                </EmptyMedia>
                <EmptyTitle>No focus data yet</EmptyTitle>
                <EmptyDescription>Completed sessions will be plotted here automatically.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SessionRow({ session, onContextMenu }: { session: WorkSession; onContextMenu?: (session: WorkSession) => void }) {
  return (
    <div
      className="flex cursor-context-menu items-center justify-between gap-2 rounded-lg border p-2.5 transition-colors hover:bg-muted/40"
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu?.(session);
      }}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">
          {session.title.trim() || "Untitled session"}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {formatRelativeTime(session.start)} · {compactTimeFormatter.format(new Date(session.start * 1000))}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <Badge variant={session.result === "completed" ? "default" : "secondary"}>
          {session.result === "completed" ? "Done" : "Stopped"}
        </Badge>
        <span className="text-xs text-muted-foreground">{formatDuration(session.durationSeconds)}</span>
      </div>
    </div>
  );
}

function HistoryView({
  sessions,
  onRefresh,
  onEditSession
}: {
  sessions: WorkSession[];
  onRefresh: () => Promise<void>;
  onEditSession: (session: WorkSession) => void;
}) {
  const [filter, setFilter] = useState<"all" | "completed" | "stopped">("all");

  const filtered = sessions.filter((s) => filter === "all" || s.result === filter);

  async function handleContextMenu(session: WorkSession) {
    const action = await window.pomodoro.showSessionContextMenu();
    if (action === "edit") {
      onEditSession(session);
    } else if (action === "copy") {
      await window.pomodoro.copyText(session.title.trim() || "Untitled session");
    } else if (action === "delete") {
      await window.pomodoro.deleteSession(session.id);
      await onRefresh();
    }
  }

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="flex flex-wrap gap-1">
        {(["all", "completed", "stopped"] as const).map((f) => (
          <button type="button" key={f} onClick={() => setFilter(f)}>
            <Badge variant={filter === f ? "default" : "secondary"}>{f[0].toUpperCase() + f.slice(1)}</Badge>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty className="min-h-[360px]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <History />
            </EmptyMedia>
            <EmptyTitle>No sessions found</EmptyTitle>
            <EmptyDescription>Completed and stopped focus blocks show up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((session) => (
            <SessionRow key={session.id} session={session} onContextMenu={handleContextMenu} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRenameSheet({
  session,
  onClose,
  onSave
}: {
  session: WorkSession | null;
  onClose: () => void;
  onSave: (sessionId: string, title: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session) {
      setValue(session.title);
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
    }
  }, [session]);

  async function handleSave() {
    if (!session) return;
    await onSave(session.id, value);
  }

  return (
    <AnimatePresence>
      {session && (
        <>
          <motion.div
            className="absolute inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute bottom-0 left-1/2 z-50 flex h-[40%] w-[390px] -translate-x-1/2 flex-col rounded-t-2xl border bg-background px-4 pt-4 shadow-xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-semibold">Rename session</h2>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onClose}>
                <X className="size-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatRelativeTime(session.start)} · {compactTimeFormatter.format(new Date(session.start * 1000))}
            </p>
            <div className="mt-4 flex flex-1 flex-col gap-3">
              <Input
                ref={inputRef}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleSave();
                  if (event.key === "Escape") onClose();
                }}
                placeholder="Session name"
                className="h-11"
              />
              <div className="mt-auto flex gap-2 pb-4">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="button" className="flex-1" onClick={() => void handleSave()}>
                  Save
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SettingsView({
  settings,
  onChange
}: {
  settings: TimerSettings;
  onChange: (settings: TimerSettings) => void;
}) {
  const [workMinutes, setWorkMinutes] = useState(String(Math.floor(settings.workDuration / 60)));
  const [breakMinutes, setBreakMinutes] = useState(String(Math.floor(settings.breakDuration / 60)));
  const [intervals, setIntervals] = useState(String(settings.workIntervalsInSet));
  const [stopAfterBreak, setStopAfterBreak] = useState(settings.stopAfterBreak);

  return (
    <div className="flex flex-col gap-4 px-3 py-3">
      <Card>
        <CardHeader>
          <CardTitle>Timer settings</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="horizontal">
              <FieldLabel>
                <FieldTitle>Work interval</FieldTitle>
              </FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={180}
                  value={workMinutes}
                  onChange={(event) => setWorkMinutes(event.target.value)}
                  onBlur={() =>
                    onChange({
                      workDuration: Math.max(1, Math.min(180, Number(workMinutes) || 25)) * 60,
                      breakDuration: Math.max(1, Math.min(60, Number(breakMinutes) || 5)) * 60,
                      workIntervalsInSet: Math.max(1, Math.min(50, Number(intervals) || 4)),
                      stopAfterBreak
                    })
                  }
                  className="w-20 text-right"
                />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            </Field>
            <Field orientation="horizontal">
              <FieldLabel>
                <FieldTitle>Break interval</FieldTitle>
              </FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={breakMinutes}
                  onChange={(event) => setBreakMinutes(event.target.value)}
                  onBlur={() =>
                    onChange({
                      workDuration: Math.max(1, Math.min(180, Number(workMinutes) || 25)) * 60,
                      breakDuration: Math.max(1, Math.min(60, Number(breakMinutes) || 5)) * 60,
                      workIntervalsInSet: Math.max(1, Math.min(50, Number(intervals) || 4)),
                      stopAfterBreak
                    })
                  }
                  className="w-20 text-right"
                />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            </Field>
            <Field orientation="horizontal">
              <FieldLabel>
                <FieldTitle>Intervals in a set</FieldTitle>
              </FieldLabel>
              <Input
                type="number"
                min={1}
                max={50}
                value={intervals}
                onChange={(event) => setIntervals(event.target.value)}
                onBlur={() =>
                  onChange({
                    workDuration: Math.max(1, Math.min(180, Number(workMinutes) || 25)) * 60,
                    breakDuration: Math.max(1, Math.min(60, Number(breakMinutes) || 5)) * 60,
                    workIntervalsInSet: Math.max(1, Math.min(50, Number(intervals) || 4)),
                    stopAfterBreak
                  })
                }
                className="w-20 text-right"
              />
            </Field>
            <Field orientation="horizontal">
              <FieldLabel>
                <FieldTitle>Stop after break</FieldTitle>
              </FieldLabel>
              <Switch
                checked={stopAfterBreak}
                onCheckedChange={(checked) => {
                  setStopAfterBreak(checked);
                  onChange({
                    workDuration: Math.max(1, Math.min(180, Number(workMinutes) || 25)) * 60,
                    breakDuration: Math.max(1, Math.min(60, Number(breakMinutes) || 5)) * 60,
                    workIntervalsInSet: Math.max(1, Math.min(50, Number(intervals) || 4)),
                    stopAfterBreak: checked
                  });
                }}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <p className="px-1 text-xs text-muted-foreground">
        Changes apply to the next timer cycle.
      </p>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1">{children}</div>;
}
