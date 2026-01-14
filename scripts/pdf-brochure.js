const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer");

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

async function ensureFontsReady(page) {
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });
}

async function applyBrochurePrintOverrides(page) {
  // Respect @page size (A4 landscape) if present.
  await page.emulateMediaType("print");
  await ensureFontsReady(page);

  // Remove preview-only page chrome and ensure page breaks per sheet.
  await page.addStyleTag({
    content: `
      @page { margin: 0 !important; }
      html {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        display: block !important;
        gap: 0 !important;
      }
      .sheet{
        box-shadow: none !important;
        page-break-after: always;
        break-after: page;
      }
      .sheet:last-child{
        page-break-after: auto;
        break-after: auto;
      }
      .fold-line{ display: none !important; }
    `,
  });
}

async function htmlToVectorPdf({ browser, htmlPath, outPath }) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
  await page.goto(toFileUrl(htmlPath), { waitUntil: "networkidle0" });
  await applyBrochurePrintOverrides(page);

  await page.pdf({
    path: outPath,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
  });

  await page.close();
}

async function screenshotElements({ page, selector }) {
  const handles = await page.$$(selector);
  if (!handles.length) {
    throw new Error(`No elements found for selector: ${selector}`);
  }

  const firstBox = await handles[0].boundingBox();
  if (!firstBox) throw new Error(`Failed to measure first element: ${selector}`);

  const width = Math.round(firstBox.width);
  const height = Math.round(firstBox.height);

  const images = [];
  for (const h of handles) {
    const buf = await h.screenshot({ type: "png" });
    images.push(buf);
  }
  return { width, height, images };
}

async function htmlToRasterPdf({ browser, htmlPath, outPath }) {
  // 1) Render each A4 "sheet" as a hi-res PNG.
  const renderPage = await browser.newPage();
  await renderPage.setViewport({ width: 1800, height: 1200, deviceScaleFactor: 2 });
  await renderPage.goto(toFileUrl(htmlPath), { waitUntil: "networkidle0" });
  await applyBrochurePrintOverrides(renderPage);

  const { width, height, images } = await screenshotElements({
    page: renderPage,
    selector: ".sheet",
  });
  await renderPage.close();

  // 2) Embed PNG(s) into a multi-page PDF (flattened).
  const imgPage = await browser.newPage();
  await imgPage.setViewport({ width, height, deviceScaleFactor: 1 });

  const imgTags = images
    .map((pngBuffer) => {
      const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
      return `<div class="p"><img src="${dataUrl}" alt="" /></div>`;
    })
    .join("");

  await imgPage.setContent(
    `<!doctype html>
     <html>
       <head>
         <meta charset="utf-8" />
         <style>
           @page { margin: 0; }
           html, body { margin: 0; padding: 0; background: #fff; }
           .p { width: ${width}px; height: ${height}px; page-break-after: always; break-after: page; }
           .p:last-child { page-break-after: auto; break-after: auto; }
           img { display: block; width: ${width}px; height: ${height}px; }
         </style>
       </head>
       <body>${imgTags}</body>
     </html>`,
    { waitUntil: "networkidle0" }
  );

  await imgPage.pdf({
    path: outPath,
    printBackground: true,
    width: `${width}px`,
    height: `${height}px`,
    margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
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
    const targets = [
      { html: "src/brochure_tr.html", base: "brochure_tr" },
      { html: "src/brochure_en.html", base: "brochure_en" },
    ];

    const convert = rasterMode ? htmlToRasterPdf : htmlToVectorPdf;

    for (const t of targets) {
      const htmlPath = path.join(projectDir, t.html);
      if (!fs.existsSync(htmlPath)) continue;

      const outPath = path.join(
        projectDir, "dist",
        rasterMode ? `${t.base}-raster.pdf` : `${t.base}.pdf`
      );
      await convert({ browser, htmlPath, outPath });
      // eslint-disable-next-line no-console
      console.log(`Wrote ${outPath}`);
    }
  } finally {
    await browser.close();
  }
})();
