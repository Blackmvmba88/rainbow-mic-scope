const { app, BrowserWindow, Menu, shell, session } = require("electron");
const path = require("path");

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 920,
    minHeight: 640,
    title: "Rainbow Mic Scope",
    backgroundColor: "#05060a",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.loadFile(path.join(__dirname, "..", "webui", "index.html"));

  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
  }
}

function installPermissions() {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = new Set(["media", "fullscreen", "display-capture"]);
    callback(allowed.has(permission));
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  installPermissions();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
