const { app, BrowserWindow, ipcMain, shell } = require("electron/main");
const { existsSync } = require("node:fs");
const { mkdir, readFile, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const tomatoLogPath = path.join(
  os.homedir(),
  "Library/Containers/com.github.ivoronin.TomatoBar/Data/Library/Caches/TomatoBar.log"
);

const annotationsPath = () => path.join(app.getPath("userData"), "session-annotations.json");

async function readAnnotations() {
  const filePath = annotationsPath();
  if (!existsSync(filePath)) return {};

  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return {};
  }
}

async function saveAnnotations(annotations) {
  const filePath = annotationsPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(annotations, null, 2)}\n`, "utf8");
}

async function readLogEvents() {
  const raw = await readFile(tomatoLogPath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function getWorkSessions(events, annotations) {
  const sessions = [];
  let activeWork = null;

  for (const event of events) {
    if (event.type !== "transition") continue;

    if (event.toState === "work") {
      activeWork = event;
      continue;
    }

    if (activeWork && event.fromState === "work" && event.toState !== "work") {
      const id = `${activeWork.timestamp}-${event.timestamp}`;
      const annotation = annotations[id] ?? { title: "" };

      sessions.push({
        id,
        start: activeWork.timestamp,
        end: event.timestamp,
        durationSeconds: Math.max(0, event.timestamp - activeWork.timestamp),
        event: event.event ?? "transition",
        result: event.event === "timerFired" ? "completed" : "stopped",
        title: annotation.title ?? ""
      });

      activeWork = null;
    }
  }

  return sessions;
}

async function getLogData() {
  const [events, annotations] = await Promise.all([readLogEvents(), readAnnotations()]);

  return {
    logPath: tomatoLogPath,
    annotationsPath: annotationsPath(),
    events,
    sessions: getWorkSessions(events, annotations)
  };
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
};

app.whenReady().then(() => {
  ipcMain.handle("pomodoro:get-log-data", getLogData);

  ipcMain.handle("pomodoro:save-annotation", async (_event, sessionId, annotation) => {
    const annotations = await readAnnotations();
    annotations[sessionId] = {
      title: String(annotation.title ?? "").trim()
    };
    await saveAnnotations(annotations);
    return annotations[sessionId];
  });

  ipcMain.handle("pomodoro:show-log-file", () => {
    shell.showItemInFolder(tomatoLogPath);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
