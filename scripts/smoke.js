// Prueba de humo en el navegador (sin dependencias nuevas): abre Edge o Chrome sin interfaz por su
// protocolo de depuración, crea una sala, inicia la partida y muestra los errores de la consola.
// Uso (con npm run dev corriendo): node scripts/smoke.js [url]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

const URL_BASE = process.argv[2] ?? 'http://localhost:5173/?intro=0';
const browser = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((b) => fs.existsSync(b));
const port = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-smoke-'));
const proc = spawn(browser, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1280,720', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let tab = null;
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(250);
  try {
    tab = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
  } catch {}
}
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => ws.once('open', r));
let id = 0;
const pending = new Map();
const errors = [];
ws.on('message', (raw) => {
  const msg = JSON.parse(raw);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(`${msg.params.entry.text} ${msg.params.entry.url ?? ''}`);
});
const send = (method, params = {}) => new Promise((r) => {
  pending.set(++id, r);
  ws.send(JSON.stringify({ id, method, params }));
});
const run = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }))?.result?.value;
// Escribe en un input controlado por React y toca un botón por su texto
const type = (sel, text) => run(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); if (!i) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(text)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const click = (text) => run(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true; })()`);

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Page.navigate', { url: URL_BASE });
// La primera carga en desarrollo tarda: espera hasta que aparezca el campo del nombre
for (let i = 0; i < 60 && !(await run("Boolean(document.querySelector('input'))")); i++) await sleep(500);
const steps = [];
steps.push(['nombre', await type('input', 'Humo')]);
steps.push(['crear sala', await click('Crear sala')]);
await sleep(4000);
steps.push(['bots', await run(`(() => { const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => /bots/i.test(o.textContent))); if (!s) return false; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, s.options[2].value); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`)]);
await sleep(1500);
steps.push(['iniciar', await click('Iniciar')]);
await sleep(12000);
const state = await run(`({ canvas: Boolean(document.querySelector('canvas')), texto: document.body.innerText.slice(0, 160).replace(/\\s+/g, ' ') })`);
console.log('Pasos:', steps.map(([n, ok]) => `${n}=${ok ? 'sí' : 'no'}`).join(', '));
console.log('Pantalla:', JSON.stringify(state));
console.log(errors.length ? `Errores (${errors.length}):\n- ${[...new Set(errors)].slice(0, 12).join('\n- ')}` : 'Sin errores en la consola');
ws.close();
proc.kill();
process.exit(0);
