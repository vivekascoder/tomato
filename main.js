const { app, BrowserWindow, ipcMain, shell, Menu, Tray, nativeImage, nativeTheme } = require("electron/main");
const { existsSync } = require("node:fs");
const { mkdir, readFile, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const annotationsPath = () => path.join(app.getPath("userData"), "session-annotations.json");
const sessionsPath = () => path.join(app.getPath("userData"), "sessions.json");
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");

async function readJson(filePath, fallback = {}) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readAnnotations() {
  return readJson(annotationsPath(), {});
}

async function saveAnnotations(annotations) {
  await writeJson(annotationsPath(), annotations);
}

async function readSessions() {
  return readJson(sessionsPath(), []);
}

async function saveSessions(sessions) {
  await writeJson(sessionsPath(), sessions);
}

async function readSettings() {
  const defaults = { workDuration: 25 * 60, breakDuration: 5 * 60, workIntervalsInSet: 4, stopAfterBreak: false };
  const stored = await readJson(settingsPath(), defaults);
  return { ...defaults, ...stored };
}

async function saveSettings(settings) {
  await writeJson(settingsPath(), settings);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatMenuTime(remainingSeconds, status) {
  if (status === "idle") return "🍅";
  const sign = remainingSeconds < 0 ? "-" : "";
  const abs = Math.abs(remainingSeconds);
  const m = String(Math.floor(abs / 60)).padStart(2, "0");
  const s = String(abs % 60).padStart(2, "0");
  return `${sign}${m}:${s}`;
}

function createTimerEngine() {
  let settings = { workDuration: 25 * 60, breakDuration: 5 * 60, workIntervalsInSet: 4, stopAfterBreak: false };
  let status = "idle";
  let isRunning = false;
  let remainingSeconds = settings.workDuration;
  let totalSeconds = settings.workDuration;
  let intervalCount = 0;
  let sessionName = "";
  let timerId = null;
  let workStartTime = null;
  let currentWorkSessionId = null;
  let subscribers = [];

  async function loadSettings() {
    settings = await readSettings();
    if (status === "idle" && !isRunning) {
      remainingSeconds = settings.workDuration;
      totalSeconds = settings.workDuration;
    }
    broadcast();
  }

  function getState() {
    return {
      ...settings,
      status,
      isRunning,
      remainingSeconds,
      totalSeconds,
      intervalCount,
      sessionName
    };
  }

  function broadcast() {
    const state = getState();
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("pomodoro:state-change", state);
    }
    updateMenuBar(state);
    for (const cb of subscribers) {
      try {
        cb(state);
      } catch {
        // ignore
      }
    }
  }

  async function finishWork(result = "completed") {
    if (!workStartTime || !currentWorkSessionId) return;
    const end = Date.now() / 1000;
    const sessions = await readSessions();
    sessions.push({
      id: currentWorkSessionId,
      start: workStartTime,
      end,
      durationSeconds: Math.max(0, end - workStartTime),
      result,
      title: sessionName
    });
    await saveSessions(sessions);
    workStartTime = null;
    currentWorkSessionId = null;
  }

  async function tick() {
    if (!isRunning) return;
    remainingSeconds -= 1;

    if (remainingSeconds <= 0) {
      if (status === "work") {
        await finishWork("completed");
        intervalCount += 1;
        const isSetComplete = workIntervalsInSet > 0 && intervalCount >= workIntervalsInSet;
        if (isSetComplete) {
          status = "idle";
          isRunning = false;
          intervalCount = 0;
          remainingSeconds = settings.workDuration;
          totalSeconds = settings.workDuration;
          broadcast();
          return;
        }
        status = "break";
        remainingSeconds = settings.breakDuration;
        totalSeconds = settings.breakDuration;
      } else if (status === "break") {
        if (settings.stopAfterBreak) {
          status = "idle";
          isRunning = false;
          intervalCount = 0;
          remainingSeconds = settings.workDuration;
          totalSeconds = settings.workDuration;
          broadcast();
          return;
        }
        status = "work";
        remainingSeconds = settings.workDuration;
        totalSeconds = settings.workDuration;
        workStartTime = Date.now() / 1000;
        currentWorkSessionId = `${workStartTime}-${Date.now()}`;
      }
    }

    broadcast();
  }

  function start(name = "") {
    if (isRunning) return getState();
    if (status === "idle") {
      status = "work";
      intervalCount = 0;
      remainingSeconds = settings.workDuration;
      totalSeconds = settings.workDuration;
      sessionName = String(name ?? "").trim();
      workStartTime = Date.now() / 1000;
      currentWorkSessionId = `${workStartTime}-${Date.now()}`;
    }
    isRunning = true;
    if (timerId) clearInterval(timerId);
    timerId = setInterval(tick, 1000);
    broadcast();
    return getState();
  }

  function pause() {
    isRunning = false;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    broadcast();
    return getState();
  }

  function resume() {
    if (isRunning) return getState();
    isRunning = true;
    if (timerId) clearInterval(timerId);
    timerId = setInterval(tick, 1000);
    broadcast();
    return getState();
  }

  async function stop() {
    if (status === "work") {
      await finishWork("stopped");
    }
    isRunning = false;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    status = "idle";
    intervalCount = 0;
    remainingSeconds = settings.workDuration;
    totalSeconds = settings.workDuration;
    broadcast();
    return getState();
  }

  async function skip() {
    if (status === "work") {
      await finishWork("stopped");
      intervalCount += 1;
      const isSetComplete = workIntervalsInSet > 0 && intervalCount >= workIntervalsInSet;
      if (isSetComplete) {
        isRunning = false;
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
        }
        status = "idle";
        intervalCount = 0;
        remainingSeconds = settings.workDuration;
        totalSeconds = settings.workDuration;
        broadcast();
        return getState();
      }
      status = "break";
      remainingSeconds = settings.breakDuration;
      totalSeconds = settings.breakDuration;
    } else if (status === "break") {
      status = "work";
      remainingSeconds = settings.workDuration;
      totalSeconds = settings.workDuration;
      workStartTime = Date.now() / 1000;
      currentWorkSessionId = `${workStartTime}-${Date.now()}`;
    }
    broadcast();
    return getState();
  }

  async function updateSettings(newSettings) {
    settings = {
      workDuration: clamp(Number(newSettings.workDuration) || 25 * 60, 1, 3600),
      breakDuration: clamp(Number(newSettings.breakDuration) || 5 * 60, 1, 3600),
      workIntervalsInSet: clamp(Number(newSettings.workIntervalsInSet) || 4, 1, 100),
      stopAfterBreak: Boolean(newSettings.stopAfterBreak)
    };
    await saveSettings(settings);
    if (status === "idle") {
      remainingSeconds = settings.workDuration;
      totalSeconds = settings.workDuration;
    }
    if (status === "work") {
      totalSeconds = settings.workDuration;
    }
    if (status === "break") {
      totalSeconds = settings.breakDuration;
    }
    broadcast();
    return settings;
  }

  function subscribe(callback) {
    subscribers.push(callback);
    return () => {
      subscribers = subscribers.filter((cb) => cb !== callback);
    };
  }

  return {
    loadSettings,
    getState,
    start,
    pause,
    resume,
    stop,
    skip,
    updateSettings,
    subscribe
  };
}

const timer = createTimerEngine();

async function getDashboardData() {
  const sessions = await readSessions();
  const now = new Date();
  const indiaDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  };
  const todayKey = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const todaySessions = sessions.filter((s) => indiaDate(s.start) === todayKey && s.result === "completed");
  const todayCompleted = todaySessions.length;
  const todayFocusSeconds = todaySessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const completed = sessions.filter((s) => s.result === "completed");
  const totalCompleted = completed.length;
  const totalFocusSeconds = completed.reduce((sum, s) => sum + s.durationSeconds, 0);
  const recentSessions = sessions.slice(-20).reverse();
  return { todayCompleted, todayFocusSeconds, totalCompleted, totalFocusSeconds, recentSessions };
}

function createTrayIcon(text) {
  const size = 22;
  const canvas = require("canvas");
  const c = canvas.createCanvas(size, size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = nativeTheme.shouldUseDarkColors ? "#ffffff" : "#1f1f1f";
  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🍅", size / 2, size / 2 + 1);
  return nativeImage.createFromDataURL(c.toDataURL("image/png"));
}

let tray = null;
let trayContextMenu = null;

function updateMenuBar(state) {
  if (!tray) return;
  const label = state.isRunning ? formatMenuTime(Math.max(0, state.remainingSeconds), state.status) : "🍅";
  tray.setTitle(label);
  const statusLabel = state.status === "work" ? "Working" : state.status === "break" ? "On break" : "Idle";
  const toggleLabel = state.isRunning ? "Pause" : state.status === "idle" ? "Start" : "Resume";
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: statusLabel, enabled: false },
    { type: "separator" },
    {
      label: toggleLabel,
      click: () => {
        if (state.isRunning) timer.pause();
        else if (state.status === "idle") timer.start();
        else timer.resume();
      }
    },
    {
      label: "Stop",
      click: () => timer.stop()
    },
    { type: "separator" },
    {
      label: "Open Tomato",
      click: () => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          win.show();
          win.focus();
        }
      }
    },
    {
      label: "Quit",
      click: () => app.quit()
    }
  ]));
}

function createTray() {
  if (tray) return;
  tray = new Tray(createTrayIcon());
  tray.setTitle("🍅");
  tray.setToolTip("Tomato");
  updateMenuBar(timer.getState());
  tray.on("click", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.show();
      win.focus();
    }
  });
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 390,
    height: 780,
    minWidth: 390,
    minHeight: 780,
    maxWidth: 390,
    maxHeight: 780,
    resizable: false,
    title: "🍅 Tomato",
    backgroundColor: "#fffaf3",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "dist", "index.html"));

  win.on("close", (event) => {
    if (process.platform === "darwin") {
      event.preventDefault();
      win.hide();
    }
  });
};

app.whenReady().then(async () => {
  await timer.loadSettings();

  ipcMain.handle("pomodoro:get-state", () => timer.getState());
  ipcMain.handle("pomodoro:start", (_event, sessionName) => timer.start(sessionName));
  ipcMain.handle("pomodoro:pause", () => timer.pause());
  ipcMain.handle("pomodoro:resume", () => timer.resume());
  ipcMain.handle("pomodoro:stop", () => timer.stop());
  ipcMain.handle("pomodoro:skip", () => timer.skip());
  ipcMain.handle("pomodoro:get-settings", () => readSettings());
  ipcMain.handle("pomodoro:save-settings", (_event, settings) => timer.updateSettings(settings));
  ipcMain.handle("pomodoro:get-dashboard", getDashboardData);
  ipcMain.handle("pomodoro:save-annotation", async (_event, sessionId, annotation) => {
    const annotations = await readAnnotations();
    annotations[sessionId] = { title: String(annotation.title ?? "").trim() };
    await saveAnnotations(annotations);

    const sessions = await readSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      session.title = annotations[sessionId].title;
      await saveSessions(sessions);
    }

    return annotations[sessionId];
  });
  ipcMain.handle("pomodoro:show-log-file", () => {
    shell.showItemInFolder(sessionsPath());
  });

  createTray();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.show();
        win.focus();
      }
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
