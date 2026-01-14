const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer");

const PAGE_WIDTH_PX = 850;
const PAGE_HEIGHT_PX = 2000;

const argv = process.argv.slice(2);
const rasterMode = argv.includes("--raster") || process.env.RASTER === "1";

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

async function applyPdfOverrides(page) {
  // Keep "screen" styles (what you see in browser) rather than "print" media.
  await page.emulateMediaType("screen");

  // Ensure fonts are ready (Google Fonts etc.)
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });

  // Override "preview-only" layout tweaks (zoom/padding/background/centering) for PDF output.
  await page.addStyleTag({
    content: `
      @page { margin: 0 !important; }
      html {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body { width: ${PAGE_WIDTH_PX}px !important; height: ${PAGE_HEIGHT_PX}px !important; }
      body {
        zoom: 1 !important;
        background-color: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
      }
      .rollup-container { margin: 0 !important; }
    `,
  });
}

async function htmlToVectorPdf({ browser, htmlPath, outPath }) {
  const page = await browser.newPage();
  await page.setViewport({
    width: PAGE_WIDTH_PX,
    height: PAGE_HEIGHT_PX,
    // 1 tends to reduce renderer differences in some PDF viewers.
    deviceScaleFactor: 1,
  });

  await page.goto(toFileUrl(htmlPath), { waitUntil: "networkidle0" });
  await applyPdfOverrides(page);

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

async function htmlToRasterPdf({ browser, htmlPath, outPath }) {
  // 1) Render the HTML into a high-res PNG.
  const renderPage = await browser.newPage();
  await renderPage.setViewport({
    width: PAGE_WIDTH_PX,
    height: PAGE_HEIGHT_PX,
    deviceScaleFactor: 3,
  });
  await renderPage.goto(toFileUrl(htmlPath), { waitUntil: "networkidle0" });
  await applyPdfOverrides(renderPage);

  const pngBuffer = await renderPage.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX },
  });
  await renderPage.close();

  // 2) Embed that PNG into a one-page PDF (flattened, Preview-safe).
  const imgPage = await browser.newPage();
  await imgPage.setViewport({
    width: PAGE_WIDTH_PX,
    height: PAGE_HEIGHT_PX,
    deviceScaleFactor: 1,
  });

  const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
  await imgPage.setContent(
    `<!doctype html>
     <html>
       <head>
         <meta charset="utf-8" />
         <style>
           @page { margin: 0; }
           html, body { margin: 0; padding: 0; width: ${PAGE_WIDTH_PX}px; height: ${PAGE_HEIGHT_PX}px; background: #fff; }
           img { display: block; width: ${PAGE_WIDTH_PX}px; height: ${PAGE_HEIGHT_PX}px; }
         </style>
       </head>
       <body><img src="${dataUrl}" alt="" /></body>
     </html>`,
    { waitUntil: "networkidle0" }
  );

  await imgPage.pdf({
    path: outPath,
    printBackground: true,
    width: `${PAGE_WIDTH_PX}px`,
    height: `${PAGE_HEIGHT_PX}px`,
    margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
    pageRanges: "1",
  });

  await imgPage.close();
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
    const turkceOut = path.join(
      projectDir, "dist",
      rasterMode ? "turkce-raster.pdf" : "turkce.pdf"
    );
    const ingilizceOut = path.join(
      projectDir, "dist",
      rasterMode ? "ingilizce-raster.pdf" : "ingilizce.pdf"
    );

    const convert = rasterMode ? htmlToRasterPdf : htmlToVectorPdf;

    await convert({
      browser,
      htmlPath: path.join(projectDir, "src", "turkce.html"),
      outPath: turkceOut,
    });
    console.log(`Wrote ${turkceOut}`);

    await convert({
      browser,
      htmlPath: path.join(projectDir, "src", "ingilizce.html"),
      outPath: ingilizceOut,
    });
    console.log(`Wrote ${ingilizceOut}`);
  } finally {
    await browser.close();
  }
})();
