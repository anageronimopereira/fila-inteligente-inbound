const { app, BrowserWindow, dialog, ipcMain, protocol, shell, net } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs/promises");

const isDev = Boolean(process.env.ELECTRON_START_URL);

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function registerAppProtocol() {
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.join(__dirname, "..", "dist", relativePath);
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: "Fila Inteligente",
    backgroundColor: "#f8fafc",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_START_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else {
    void mainWindow.loadURL("app://local/index.html");
  }

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("Electron failed to load", { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Electron render process gone", details);
  });

  if (isDev || process.env.ELECTRON_DEBUG === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

ipcMain.handle("priority-report:save-pdf", async (_event, payload) => {
  const html = typeof payload?.html === "string" ? payload.html : "";
  const defaultFileName = typeof payload?.defaultFileName === "string" && payload.defaultFileName.trim()
    ? payload.defaultFileName.trim()
    : "relatorio-priorizacao.pdf";

  if (!html) {
    return { saved: false, error: "Relatório vazio." };
  }

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Salvar relatório em PDF",
    defaultPath: defaultFileName.endsWith(".pdf") ? defaultFileName : `${defaultFileName}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (canceled || !filePath) {
    return { saved: false, canceled: true };
  }

  const printWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 1400,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    await printWindow.loadURL(dataUrl);
    const pdf = await printWindow.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      margins: {
        marginType: "default",
      },
    });
    await fs.writeFile(filePath, pdf);
    return { saved: true, filePath };
  } finally {
    printWindow.close();
  }
});

app.whenReady().then(() => {
  registerAppProtocol();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
