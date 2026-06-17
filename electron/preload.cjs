const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("filaInteligenteDesktop", {
  platform: process.platform,
  savePriorityPdf: (html, defaultFileName) =>
    ipcRenderer.invoke("priority-report:save-pdf", { html, defaultFileName }),
});
