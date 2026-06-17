const { contextBridge, ipcRenderer } = require("electron/renderer");

const stateChangeCallbacks = new Set();

ipcRenderer.on("pomodoro:state-change", (_event, state) => {
  for (const callback of stateChangeCallbacks) {
    try {
      callback(state);
    } catch {
      // ignore
    }
  }
});

contextBridge.exposeInMainWorld("pomodoro", {
  getState: () => ipcRenderer.invoke("pomodoro:get-state"),
  start: (sessionName) => ipcRenderer.invoke("pomodoro:start", sessionName),
  pause: () => ipcRenderer.invoke("pomodoro:pause"),
  resume: () => ipcRenderer.invoke("pomodoro:resume"),
  stop: () => ipcRenderer.invoke("pomodoro:stop"),
  skip: () => ipcRenderer.invoke("pomodoro:skip"),
  getSettings: () => ipcRenderer.invoke("pomodoro:get-settings"),
  setSessionName: (name) => ipcRenderer.invoke("pomodoro:set-session-name", name),
  saveSettings: (settings) => ipcRenderer.invoke("pomodoro:save-settings", settings),
  getDashboard: () => ipcRenderer.invoke("pomodoro:get-dashboard"),
  saveAnnotation: (sessionId, annotation) => ipcRenderer.invoke("pomodoro:save-annotation", sessionId, annotation),
  showSessionContextMenu: () => ipcRenderer.invoke("pomodoro:show-session-context-menu"),
  copyText: (text) => ipcRenderer.invoke("pomodoro:copy-text", text),
  deleteSession: (sessionId) => ipcRenderer.invoke("pomodoro:delete-session", sessionId),
  onStateChange: (callback) => {
    stateChangeCallbacks.add(callback);
    return () => {
      stateChangeCallbacks.delete(callback);
    };
  }
});
