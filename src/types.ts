export type RawLogEvent = {
  timestamp: number;
  type: string;
  event?: string;
  fromState?: string;
  toState?: string;
};

export type WorkSession = {
  id: string;
  start: number;
  end: number;
  durationSeconds: number;
  event: string;
  result: "completed" | "stopped";
  title: string;
};

export type SessionAnnotation = {
  title: string;
};

export type LogData = {
  logPath: string;
  annotationsPath: string;
  events: RawLogEvent[];
  sessions: WorkSession[];
};
