const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer");
const { PDFDocument } = require("pdf-lib");

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
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
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

function pxToPt(px) {
  // CSS px are defined at 96dpi; PDF points are 72dpi.
  return px * (72 / 96);
}

async function applyPdfPrintOverrides(page) {
  await page.emulateMediaType("print");
  await ensureFontsReady(page);

  // Fix clipping: the HTML uses body:flex for preview; breaks can fail inside flex.
  await page.addStyleTag({
    content: `
      html {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body{
        background:#fff !important;
        margin:0 !important;
        padding:0 !important;
        display:block !important;
        gap:0 !important;
      }
      .card-page{
        box-shadow:none !important;
        border-radius:0 !important;
        page-break-after: always;
        break-after: page;
      }
      .card-page:last-child{
        page-break-after: auto;
        break-after: auto;
      }
      /* If we inline SVG logo as <svg>, mimic old <img> behavior */
      .logo-wrap svg{
        width:100% !important;
        height:100% !important;
        display:block !important;
        transform: translateY(var(--logo-y)) !important;
      }
    `,
  });

  await ensureImagesReady(page);
}

async function getFrontLogoBox(page) {
  // Measure logo placement relative to the FRONT card (in CSS px).
  const box = await page.evaluate(() => {
    const front = document.querySelector(".card-page.front");
    const logoWrap = document.querySelector(".card-page.front .logo-wrap");
    if (!front || !logoWrap) return null;

    const frontRect = front.getBoundingClientRect();
    const logoRect = logoWrap.getBoundingClientRect();

    return {
      // relative to front card
      x: logoRect.left - frontRect.left,
      y: logoRect.top - frontRect.top,
      w: logoRect.width,
      h: logoRect.height,
      pageW: frontRect.width,
      pageH: frontRect.height,
    };
  });
  return box;
}

async function removeLogoImg(page) {
  await page.evaluate(() => {
    document
      .querySelectorAll(".card-page.front .logo-wrap img")
      .forEach((n) => n.remove());
  });
}

async function resolveFrontLogoSrc(page) {
  const src = await page.evaluate(() => {
    const img = document.querySelector(".card-page.front .logo-wrap img");
    return img ? img.getAttribute("src") || "" : "";
  });
  return src || "";
}

async function resolveFrontLogoAsset(page, htmlPath) {
  const src = await resolveFrontLogoSrc(page);

  if (!src) return { kind: "none", absPath: null };

  // Resolve relative to the HTML file on disk.
  const abs = path.resolve(path.dirname(htmlPath), src);
  const lower = src.toLowerCase();
  if (lower.endsWith(".pdf")) return { kind: "pdf", absPath: abs };
  if (lower.endsWith(".svg")) return { kind: "svg", absPath: abs };
  return { kind: "other", absPath: abs };
}

async function inlineFrontSvgLogoDom(page, svgAbsPath) {
  if (!svgAbsPath || !fs.existsSync(svgAbsPath)) return;

  let raw = fs.readFileSync(svgAbsPath, "utf8");
  raw = raw.replace(/<\?xml[^>]*\?>/gi, "").replace(/<!doctype[^>]*>/gi, "");

  await page.evaluate((svgMarkup) => {
    const wrap = document.querySelector(".card-page.front .logo-wrap");
    if (!wrap) return;
    wrap.querySelectorAll("img").forEach((n) => n.remove());
    wrap.insertAdjacentHTML("beforeend", svgMarkup);
    const svg = wrap.querySelector("svg");
    if (svg) {
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.display = "block";
      if (!svg.getAttribute("preserveAspectRatio")) {
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      }
    }
  }, raw);
}

async function htmlToVectorPdf({ browser, htmlPath, outPath }) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  page.setDefaultNavigationTimeout(60_000);

  await page.goto(toFileUrl(htmlPath), { waitUntil: "networkidle0" });

  // Apply print overrides first so measurements match PDF layout.
  await applyPdfPrintOverrides(page);

  // Determine logo source type from HTML.
  const logoAsset = await resolveFrontLogoAsset(page, htmlPath);
  const logoBox = await getFrontLogoBox(page);

  // If the logo is referenced as SVG, inline it as real <svg> (reliable in PDF).
  if (logoAsset.kind === "svg") {
    await inlineFrontSvgLogoDom(page, logoAsset.absPath);
  }

  // If the logo is referenced as a PDF, remove the <img> so Chrome doesn't try
  // (and fail) to render a PDF as an image. We'll stamp it after PDF generation.
  if (logoAsset.kind === "pdf") {
    await removeLogoImg(page);
  }

  const pdfBytes = await page.pdf({
    printBackground: true,
    preferCSSPageSize: true, // respects @page size in HTML (@page { size: ... })
    margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
  });

  await page.close();

  // Default: just write the HTML-rendered PDF.
  if (logoAsset.kind !== "pdf" || !logoAsset.absPath || !logoBox || !fs.existsSync(logoAsset.absPath)) {
    fs.writeFileSync(outPath, pdfBytes);
    return;
  }

  const outDoc = await PDFDocument.load(pdfBytes);
  const logoBytes = fs.readFileSync(logoAsset.absPath);
  const [embeddedLogo] = await outDoc.embedPdf(logoBytes);

  const firstPage = outDoc.getPage(0);

  // Convert measured CSS px box → PDF points, and convert top-left coords → bottom-left.
  const boxWpt = pxToPt(logoBox.w);
  const boxHpt = pxToPt(logoBox.h);
  const xPt = pxToPt(logoBox.x);
  const yPt = pxToPt(logoBox.pageH - (logoBox.y + logoBox.h));

  // "contain" fit like CSS object-fit: contain
  const logoW = embeddedLogo.width;
  const logoH = embeddedLogo.height;
  const scale = Math.min(boxWpt / logoW, boxHpt / logoH);
  const drawW = logoW * scale;
  const drawH = logoH * scale;
  const dx = xPt + (boxWpt - drawW) / 2;
  const dy = yPt + (boxHpt - drawH) / 2;

  firstPage.drawPage(embeddedLogo, {
    x: dx,
    y: dy,
    width: drawW,
    height: drawH,
  });

  const finalBytes = await outDoc.save();
  fs.writeFileSync(outPath, finalBytes);
}

(async () => {
  const projectDir = path.resolve(__dirname, "..");
  const distDir = path.join(projectDir, "dist");
  fs.mkdirSync(distDir, { recursive: true });

  const targets = [
    { html: path.join(projectDir, "src", "businesscard_en.html"), out: path.join(distDir, "businesscard_en.pdf") },
    { html: path.join(projectDir, "src", "businesscard_tr.html"), out: path.join(distDir, "businesscard_tr.pdf") },
  ];

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: pickChromeExecutable(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    for (const t of targets) {
      if (!fs.existsSync(t.html)) continue;
      await htmlToVectorPdf({ browser, htmlPath: t.html, outPath: t.out });
      // eslint-disable-next-line no-console
      console.log(`Wrote ${t.out}`);
    }
  } finally {
    await browser.close();
  }
})();

