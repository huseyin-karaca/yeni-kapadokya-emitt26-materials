const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer");

const argv = process.argv.slice(2);

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

async function inlineSvgLogo(page, projectDir) {
  const logos = ["logo-vector-yazisiz.svg", "logo-vector-ingilizce.svg", "logo-vector-turkce.svg"];
  
  for (const logoFilename of logos) {
      const logoPath = path.join(projectDir, "assets", "logos", logoFilename);
      try {
        if (fs.existsSync(logoPath)) {
          const svgContent = fs.readFileSync(logoPath, "utf8");
          const base64 = Buffer.from(svgContent).toString("base64");
          const dataUri = `data:image/svg+xml;base64,${base64}`;
    
          await page.evaluate((uri, filename) => {
            const imgs = document.querySelectorAll("img");
            for (const img of imgs) {
              const src = img.getAttribute("src");
              if (src && src.includes(filename)) {
                img.src = uri;
              }
            }
          }, dataUri, logoFilename);
        }
      } catch (e) {
        console.error("Failed to inline SVG logo:", e);
      }
  }
}

(async () => {
  const projectDir = path.resolve(__dirname, '..');
  const chromeExecutable = pickChromeExecutable();

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: chromeExecutable,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1200, height: 200 },
  });

  try {
    const htmlPath = path.join(projectDir, "src", "kapak.html");
    if (!fs.existsSync(htmlPath)) {
      throw new Error(`Missing kapak.html at ${htmlPath}`);
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 200, deviceScaleFactor: 1 }); // Strict 1x scale
    
    await page.goto(toFileUrl(htmlPath), { waitUntil: "networkidle0" });

    // Inline SVG to ensure it renders
    await inlineSvgLogo(page, projectDir);

    // Wait for fonts
    await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
    });

    const outPath = path.join(projectDir, "dist", "kapak.png");
    
    await page.screenshot({
      path: outPath,
      type: "png",
      clip: { x: 0, y: 0, width: 1200, height: 200 } // Strict clipping
    });

    console.log(`Wrote ${outPath}`);
  } finally {
    await browser.close();
  }
})();
