const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("pomodoro", {
  getLogData: () => ipcRenderer.invoke("pomodoro:get-log-data"),
  saveAnnotation: (sessionId, annotation) => ipcRenderer.invoke("pomodoro:save-annotation", sessionId, annotation),
  showLogFile: () => ipcRenderer.invoke("pomodoro:show-log-file")
});
