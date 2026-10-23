// Despliegue (npm test): orígenes permitidos por CORS
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrigins } from '../server/src/origins.js';

const allowed = (origins, url) => origins.some((o) => (o instanceof RegExp ? o.test(url) : o === url));

test('CLIENT_ORIGIN vacío permite cualquier origen (desarrollo)', () => {
  assert.equal(parseOrigins(''), true);
  assert.equal(parseOrigins(undefined), true);
});

test('CLIENT_ORIGIN con varias URLs y comodín para las vistas previas de Vercel', () => {
  const origins = parseOrigins('https://calculo-royale.vercel.app/, https://*.vercel.app');
  assert.ok(allowed(origins, 'https://calculo-royale.vercel.app'), 'sin la barra final');
  assert.ok(allowed(origins, 'https://calculo-royale-git-main-lamusel.vercel.app'));
  assert.ok(!allowed(origins, 'https://evil.com'));
  assert.ok(!allowed(origins, 'https://a.b.vercel.app.evil.com'));
});

test('vercel.json: /skins y /espectador van a la app; los GLB se cachean y un /assets faltante no da index.html', async () => {
  const { readFile } = await import('node:fs/promises');
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  // Vercel usa la sintaxis de path-to-regexp; estas fuentes son expresiones regulares válidas tal cual
  const matches = (source, path) => new RegExp(`^${source}$`).test(path);
  const rewrite = config.rewrites[0];
  assert.equal(rewrite.destination, '/index.html');
  for (const path of ['/skins', '/skins/stress', '/espectador', '/galeria', '/']) assert.ok(matches(rewrite.source, path), path);
  assert.ok(!matches(rewrite.source, '/assets/skins/external/externa_01/character.glb'));
  const header = (path) => config.headers.find((h) => matches(h.source, path))?.headers[0].value;
  assert.match(header('/assets/skins/external/externa_01/character.glb'), /max-age=86400/);
  assert.match(header('/assets/index-abc123.js'), /immutable/);
});

test('/health informa CPU, memoria, tick y jugadores conectados', async () => {
  const { readMetrics, recordTick } = await import('../server/src/metrics.js');
  recordTick(2);
  recordTick(4);
  const rooms = new Map([['ABCD', { players: new Map([[1, { connected: true }], [2, { connected: false }]]) }]]);
  const m = readMetrics(rooms);
  assert.equal(m.players, 1);
  assert.equal(m.tick.avgMs, 3);
  assert.equal(m.tick.maxMs, 4);
  assert.ok(m.memoryMb.rss > 0 && m.cpuPercent >= 0);
  assert.equal(readMetrics(rooms).tick.count, 0, 'la ventana se reinicia');
});
