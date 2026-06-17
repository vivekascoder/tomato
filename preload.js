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
  saveSettings: (settings) => ipcRenderer.invoke("pomodoro:save-settings", settings),
  getDashboard: () => ipcRenderer.invoke("pomodoro:get-dashboard"),
  saveAnnotation: (sessionId, annotation) => ipcRenderer.invoke("pomodoro:save-annotation", sessionId, annotation),
  onStateChange: (callback) => {
    stateChangeCallbacks.add(callback);
    return () => {
      stateChangeCallbacks.delete(callback);
    };
  }
});
