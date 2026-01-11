const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer");

const PAGE_WIDTH_PX = 850;
const PAGE_HEIGHT_PX = 2000;

function toFileUrl(absPath) {
  const resolved = path.resolve(absPath);
  return `file://${resolved}`;
}

function pickChromeExecutable() {
  // Prefer Puppeteer-managed Chromium when present.
  try {
    const p = puppeteer.executablePath();
    if (p && fs.existsSync(p)) return p;
  } catch (_) {
    // ignore
  }

  // Fallbacks for macOS (common installs).
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

async function htmlToPdf({ browser, htmlPath, outPath }) {
  const page = await browser.newPage();
  await page.setViewport({
    width: PAGE_WIDTH_PX,
    height: PAGE_HEIGHT_PX,
    deviceScaleFactor: 2,
  });

  await page.goto(toFileUrl(htmlPath), { waitUntil: "networkidle0" });

  // Ensure fonts are ready (Google Fonts etc.)
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });

  // Override "preview-only" layout tweaks (zoom/padding/background/centering) for PDF output.
  await page.addStyleTag({
    content: `
      @page { margin: 0 !important; }
      html, body { width: ${PAGE_WIDTH_PX}px !important; height: ${PAGE_HEIGHT_PX}px !important; }
      body {
        zoom: 1 !important;
        background: transparent !important;
        padding: 0 !important;
        display: block !important;
      }
      .rollup-container { margin: 0 !important; }
    `,
  });

  await page.pdf({
    path: outPath,
    printBackground: true,
    width: `${PAGE_WIDTH_PX}px`,
    height: `${PAGE_HEIGHT_PX}px`,
    margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
    pageRanges: "1",
  });

  await page.close();
}

(async () => {
  const projectDir = __dirname;
  const chromeExecutable = pickChromeExecutable();

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: chromeExecutable,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    await htmlToPdf({
      browser,
      htmlPath: path.join(projectDir, "turkce.html"),
      outPath: path.join(projectDir, "turkce.pdf"),
    });

    await htmlToPdf({
      browser,
      htmlPath: path.join(projectDir, "ingilizce.html"),
      outPath: path.join(projectDir, "ingilizce.pdf"),
    });
  } finally {
    await browser.close();
  }
})();

