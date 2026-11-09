// Renders the Sovra mark to PNG icons with headless Edge.
// Usage: node scripts/render-icons.mjs [preview]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const PUBLIC = path.join(ROOT, 'frontend', 'public');
const mark = fs.readFileSync(path.join(PUBLIC, 'sovra-mark.svg'), 'utf8');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9335;
const preview = process.argv[2] === 'preview';

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-'));
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page');
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

async function render(file, size, { bg = '#141415', radius = 0.22, pad = 0.16, transparent = false } = {}) {
  const inner = Math.round(size * (1 - pad * 2));
  const html = `<!doctype html><html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
      background:${transparent ? 'transparent' : bg};border-radius:${transparent ? 0 : Math.round(size * radius)}px">
      <div style="width:${inner}px;height:${inner}px">${mark.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
    </div></body></html>`;
  await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await send('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') });
  await sleep(500);
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  console.log('saved', path.relative(ROOT, file), size);
}

try {
  await send('Page.enable');
  if (preview) {
    const out = path.join(os.tmpdir(), 'sovra-mark-preview.png');
    await render(out, 512, { pad: 0.12 });
  } else {
    await render(path.join(PUBLIC, 'apple-touch-icon.png'), 180, { radius: 0, pad: 0.16 });
    await render(path.join(PUBLIC, 'favicon-32.png'), 32, { pad: 0.08 });
    await render(path.join(PUBLIC, 'icon-192.png'), 192, { pad: 0.16 });
    await render(path.join(PUBLIC, 'icon-512.png'), 512, { pad: 0.16 });
  }
} finally {
  ws.close();
  edge.kill();
}
