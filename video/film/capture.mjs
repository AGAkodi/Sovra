// Captures real Sovra screens for the film at 2x device pixels (headless Edge, DevTools protocol).
// Usage: node capture.mjs [baseUrl]   (default http://localhost:5173)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:5173';
const OUT = path.resolve('assets/captures');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9334;
fs.mkdirSync(OUT, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'film-'));
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch {}
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
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

async function go(url, readyExpr, extraWait = 1500) {
  await send('Page.navigate', { url });
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    if (await evaluate(readyExpr)) break;
  }
  await sleep(extraWait);
}
async function nav(label) {
  await evaluate(`[...document.querySelectorAll('aside button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(label)}))?.click()`);
  await sleep(1800);
}
/** Screenshot of the element matched by a JS expression returning an Element, with padding. */
async function shotOf(name, elExpr, pad = 0) {
  const r = await evaluate(`(() => { const el = ${elExpr}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: b.x + scrollX, y: b.y + scrollY, w: b.width, h: b.height }; })()`);
  if (!r) return console.log('MISSING', name);
  await sleep(400);
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.w + pad * 2, height: r.h + pad * 2, scale: 1 },
  });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log('saved', name, Math.round(r.w), 'x', Math.round(r.h));
}
async function fullShot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log('saved', name);
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 2, mobile: false });
  const appReady = `!!document.querySelector('aside') && !document.querySelector('[aria-busy="true"]')`;

  await go(`${BASE}/app`, appReady, 2500);
  await fullShot('app-home');
  await shotOf('home-today', `[...document.querySelectorAll('main section')][0]`);
  await shotOf('home-scenarios', `[...document.querySelectorAll('main section')].find(s => s.innerText.includes('Try a scenario'))`);

  await nav('Approvals');
  await shotOf('approvals-slip', `document.querySelector('main article')`, 24);
  await fullShot('app-approvals');

  await nav('Activity');
  await shotOf('activity-stopped', `[...document.querySelectorAll('main li')].find(li => li.innerText.includes('The vault stopped 8 NEAR'))`);
  await shotOf('activity-day', `document.querySelector('main section')`);

  await nav('Agent');
  await shotOf('agent-trust', `[...document.querySelectorAll('main section')][0]`);

  await nav('Settings');
  await shotOf('settings-keys', `[...document.querySelectorAll('main .rounded-card')].find(c => c.innerText.startsWith('Keys'))`);

  await go(`${BASE}/`, `!!document.querySelector('#proof')`, 2000);
  await shotOf('landing-proof-table', `document.querySelector('#proof .rounded-card')`);
  await shotOf('landing-hero', `document.querySelector('main section')`);

  // The real on-chain receipt of the refused hidden-instruction payment.
  await go('https://testnet.nearblocks.io/txns/GC1BPjH5Sjcx4vfvDE7FZGNYtgjx9yTb4QFLem6uPiUN', `document.body && document.body.innerText.length > 2000`, 5000);
  await fullShot('nearblocks-refused');
} finally {
  ws.close();
  edge.kill();
}
