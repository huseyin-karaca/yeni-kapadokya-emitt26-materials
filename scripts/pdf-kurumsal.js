const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer");

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
  await page.evaluate(async () => {
    const imgs = Array.from(document.images || []);
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) return resolve();
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          })
      )
    );
  });
}

async function inlineSvgLogo(page, projectDir) {
  // Helps Chrome reliably embed local SVGs into the generated PDF.
  const logos = ["logo-vector-yazisiz.svg", "logo-vector-ingilizce.svg", "logo-vector-turkce.svg"];

  for (const logoFilename of logos) {
    const logoPath = path.join(projectDir, "assets", "logos", logoFilename);
    try {
      if (!fs.existsSync(logoPath)) continue;
      const svgContent = fs.readFileSync(logoPath, "utf8");
      const base64 = Buffer.from(svgContent).toString("base64");
      const dataUri = `data:image/svg+xml;base64,${base64}`;

      await page.evaluate(
        (uri, filename) => {
          const imgs = document.querySelectorAll("img");
          for (const img of imgs) {
            const src = img.getAttribute("src");
            if (src && src.includes(filename)) img.setAttribute("src", uri);
          }
        },
        dataUri,
        logoFilename
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to inline SVG logo:", e);
    }
  }
}

async function applyPdfOverrides(page) {
  // Keep "screen" styles (this HTML is a centered preview card).
  await page.emulateMediaType("screen");

  await page.addStyleTag({
    content: `
      html {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        background: #fff !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        min-height: auto !important;
      }
      .banner-card {
        margin: 0 !important;
        box-shadow: none !important;
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        /* Match the on-screen (desktop) card width: 100% with max-width: 500px */
        width: 500px !important;
        max-width: 500px !important;
        overflow: hidden !important;
      }
    `,
  });

  await ensureFontsReady(page);
  await ensureImagesReady(page);
}

async function measureBanner(page) {
  const box = await page.evaluate(() => {
    const el = document.querySelector(".banner-card");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  if (!box) throw new Error("Missing .banner-card in kurumsal.html");
  return { width: Math.ceil(box.w), height: Math.ceil(box.h) };
}

async function setPageSize(page, widthPx, heightPx) {
  await page.addStyleTag({
    content: `
      @page { size: ${widthPx}px ${heightPx}px; margin: 0 !important; }
      html, body { width: ${widthPx}px !important; height: ${heightPx}px !important; }
    `,
  });
}

async function htmlToPdf({ browser, htmlPath, outPath }) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60_000);

  // Large enough viewport so the card hits its max-width (500px).
  await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 1 });
  await page.goto(toFileUrl(htmlPath), { waitUntil: "networkidle0" });

  const projectDir = path.resolve(__dirname, "..");
  await inlineSvgLogo(page, projectDir);
  await applyPdfOverrides(page);

  const { width, height } = await measureBanner(page);
  await setPageSize(page, width, height);

  await page.pdf({
    path: outPath,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
    pageRanges: "1",
  });

  await page.close();
}

(async () => {
  const projectDir = path.resolve(__dirname, "..");
  const distDir = path.join(projectDir, "dist");
  fs.mkdirSync(distDir, { recursive: true });

  const htmlPath = path.join(projectDir, "src", "kurumsal.html");
  const outPath = path.join(distDir, "kurumsal.pdf");

  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Missing kurumsal.html at ${htmlPath}`);
  }

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: pickChromeExecutable(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    await htmlToPdf({ browser, htmlPath, outPath });
    // eslint-disable-next-line no-console
    console.log(`Wrote ${outPath}`);
  } finally {
    await browser.close();
  }
})();

