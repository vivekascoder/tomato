import { CheckCircle2, Clock3, History, List, Moon, Pause, Play, RotateCcw, Settings, SkipForward, Sun, Timer } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
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
  const [burst, setBurst] = useState<{ x: number; y: number; color: string; size: number; target: "light" | "dark" } | null>(null);

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
      if (view === "dashboard") {
        void window.pomodoro.getDashboard().then(setDashboard);
      }
    });
    return () => unsubscribe();
  }, []);

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

  function startThemeTransition(event: React.MouseEvent<HTMLButtonElement>) {
    const target = theme === "dark" ? "light" : "dark";
    const color = target === "dark" ? "oklch(0.145 0 0)" : "oklch(1 0 0)";
    const size = Math.hypot(window.innerWidth, window.innerHeight) * 2.5;
    setBurst({ x: event.clientX, y: event.clientY, color, size, target });
  }

  function finishThemeTransition() {
    if (!burst) return;
    const next = burst.target;
    window.localStorage.setItem("pomodoro-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    setTheme(next);
    setBurst(null);
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

  if (loading || !state || !settings) {
    return (
      <main className="flex h-svh w-full items-center justify-center bg-background text-foreground">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="text-4xl"
        >
          🍅
        </motion.div>
      </main>
    );
  }

  return (
    <main className="flex h-svh w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="truncate font-heading text-2xl font-semibold tracking-normal">🍅 Tomato</h1>
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
            onClick={startThemeTransition}
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
            <HistoryView />
          </section>
          <section className="h-full w-1/4 shrink-0 overflow-y-auto">
            <SettingsView settings={settings} onChange={handleSaveSettings} />
          </section>
        </motion.div>
      </div>
      {burst && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed z-50 rounded-full"
          initial={{ width: 0, height: 0 }}
          animate={{ width: burst.size, height: burst.size }}
          onAnimationComplete={finishThemeTransition}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{
            left: burst.x,
            top: burst.y,
            backgroundColor: burst.color,
            x: "-50%",
            y: "-50%"
          }}
        />
      )}
    </main>
  );
}

function TimerView({
  state,
  sessionName,
  onSessionNameChange,
  onStart,
  onPause,
  onResume,
  onStop,
  onSkip
}: {
  state: TimerState;
  sessionName: string;
  onSessionNameChange: (value: string) => void;
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
            placeholder="What are you focusing on?"
            className="h-10 text-center"
            disabled={!isIdle}
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
          <CardTitle>Recent sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.recentSessions && data.recentSessions.length > 0 ? (
            <div className="flex flex-col gap-2">
              {data.recentSessions.slice(0, 6).map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </div>
          ) : (
            <Empty className="min-h-[160px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Clock3 />
                </EmptyMedia>
                <EmptyTitle>No sessions yet</EmptyTitle>
                <EmptyDescription>Start a focus timer to see your work blocks here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SessionRow({ session }: { session: WorkSession }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
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

function HistoryView() {
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "completed" | "stopped">("all");

  useEffect(() => {
    async function load() {
      const data = await window.pomodoro.getDashboard();
      setSessions(data.recentSessions);
      setLoading(false);
    }
    void load();
  }, []);

  const filtered = sessions.filter((s) => filter === "all" || s.result === filter);

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="flex flex-wrap gap-1">
        {(["all", "completed", "stopped"] as const).map((f) => (
          <button type="button" key={f} onClick={() => setFilter(f)}>
            <Badge variant={filter === f ? "default" : "secondary"}>{f[0].toUpperCase() + f.slice(1)}</Badge>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
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
            <SessionRow key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
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
