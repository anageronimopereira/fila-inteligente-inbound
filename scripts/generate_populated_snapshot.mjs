import fs from "node:fs/promises";
import { chromium } from "playwright";

const URL = "http://127.0.0.1:4173/";
const ROOT = "/Users/pessoal/Documents/priorizacao-implantacao-dashboard";
const DIST = `${ROOT}/dist`;
const OUTPUT = `${DIST}/painel-diretoria-populado-2026-05-05.html`;

const files = [
  "/Users/pessoal/Downloads/1.abatida -Projetos abertos por implanter-2026-05-05-15-16-26.xlsx",
  "/Users/pessoal/Downloads/2.aNota de finalização - Onb Parcerias-2026-05-05-15-17-00.xlsx",
  "/Users/pessoal/Downloads/3.aópia de Projetos perdidos - Mês-2026-05-05-15-17-53.xlsx",
  "/Users/pessoal/Downloads/5.Aparcerias___projetos_em_aberto_com_oportunidade_de_cancelamento_2026-05-05T18_20_37.629344895Z (1).xlsx",
  "/Users/pessoal/Downloads/4.aNovos projetos - Parcerias2023-2026-05-05-15-19-50.xlsx",
  "/Users/pessoal/Downloads/6.aesumo_clientes_em_implantacao_2026-05-05T18_21_34.858823455Z.xlsx",
  "/Users/pessoal/Downloads/10.ateste - Projetos com valor do contrato-2026-05-05-15-18-33.xlsx",
];

async function waitForUploadName(page, filePath) {
  const fileName = filePath.split("/").pop();
  await page.waitForFunction(
    (expected) => document.body.innerText.includes(expected),
    fileName,
    { timeout: 30000 },
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 2200 } });

  await page.goto(URL, { waitUntil: "networkidle" });

  const inputs = page.locator('input[type="file"]');
  const inputCount = await inputs.count();
  if (inputCount < files.length) {
    throw new Error(`Esperava ${files.length} inputs de upload, mas encontrei ${inputCount}.`);
  }

  for (let index = 0; index < files.length; index += 1) {
    await inputs.nth(index).setInputFiles(files[index]);
    await waitForUploadName(page, files[index]);
    await page.waitForTimeout(400);
  }

  await page.waitForTimeout(1500);
  const exportedState = await page.evaluate(() => window.__EXPORTED_DASHBOARD_STATE__);
  if (!exportedState?.executiveData) {
    throw new Error("Não foi possível capturar o estado preenchido do dashboard.");
  }

  const indexHtml = await fs.readFile(`${DIST}/index.html`, "utf8");
  const assetMatch = indexHtml.match(/src="\/assets\/([^"]+)"/);
  if (!assetMatch) {
    throw new Error("Não encontrei o asset JS no index.html.");
  }

  const assetName = assetMatch[1];
  const bundle = await fs.readFile(`${DIST}/assets/${assetName}`);
  const bundleDataUrl = `data:text/javascript;base64,${bundle.toString("base64")}`;
  const preload = JSON.stringify(exportedState).replaceAll("</script>", "<\\/script>");

  const html = indexHtml.replace(
    `<script type="module" crossorigin src="/assets/${assetName}"></script>`,
    `<script>window.__PRELOADED_DASHBOARD__ = ${preload};</script>\n<script type="module" src="${bundleDataUrl}"></script>`,
  );

  await fs.writeFile(OUTPUT, html, "utf8");
  await browser.close();
  console.log(OUTPUT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
