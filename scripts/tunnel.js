// Túnel rápido de Cloudflare (sin cuenta) hacia el cliente de Vite.
// Vite redirige /socket.io al servidor, así que un solo túnel sirve para todo.
// Uso: npm run dev en una terminal y npm run tunnel en otra.
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bin, install, Tunnel } from 'cloudflared';

const TARGET = 'http://localhost:5173';
// El servidor lee este archivo para que el QR de la sala use la URL pública
const URL_FILE = fileURLToPath(new URL('../.tunnel-url', import.meta.url));

if (!existsSync(bin)) {
  console.log('Descargando cloudflared (solo la primera vez)…');
  await install(bin);
}

const cleanup = () => rmSync(URL_FILE, { force: true });
cleanup();

console.log(`Abriendo túnel hacia ${TARGET}…`);
const tunnel = Tunnel.quick(TARGET);

tunnel.once('url', (url) => {
  writeFileSync(URL_FILE, url);
  const line = '═'.repeat(url.length + 4);
  console.log(`\n╔${line}╗\n║  ${url}  ║\n╚${line}╝`);
  console.log('Abre esa URL en el celular, o crea la sala y escanea el QR (ya usa el túnel).');
  console.log('Ctrl+C para cerrar.\n');
});

tunnel.once('connected', (c) => console.log(`Conectado a Cloudflare (${c.location}).`));

tunnel.on('exit', (code) => {
  cleanup();
  console.log(`El túnel se cerró (código ${code}).`);
  process.exit(code ?? 0);
});

const stop = () => {
  cleanup();
  tunnel.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
