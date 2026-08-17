/**
 * Processus principal Electron.
 *
 * Ne contient AUCUNE logique métier : il se contente de démarrer le
 * serveur Next.js standalone (.next/standalone/server.js) dans un
 * processus Node séparé — pas le Node embarqué dans Electron, pour
 * éviter tout souci de compatibilité ABI avec les modules natifs
 * (node-llama-cpp, @napi-rs/canvas) — puis d'ouvrir une fenêtre dessus.
 *
 * DATA_DIR pointe vers le dossier utilisateur Windows standard
 * (%APPDATA%/FindIt/data), jamais vers l'intérieur de l'app installée.
 */

const { app, BrowserWindow, Tray, Menu, shell, nativeImage } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { spawn } = require("node:child_process");

const PORT = process.env.FINDIT_PORT || "3000";
const SERVER_URL = `http://127.0.0.1:${PORT}`;

let serverProcess = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;

/** Résout l'exécutable Node portable embarqué avec l'installeur. */
function resolveNodeBinary() {
  const bundled = path.join(
    process.resourcesPath,
    "node-runtime",
    "node.exe",
  );
  if (app.isPackaged && fs.existsSync(bundled)) {
    return bundled;
  }
  // En dev, on utilise le Node qui exécute déjà Electron.
  return process.execPath;
}

/** Résout le dossier contenant server.js (build standalone Next). */
function resolveStandaloneDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app-standalone")
    : path.join(__dirname, "..", ".next", "standalone");
}

function startServer() {
  const nodeBin = resolveNodeBinary();
  const standaloneDir = resolveStandaloneDir();
  const serverEntry = path.join(standaloneDir, "server.js");

  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `Serveur introuvable: ${serverEntry}. Lancer "npm run electron:assemble" avant "npm run build".`,
    );
  }

  const dataDir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  serverProcess = spawn(nodeBin, [serverEntry], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT,
      HOSTNAME: "127.0.0.1",
      DATA_DIR: dataDir,
    },
    stdio: "inherit",
    windowsHide: true,
  });

  serverProcess.on("exit", (code) => {
    serverProcess = null;
    if (!isQuitting && code !== 0) {
      console.error(`Le serveur FindIt s'est arrêté (code ${code}).`);
    }
  });
}

/** Attend que le serveur réponde avant d'ouvrir la fenêtre. */
function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(SERVER_URL, () => resolve());
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Le serveur FindIt n'a pas démarré à temps."));
          return;
        }
        setTimeout(tryOnce, 300);
      });
    };
    tryOnce();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "FindIt",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(SERVER_URL);

  // Ouvre les liens externes (http/https vers l'extérieur) dans le
  // navigateur système plutôt que dans la fenêtre de l'app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Fermer la fenêtre minimise dans le tray plutôt que de tuer le
  // serveur : évite de perdre l'état d'un traitement en cours.
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, "icon.png");
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip("FindIt");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Ouvrir FindIt",
        click: () => {
          mainWindow.show();
        },
      },
      { type: "separator" },
      {
        label: "Quitter",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => mainWindow.show());
}

app.whenReady().then(async () => {
  try {
    startServer();
    await waitForServer();
  } catch (err) {
    console.error(err);
    app.quit();
    return;
  }
  createWindow();
  createTray();
});

app.on("window-all-closed", () => {
  // Ne quitte pas l'app à la fermeture de la fenêtre (comportement
  // desktop attendu sur Windows avec un tray) : on reste actif en tray.
});

app.on("before-quit", () => {
  isQuitting = true;
  if (serverProcess) {
    serverProcess.kill();
  }
});
