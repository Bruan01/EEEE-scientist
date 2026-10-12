#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('../src/ui/node_modules/playwright');

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const baseUrl = process.env.DEEPSCIENTIST_BASE_URL || 'http://127.0.0.1:20999';
const outputRoot =
  process.env.DEEPSCIENTIST_RECORDING_DIR || path.join(os.homedir(), 'DeepScientist', 'cache', 'demo-recordings');
const viewport = { width: 2560, height: 1440 };

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function rmrf(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function exists(targetPath) {
  try {
    fs.accessSync(targetPath);
    return true;
  } catch {
    return false;
  }
}

function fetchJson(url) {
  const raw = execFileSync('curl', ['-sS', '--max-time', '15', url], { encoding: 'utf8' });
  return JSON.parse(raw);
}

function assertDaemonHealthy() {
  const health = fetchJson(`${baseUrl}/api/health`);
  if (!health || health.status !== 'ok') {
    throw new Error(`DeepScientist daemon is not healthy at ${baseUrl}`);
  }
}

function ffmpeg(args, { quiet = false } = {}) {
  return execFileSync('ffmpeg', args, {
    cwd: repoRoot,
    stdio: quiet ? 'ignore' : 'inherit',
  });
}

function ffprobeJson(targetPath) {
  return JSON.parse(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_streams',
        '-show_format',
        targetPath,
      ],
      { encoding: 'utf8' }
    )
  );
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function moveOnly(page, locator, waitAfterMs = 600) {
  await locator.waitFor({ state: 'visible', timeout: 30_000 });
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Could not resolve locator bounding box for mouse move.');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 32 });
  await wait(waitAfterMs);
}

async function moveAndClick(page, locator, waitAfterMs = 1200) {
  await locator.waitFor({ state: 'visible', timeout: 30_000 });
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Could not resolve locator bounding box for click.');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
  await page.mouse.down();
  await page.mouse.up();
  await wait(waitAfterMs);
}

async function moveAndDoubleClick(page, locator, waitAfterMs = 1500) {
  await locator.waitFor({ state: 'visible', timeout: 30_000 });
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Could not resolve locator bounding box for double click.');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 34 });
  await page.mouse.down();
  await page.mouse.up();
  await wait(120);
  await page.mouse.down();
  await page.mouse.up();
  await wait(waitAfterMs);
}

async function smoothWheel(page, totalDeltaY, slices = 3, waitAfterMs = 900) {
  const step = Math.trunc(totalDeltaY / slices);
  for (let index = 0; index < slices; index += 1) {
    const delta = index === slices - 1 ? totalDeltaY - step * (slices - 1) : step;
    await page.mouse.wheel(0, delta);
    await wait(260);
  }
  await wait(waitAfterMs);
}

async function closeCopilotPanel(page) {
  const hideButtons = page.getByRole('button', { name: 'Hide Copilot' });
  const count = await hideButtons.count();
  if (count === 0) {
    return;
  }
  const hideButton = hideButtons.nth(Math.max(0, count - 1));
  await moveAndClick(page, hideButton, 600);
  await wait(1800);
}

async function guidedFlow(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByText('English Demo', { exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
  await wait(1500);

  await moveAndClick(page, page.getByRole('button', { name: 'English', exact: true }), 700);
  await moveAndClick(page, page.getByRole('button', { name: /English Demo/ }).first(), 1800);
  await moveAndClick(page, page.getByRole('button', { name: 'Next', exact: true }), 1200);
  await moveAndClick(page, page.getByRole('button', { name: 'Start Research', exact: true }), 2200);
  await wait(3500);
}

async function quest025Flow(page) {
  await page.goto(`${baseUrl}/projects/025`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await wait(16_000);

  await moveAndClick(page, page.getByText('status.md', { exact: true }).first(), 2600);
  await moveAndClick(page, page.getByText('SUMMARY.md', { exact: true }).first(), 2400);

  const paperNode = page.locator('[data-node-id="quest-dir::025::paper"]');
  await moveOnly(page, paperNode, 250);
  await paperNode.dblclick();
  await wait(900);

  const latexNode = page.locator('[data-node-id="quest-dir::025::paper%2Flatex"]');
  await moveOnly(page, latexNode, 250);
  await latexNode.dblclick();
  await wait(4500);

  const mainTex = page.getByRole('combobox', { name: 'LaTeX file' }).first();
  if (await mainTex.isVisible().catch(() => false)) {
  await moveOnly(page, mainTex, 800);
  } else {
    await moveOnly(page, page.getByText('iclr2026_conference.tex', { exact: true }).last(), 800);
  }

  await moveAndClick(page, page.getByRole('button', { name: 'Compile', exact: true }), 8500);
  await closeCopilotPanel(page);

  await moveAndClick(page, page.getByRole('button', { name: 'Zoom out' }).first(), 700);
  await moveAndClick(page, page.getByRole('button', { name: 'Zoom out' }).first(), 1200);

  await page.mouse.move(2060, 760, { steps: 40 });
  await smoothWheel(page, 2600, 4, 1200);
  await page.mouse.move(2060, 860, { steps: 32 });
  await smoothWheel(page, 2600, 4, 1200);
}

async function recordSegment(segmentName, flow) {
  ensureDir(outputRoot);
  const tempDir = path.join(outputRoot, `.tmp-${segmentName}`);
  rmrf(tempDir);
  ensureDir(tempDir);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport,
    screen: viewport,
    locale: 'en-US',
    colorScheme: 'light',
    deviceScaleFactor: 1,
    recordVideo: {
      dir: tempDir,
      size: viewport,
    },
  });
  const page = await context.newPage();

  try {
    await flow(page);
  } finally {
    await context.close();
    await browser.close();
  }

  const files = fs
    .readdirSync(tempDir)
    .filter((entry) => entry.endsWith('.webm'))
    .map((entry) => path.join(tempDir, entry));
  if (files.length !== 1) {
    throw new Error(`Expected exactly one recorded video for ${segmentName}, found ${files.length}.`);
  }
  const destination = path.join(outputRoot, `${segmentName}-2560x1440.webm`);
  if (exists(destination)) {
    fs.rmSync(destination, { force: true });
  }
  fs.renameSync(files[0], destination);
  rmrf(tempDir);
  return destination;
}

function transcodeToMp4(sourceWebm, targetMp4) {
  if (exists(targetMp4)) {
    fs.rmSync(targetMp4, { force: true });
  }
  ffmpeg(
    [
      '-y',
      '-i',
      sourceWebm,
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      targetMp4,
    ],
    { quiet: true }
  );
}

function concatMp4(inputs, targetMp4) {
  const manifestPath = path.join(outputRoot, '.concat-list.txt');
  const manifest = inputs.map((item) => `file '${item.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(manifestPath, `${manifest}\n`, 'utf8');
  try {
    if (exists(targetMp4)) {
      fs.rmSync(targetMp4, { force: true });
    }
    ffmpeg(
      [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        manifestPath,
        '-c',
        'copy',
        targetMp4,
      ],
      { quiet: true }
    );
  } finally {
    fs.rmSync(manifestPath, { force: true });
  }
}

function writeMetadata(targetPath) {
  const info = ffprobeJson(targetPath);
  const metadataPath = `${targetPath}.json`;
  fs.writeFileSync(metadataPath, `${JSON.stringify(info, null, 2)}\n`, 'utf8');
}

async function main() {
  const mode = process.argv[2] || 'full';
  assertDaemonHealthy();

  if (!['guided', 'quest025', 'full'].includes(mode)) {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  const outputs = {};

  if (mode === 'guided' || mode === 'full') {
    const guidedWebm = await recordSegment('guided-demo', guidedFlow);
    const guidedMp4 = path.join(outputRoot, 'guided-demo-2560x1440.mp4');
    transcodeToMp4(guidedWebm, guidedMp4);
    writeMetadata(guidedMp4);
    outputs.guided = guidedMp4;
  }

  if (mode === 'quest025' || mode === 'full') {
    const questWebm = await recordSegment('quest-025-demo', quest025Flow);
    const questMp4 = path.join(outputRoot, 'quest-025-demo-2560x1440.mp4');
    transcodeToMp4(questWebm, questMp4);
    writeMetadata(questMp4);
    outputs.quest025 = questMp4;
  }

  if (mode === 'full') {
    const fullMp4 = path.join(outputRoot, 'full-demo-2560x1440.mp4');
    concatMp4([outputs.guided, outputs.quest025], fullMp4);
    writeMetadata(fullMp4);
    outputs.full = fullMp4;
  }

  process.stdout.write(`${JSON.stringify(outputs, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
