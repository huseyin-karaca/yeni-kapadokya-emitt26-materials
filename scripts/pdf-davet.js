const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer");

// Dimensions for A4 at 96 DPI (standard screen/web CSS pixel ratio)
// A4 is 210mm x 297mm
// 210mm * 3.7795 px/mm ~= 794px
// 297mm * 3.7795 px/mm ~= 1123px
// We can use a slightly higher resolution for better rendering and let PDF print handle it.
const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1123;

function toFileUrl(absPath) {
  const resolved = path.resolve(absPath);
  return `file://${resolved}`;
}

function pickChromeExecutable() {
  try {
    const p = puppeteer.executablePath();
    if (p && fs.existsSync(p)) return p;
  } catch (_) {
    // ignore
  }

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

async function applyPdfOverrides(page) {
  await page.emulateMediaType("print");
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });

  await page.addStyleTag({
    content: `
      @page { margin: 0 !important; size: A4 portrait; }
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; width: 100% !important; height: 100% !important; }
      .page { box-shadow: none !important; margin: 0 !important; width: 100% !important; height: 100% !important; }
      /* Ensure watermark stays in background */
      .footer-logo { z-index: -1 !important; }
    `,
  });
}

async function htmlToPdf({ browser, htmlPath, outPath }) {
  const page = await browser.newPage();
  
  await page.goto(toFileUrl(htmlPath), { waitUntil: "networkidle0" });
  await applyPdfOverrides(page);

  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
  });

  await page.close();
}

(async () => {
  const projectDir = path.resolve(__dirname, '..');
  const chromeExecutable = pickChromeExecutable();

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: chromeExecutable,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const outPath = path.join(projectDir, "dist", "davet_mektubu.pdf");
    
    await htmlToPdf({
      browser,
      htmlPath: path.join(projectDir, "src", "davet_mektubu.html"),
      outPath: outPath,
    });
    console.log(`Wrote ${outPath}`);
  } finally {
    await browser.close();
  }
})();
