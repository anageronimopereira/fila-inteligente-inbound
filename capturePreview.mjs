import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });

await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.setInputFiles(
  'input[type="file"] >> nth=0',
  "/Users/pessoal/Downloads/resumo_clientes_em_implantacao_2026-03-24T19_03_56.367376148Z.csv",
);
await page.waitForTimeout(400);
await page.setInputFiles(
  'input[type="file"] >> nth=1',
  "/Users/pessoal/Downloads/Projetos abertos por implanter-2026-03-24-15-58-15 (1).xlsx",
);
await page.waitForTimeout(1200);
await page.screenshot({
  path: "/Users/pessoal/Documents/dashboard-preview.png",
  fullPage: false,
});

await browser.close();
