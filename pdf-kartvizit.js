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

async function ensureImagesReady(page) {
  // Wait for <img> elements to finish loading/decoding (especially local SVGs).
  await page.evaluate(async () => {
    const imgs = Array.from(document.images || []);
    await Promise.all(
      imgs.map(async (img) => {
        try {
          if (!img.complete) {
            await new Promise((resolve) => {
              const done = () => resolve();
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
            });
          }
          if (img.decode) {
            // decode() can throw on some SVGs; ignore.
            await img.decode().catch(() => {});
          }
        } catch (_) {
          // ignore
        }
      })
    );
  });
}

async function inlineSvgLogo(page, projectDir) {
  const logoFilename = "logo-vector-yazisiz.svg";
  const logoPath = path.join(projectDir, logoFilename);
  try {
    if (fs.existsSync(logoPath)) {
      const svgContent = fs.readFileSync(logoPath, "utf8");
      const base64 = Buffer.from(svgContent).toString("base64");
      const dataUri = `data:image/svg+xml;base64,${base64}`;

      await page.evaluate((uri, filename) => {
        const imgs = document.querySelectorAll("img");
        for (const img of imgs) {
          const src = img.getAttribute("src");
          if (src && (src === filename || src.endsWith("/" + filename))) {
            img.src = uri;
          }
        }
      }, dataUri, logoFilename);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to inline SVG logo:", e);
  }
}

async function applyKartvizitPrintOverrides(page) {
  // We want @page + @media print rules to apply.
  await page.emulateMediaType("print");
  await ensureFontsReady(page);
  await ensureImagesReady(page);

  // Hard-disable any preview chrome so raster screenshots are clean.
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
        gap: 0 !important;
        display: block !important;
      }
      .card-page{
        box-shadow: none !important;
        border-radius: 0 !important;
        page-break-after: always;
        break-after: page;
      }
      .card-page:last-child{
        page-break-after: auto;
        break-after: auto;
      }
    `,
  });
}

async function htmlToVectorPdf({ browser, htmlPath, outPath }) {
  const page = await browser.newPage();

  // Reasonable viewport; PDF page size is controlled by CSS @page.
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  await page.goto(toFileUrl(htmlPath), { waitUntil: "networkidle0" });

  // Inline SVG logo
  await inlineSvgLogo(page, path.dirname(htmlPath));

  // Ensure logo (and other local assets) are actually present before printing.
  await page.waitForFunction(() => {
    const img = document.querySelector(".logo-wrap img");
    return !img || (img.complete && img.naturalWidth > 0);
  });

  await applyKartvizitPrintOverrides(page);

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
  // 1) Render each card face as a hi-res PNG.
  const renderPage = await browser.newPage();
  await renderPage.setViewport({ width: 1400, height: 900, deviceScaleFactor: 3 });
  await renderPage.goto(toFileUrl(htmlPath), { waitUntil: "networkidle0" });
  await inlineSvgLogo(renderPage, path.dirname(htmlPath));
  await applyKartvizitPrintOverrides(renderPage);

  const { width, height, images } = await screenshotElements({
    page: renderPage,
    selector: ".card-page",
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
  const projectDir = __dirname;
  const chromeExecutable = pickChromeExecutable();

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: chromeExecutable,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const htmlPath = path.join(projectDir, "kartvizit.html");
    if (!fs.existsSync(htmlPath)) {
      throw new Error(`Missing kartvizit.html at ${htmlPath}`);
    }

    const outPath = path.join(projectDir, rasterMode ? "kartvizit-raster.pdf" : "kartvizit.pdf");
    const convert = rasterMode ? htmlToRasterPdf : htmlToVectorPdf;

    await convert({ browser, htmlPath, outPath });
    // eslint-disable-next-line no-console
    console.log(`Wrote ${outPath}`);
  } finally {
    await browser.close();
  }
})();

