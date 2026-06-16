/// <reference types="vite/client" />

import type { LogData, SessionAnnotation } from "./types";

declare global {
  interface Window {
    pomodoro: {
      getLogData: () => Promise<LogData>;
      saveAnnotation: (sessionId: string, annotation: SessionAnnotation) => Promise<SessionAnnotation>;
      showLogFile: () => Promise<void>;
    };
  }
}
