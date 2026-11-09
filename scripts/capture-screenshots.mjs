// Captures dashboard screenshots with headless Edge over the DevTools protocol.
// Usage: node scripts/capture-screenshots.mjs docs/screenshots [only=01-overview,05-approvals]
// Needs Microsoft Edge (Windows default path). Captures the hosted dashboard, read-only: no wallet, no clicks that act.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OUT = process.argv[2];
const ONLY = (process.argv[3] || '').replace(/^only=/, '').split(',').filter(Boolean);
const URL = process.env.SHOTS_URL || 'https://sovra-near.vercel.app';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333;
fs.mkdirSync(OUT, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'shots-'));

const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--no-first-run', '--force-dark-mode', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch { /* not up yet */ }
  if (!ws) await sleep(250);
}
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pending = new Map();
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
  }
});
const send = (method, params = {}) =>
  new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

async function viewport(width, height, mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
}
async function load() {
  await send('Page.navigate', { url: URL });
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const ready = await evaluate(`!!document.querySelector('aside') && !document.querySelector('[aria-busy="true"]')`);
    if (ready) break;
  }
  await sleep(1500);
}
async function nav(label) {
  await evaluate(`[...document.querySelectorAll('aside button')].find(b => b.textContent.includes(${JSON.stringify(label)}))?.click()`);
  await sleep(1200);
}
async function shot(name) {
  if (ONLY.length && !ONLY.includes(name)) return;
  const full = process.env.SHOTS_FULL === '1';
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log('saved', name);
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });

  await viewport(1440, 960);
  await load();
  await shot('01-home');
  await nav('Agent'); await shot('02-agent');
  await nav('Payments'); await shot('03-payments');
  // Evidence drawer for the most recent owner-approved spike.
  await evaluate(`[...document.querySelectorAll('main button')].find(b => b.innerText.includes('Paid after your approval'))?.click()`);
  await sleep(2000);
  await shot('04-evidence-drawer');
  await evaluate(`document.querySelector('[aria-label="Close"], [aria-label="Close drawer"]')?.click(); document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))`);
  await load();
  await nav('Approvals'); await shot('05-approvals');
  await nav('Limits'); await shot('06-limits');
  await nav('Activity'); await shot('07-activity');

  await viewport(390, 844, true);
  await load();
  await shot('08-mobile-home');
  await nav('Payments'); await shot('09-mobile-payments');
  await nav('Approvals'); await shot('10-mobile-approvals');
} finally {
  ws.close();
  edge.kill();
}
