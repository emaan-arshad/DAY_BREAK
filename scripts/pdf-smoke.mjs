import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve(process.cwd(), "output");
const outputPath = path.join(outputDir, "smoke.pdf");

async function runSmokeTest() {
  fs.mkdirSync(outputDir, { recursive: true });

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date());

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>DAYBREAK — Morning Edition Smoke Test</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm;
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background-color: #F5F1E8;
      color: #191919;
      font-family: Georgia, "Times New Roman", serif;
      line-height: 1.6;
    }
    .page {
      padding: 12mm;
      background-color: #F5F1E8;
    }
    header {
      border-bottom: 2px solid #191919;
      padding-bottom: 12px;
      margin-bottom: 24px;
      text-align: center;
    }
    .kicker {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 10pt;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #A84432;
      margin: 0 0 6px 0;
      font-weight: 600;
    }
    h1 {
      font-size: 36pt;
      letter-spacing: 0.06em;
      margin: 0;
      font-weight: 700;
    }
    .dateline {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #191919;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 9.5pt;
      color: #191919;
    }
    h2 {
      font-size: 18pt;
      margin: 0 0 10px 0;
    }
    p {
      font-size: 11.5pt;
      margin: 0 0 14px 0;
      text-align: justify;
    }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <p class="kicker">Personal Morning Paper · Print Verification</p>
      <h1>DAYBREAK</h1>
      <div class="dateline">${today} · Edition No. 0 (Smoke Test)</div>
    </header>
    <article>
      <h2>Print Pipeline Verification</h2>
      <p>
        Daybreak delivers one finite, thoughtfully edited morning edition tailored to each reader's interests, goals, and reading time budget. Both the web reader and the printable newspaper PDF are driven by a single immutable edition snapshot.
      </p>
      <p>
        This smoke test confirms that Playwright Chromium renders our A4 portrait print stylesheet, preserves warm newsprint background tones, and writes a valid multi-kilobyte PDF artifact on the target machine and in CI.
      </p>
    </article>
  </main>
</body>
</html>`;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({
      path: outputPath,
      preferCSSPageSize: true,
      printBackground: true,
    });
  } finally {
    await browser.close();
  }

  if (!fs.existsSync(outputPath)) {
    console.error(`Smoke PDF missing at ${outputPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(outputPath);
  if (stats.size < 1024) {
    console.error(`Smoke PDF too small (${stats.size} bytes < 1024 bytes)`);
    process.exit(1);
  }

  console.log(`PDF smoke test passed: ${outputPath} (${stats.size} bytes)`);
}

runSmokeTest().catch((err) => {
  console.error("PDF smoke test failed:", err);
  process.exit(1);
});
