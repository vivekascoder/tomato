const { app, BrowserWindow, clipboard, ipcMain, shell, Menu, Tray, nativeImage, nativeTheme, Notification } = require("electron/main");
const { existsSync } = require("node:fs");
const { mkdir, readFile, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const annotationsPath = () => path.join(app.getPath("userData"), "session-annotations.json");
const sessionsPath = () => path.join(app.getPath("userData"), "sessions.json");
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");

// White SVG tomato icon used for the macOS menu bar tray.
const TOMATO_TRAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 512 512"><path fill="#ffffff" d="M269 24.54c-3.1.11-5.7 0-7.6.21c-2.8.25-4.7.45-7.2 2.23l-1 69.32c3 1.18 6.4 2.3 9.7 2.51c4.1.3 6.8-.21 9.2-2.41zm-103.4 37.9c.1 5.95.3 11.01 1.5 14.14c2.3 5.22 7 9.88 26 13.92l22.5 4.78l-19.5 11.82c-16.5 10.1-35.2 19.4-51.5 26.5c6.2.7 12.3 1.4 18.2 1.4c17.8-.1 34.6-3.9 55.3-18.1L234 106l.4-24.35c-25.5-5.62-46.5-11.68-68.8-19.21m181.2 6.49c-19.5 6.69-34.4 10.97-56.4 14.16l.9 18.81l-1.7 2.5c-6.8 10-18.4 13.3-27.9 12.7s-17.6-3.9-23.4-7.6l-3.2-2.1l-2.2 18c-1.9 17.1-2.1 28.3-5.2 42.4c14.6-10.4 24.4-18.9 36.5-37.3l7.2-10.7l8.1 10c10.9 13 28.8 22.9 48.5 29c-5.7-6.5-10.9-14.5-12-25l-1.4-14.1l13.9 4.6c20.6 6.6 26.9 6.1 33.9 3.7c2.9-.9 6.7-2.6 10.6-4.5l-80.7-27.61l27.3-8.15c14.2-4.24 20.9-9.1 24.6-13.94c1-1.5 1.9-3.14 2.6-4.87M405.5 132l-1.8.4c-17.4 4.2-24.3 9.5-35 13.1c-7.4 2.3-15.6 2.8-26.7.9c.4.6 1 1.2 1.5 1.8c5 5.5 12.2 11.6 18.8 20.2l13.2 17.2l-21.9-2.6c-29.1-3.5-59.4-13.9-80.3-32.9c-16.3 21.4-31.5 30.4-57.2 48.6l-25.8 18.4l11.3-29.1c8.4-21.1 9.3-31.3 10.7-46.3c-17.3 8.4-33.7 11.5-49.5 11.6c-18.7 0-36.5-3.7-55.2-6.4c-.4 0-.8.1-1.2.2c-59.84 46.2-68.94 115.5-68.87 150.3c.17 94.2 26.73 186.7 222.47 190C408.9 490 475.4 388 474.5 293.2c-.8-60.6-12.3-124.4-69-161.2m-258.4 34.3c13.2-.2 26.4 4.4 28.3 12.4c-92.08 41.9-91.59 97.8-105.21 156.8c-11.1-56.8-7.31-122.5 55.21-163.6c5.6-3.8 13.8-5.5 21.7-5.6"/></svg>`;

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
  if (status === "idle") return "";
  const sign = remainingSeconds < 0 ? "-" : "";
  const abs = Math.abs(remainingSeconds);
  const m = String(Math.floor(abs / 60)).padStart(2, "0");
  const s = String(abs % 60).padStart(2, "0");
  return `${sign}${m}:${s}`;
}

function showNotification(title, body) {
  if (!Notification.isSupported()) return;
  new Notification({ title, body }).show();
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

  function clearTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

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
        const isSetComplete = settings.workIntervalsInSet > 0 && intervalCount >= settings.workIntervalsInSet;
        if (isSetComplete) {
          const completedIntervals = intervalCount + 1;
          clearTimer();
          status = "idle";
          isRunning = false;
          intervalCount = 0;
          remainingSeconds = settings.workDuration;
          totalSeconds = settings.workDuration;
          showNotification("Focus set complete", `You finished ${completedIntervals} focus sessions${sessionName ? ` for "${sessionName}"` : ""}. Take a well-earned break.`);
          broadcast();
          return;
        }
        status = "break";
        remainingSeconds = settings.breakDuration;
        totalSeconds = settings.breakDuration;
        showNotification("Focus session complete", sessionName ? `"${sessionName}" is done — time for a break.` : "Focus session complete — time for a break.");
      } else if (status === "break") {
        if (settings.stopAfterBreak) {
          clearTimer();
          status = "idle";
          isRunning = false;
          intervalCount = 0;
          remainingSeconds = settings.workDuration;
          totalSeconds = settings.workDuration;
          showNotification("Break finished", "Your break is over. Start a new focus session when you’re ready.");
          broadcast();
          return;
        }
        status = "work";
        remainingSeconds = settings.workDuration;
        totalSeconds = settings.workDuration;
        workStartTime = Date.now() / 1000;
        currentWorkSessionId = `${workStartTime}-${Date.now()}`;
        showNotification("Break over", sessionName ? `Ready to focus on "${sessionName}" again.` : "Break over — ready to focus again.");
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
    clearTimer();
    timerId = setInterval(tick, 1000);
    broadcast();
    return getState();
  }

  function pause() {
    isRunning = false;
    clearTimer();
    broadcast();
    return getState();
  }

  function resume() {
    if (isRunning) return getState();
    if (status === "idle") return start(sessionName);
    isRunning = true;
    clearTimer();
    timerId = setInterval(tick, 1000);
    broadcast();
    return getState();
  }

  async function stop() {
    if (status === "work") {
      await finishWork("stopped");
    }
    isRunning = false;
    clearTimer();
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
      const isSetComplete = settings.workIntervalsInSet > 0 && intervalCount >= settings.workIntervalsInSet;
      if (isSetComplete) {
        isRunning = false;
        clearTimer();
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

  function setSessionName(name = "") {
    sessionName = String(name ?? "").trim();
    broadcast();
    return getState();
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
    setSessionName,
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
  const dailyFocusSeconds = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (13 - index));
    const key = date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return {
      date: key,
      label: date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric" }),
      focusSeconds: 0,
      completed: 0
    };
  });
  const dailyByDate = new Map(dailyFocusSeconds.map((day) => [day.date, day]));
  for (const session of completed) {
    const day = dailyByDate.get(indiaDate(session.start));
    if (!day) continue;
    day.focusSeconds += session.durationSeconds;
    day.completed += 1;
  }
  const recentSessions = sessions.slice(-20).reverse();
  return { todayCompleted, todayFocusSeconds, totalCompleted, totalFocusSeconds, dailyFocusSeconds, recentSessions };
}

const { createCanvas, loadImage } = require("canvas");

async function createTrayIcon() {
  const size = 22;
  const size2x = 44;

  async function render(targetSize) {
    const c = createCanvas(targetSize, targetSize);
    const ctx = c.getContext("2d");
    const svg = TOMATO_TRAY_SVG.replace('width="22"', `width="${targetSize}"`).replace('height="22"', `height="${targetSize}"`);
    const img = await loadImage(Buffer.from(svg, "utf8"));
    ctx.drawImage(img, 0, 0, targetSize, targetSize);
    return c.toDataURL("image/png");
  }

  try {
    const [dataUrl1x, dataUrl2x] = await Promise.all([render(size), render(size2x)]);
    const image = nativeImage.createFromDataURL(dataUrl1x);
    image.addRepresentation({ scaleFactor: 2, dataURL: dataUrl2x });
    image.setTemplateImage(true);
    return image;
  } catch {
    // Fallback: a simple filled circle so the tray still has an icon.
    const c = createCanvas(size, size);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    return nativeImage.createFromDataURL(c.toDataURL("image/png"));
  }
}

function createWindowIcon() {
  const pngPath = path.join(os.homedir(), "Downloads", "tomatopomo.png");
  if (!existsSync(pngPath)) return undefined;
  try {
    return nativeImage.createFromPath(pngPath).resize({ width: 128, height: 128 });
  } catch {
    return undefined;
  }
}

let tray = null;
let trayContextMenu = null;
let isQuitting = false;

function updateMenuBar(state) {
  if (!tray) return;
  const label = state.isRunning ? formatMenuTime(Math.max(0, state.remainingSeconds), state.status) : "";
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
      click: async () => {
        isQuitting = true;
        await timer.stop();
        app.quit();
      }
    }
  ]));
}

async function createTray() {
  if (tray) return;
  tray = new Tray(await createTrayIcon());
  tray.setTitle("");
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
    title: "Tomato",
    icon: createWindowIcon(),
    backgroundColor: "#fffaf3",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "dist", "index.html"));

  win.on("close", (event) => {
    if (process.platform === "darwin" && !isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
};

app.on("before-quit", async (event) => {
  if (isQuitting) return;
  event.preventDefault();
  isQuitting = true;
  await timer.stop();
  app.quit();
});

app.whenReady().then(async () => {
  await timer.loadSettings();

  ipcMain.handle("pomodoro:get-state", () => timer.getState());
  ipcMain.handle("pomodoro:set-session-name", (_event, name) => timer.setSessionName(name));
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
  ipcMain.handle("pomodoro:show-session-context-menu", async (event) => {
    return new Promise((resolve) => {
      const menu = Menu.buildFromTemplate([
        { label: "Copy", click: () => resolve("copy") },
        { type: "separator" },
        { label: "Edit", click: () => resolve("edit") },
        { label: "Delete", click: () => resolve("delete") }
      ]);
      const win = BrowserWindow.fromWebContents(event.sender);
      menu.popup({ window: win, callback: () => resolve(null) });
    });
  });
  ipcMain.handle("pomodoro:copy-text", (_event, text) => {
    clipboard.writeText(String(text ?? ""));
  });
  ipcMain.handle("pomodoro:delete-session", async (_event, sessionId) => {
    let sessions = await readSessions();
    sessions = sessions.filter((s) => s.id !== sessionId);
    await saveSessions(sessions);

    const annotations = await readAnnotations();
    delete annotations[sessionId];
    await saveAnnotations(annotations);

    return getDashboardData();
  });
  ipcMain.handle("pomodoro:show-log-file", () => {
    shell.showItemInFolder(sessionsPath());
  });

  await createTray();
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
