// Regenerate the hero poster webps from the REAL 3D, per device aspect + theme.
//
// Why: the hero camera frames the car by viewport aspect (CarStage.tsx) — phones
// (portrait) pull the camera back, desktop (landscape) fits to width — so one
// landscape screenshot can't stand in for all of them. This drives the /capture
// route headlessly at phone/tablet/desktop sizes in light & dark, reads the
// transparent canvas, and writes public/images/car-poster-*.webp.
//
// Run (dev server must be up on :3000):  node scripts/capture-posters.mjs
// Needs: puppeteer + sharp (npm i -D puppeteer).

import puppeteer from "puppeteer";
import sharp from "sharp";
import fs from "fs";

const BASE = process.env.CAPTURE_URL || "http://localhost:3000/capture";

// css viewport per slot + the final webp width we downscale to. Mobile/tablet
// are PORTRAIT (matches the pulled-back framing); desktop is landscape.
const SLOTS = [
  { slot: "mobile", w: 412, h: 892, out: 1080 },
  { slot: "tablet", w: 834, h: 1112, out: 1280 },
  { slot: "desktop", w: 1920, h: 1080, out: 1920 },
];
const MODES = ["light", "dark"];

const fileFor = (mode, slot) =>
  slot === "desktop"
    ? `public/images/car-poster-${mode}.webp`
    : `public/images/car-poster-${mode}-${slot}.webp`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--enable-unsafe-swiftshader", // allow software WebGL with no GPU
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});

try {
  for (const mode of MODES) {
    for (const { slot, w, h, out } of SLOTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      const url = `${BASE}?mode=${mode}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
      // wait for the model to load (CapturePage flags the body), then let the
      // IBL + contact shadow + AA settle over a few frames.
      await page.waitForSelector("body[data-car-ready='true']", {
        timeout: 120000,
      });
      await sleep(1500);

      const dataUrl = await page.evaluate(() => {
        const c = document.querySelector("canvas");
        return c ? c.toDataURL("image/webp", 0.95) : null;
      });
      await page.close();

      if (!dataUrl || dataUrl.length < 5000) {
        console.error(`✗ ${mode}/${slot}: blank/empty canvas (WebGL failed?)`);
        continue;
      }
      const raw = Buffer.from(dataUrl.split(",")[1], "base64");
      const webp = await sharp(raw)
        .resize({ width: out, withoutEnlargement: true })
        .webp({ quality: 80, alphaQuality: 90 })
        .toBuffer();
      const file = fileFor(mode, slot);
      fs.writeFileSync(file, webp);
      const meta = await sharp(webp).metadata();
      console.log(
        `✓ ${file}  ${meta.width}x${meta.height}  ${(webp.length / 1024).toFixed(0)}KB  alpha=${meta.hasAlpha}`,
      );
    }
  }
} finally {
  await browser.close();
}
