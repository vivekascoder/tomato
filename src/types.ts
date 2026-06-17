export type TimerStatus = "idle" | "work" | "break";

export type TimerSettings = {
  workDuration: number;
  breakDuration: number;
  workIntervalsInSet: number;
  stopAfterBreak: boolean;
};

export type TimerState = TimerSettings & {
  status: TimerStatus;
  isRunning: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  intervalCount: number;
  sessionName: string;
};

export type WorkSession = {
  id: string;
  start: number;
  end: number;
  durationSeconds: number;
  result: "completed" | "stopped";
  title: string;
};

export type DashboardData = {
  todayCompleted: number;
  todayFocusSeconds: number;
  totalCompleted: number;
  totalFocusSeconds: number;
  recentSessions: WorkSession[];
};

export type PomodoroAPI = {
  getState: () => Promise<TimerState>;
  start: (sessionName?: string) => Promise<TimerState>;
  pause: () => Promise<TimerState>;
  resume: () => Promise<TimerState>;
  stop: () => Promise<TimerState>;
  skip: () => Promise<TimerState>;
  getSettings: () => Promise<TimerSettings>;
  saveSettings: (settings: TimerSettings) => Promise<TimerSettings>;
  getDashboard: () => Promise<DashboardData>;
  saveAnnotation: (sessionId: string, annotation: { title: string }) => Promise<{ title: string }>;
  onStateChange: (callback: (state: TimerState) => void) => () => void;
};

declare global {
  interface Window {
    pomodoro: PomodoroAPI;
  }
}

export {};
