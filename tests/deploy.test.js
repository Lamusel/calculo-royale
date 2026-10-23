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
