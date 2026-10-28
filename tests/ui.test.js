// Interfaz (npm test): cola de mensajes del Mando con prioridad
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RADIO_MAX_WAIT_MS } from '@calculo-royale/shared/constants';
import { currentMessage } from '../client/src/ui/messageQueue.js';

const msg = (kind, at, durationMs = 6000) => ({ kind, at, durationMs, title: kind });

test('cola del Mando: uno a la vez, el siguiente espera su turno', () => {
  const list = [msg('leader', 0), msg('gulag', 1000, 5000)];
  assert.equal(currentMessage(list, 500).message.kind, 'leader');
  assert.equal(currentMessage(list, 5900).message.kind, 'leader', 'no lo pisa el que llegó después');
  const next = currentMessage(list, 6500);
  assert.equal(next.message.kind, 'gulag');
  assert.equal(next.start, 6000);
  assert.equal(currentMessage(list, 11500), null);
});

test('cola del Mando: el cierre de zona interrumpe; lo interrumpido casi sin verse vuelve después', () => {
  const list = [msg('leader', 0), msg('closing', 1000)];
  assert.equal(currentMessage(list, 1200).message.kind, 'closing');
  const back = currentMessage(list, 7500);
  assert.equal(back.message.kind, 'leader');
  assert.equal(back.end, 12000, 'le quedaban 5 s');
  // Si ya se había visto lo suficiente, no vuelve
  const seen = [msg('leader', 0), msg('closing', 4000)];
  assert.equal(currentMessage(seen, 10500), null);
});

test('cola del Mando: a igual espera pasa primero el más importante y los viejos se descartan', () => {
  const list = [msg('duel', 0, 8000), msg('gulag', 100), msg('closing', 200)];
  assert.equal(currentMessage(list, 8500).message.kind, 'closing');
  assert.equal(currentMessage(list, 14500).message.kind, 'gulag');
  const stale = [msg('final', 0, RADIO_MAX_WAIT_MS + 5000), msg('gulag', 10)];
  assert.equal(currentMessage(stale, RADIO_MAX_WAIT_MS + 5500), null, 'esperó demasiado');
});
