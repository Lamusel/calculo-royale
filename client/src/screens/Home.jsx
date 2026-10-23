import { useState } from 'react';
import { NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@calculo-royale/shared/constants';
import { createRoom, joinRoom, loadName, saveName } from '../net/session.js';

const codeFromUrl = () =>
  (new URLSearchParams(location.search).get('code') ?? '').toUpperCase().slice(0, ROOM_CODE_LENGTH);

export default function Home({ connected, notice, onEnter }) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(codeFromUrl);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canJoin = connected && !busy && name.trim() && code.length === ROOM_CODE_LENGTH;

  async function run(action) {
    saveName(name.trim());
    setBusy(true);
    setError('');
    const res = await action();
    setBusy(false);
    if (res.ok) {
      // Se quita solo el código: otros parámetros (?debug, ?calidad) se conservan
      const url = new URL(location.href);
      url.searchParams.delete('code');
      history.replaceState(null, '', url);
      onEnter(res);
    } else {
      setError(res.error);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center overflow-y-auto bg-gradient-to-br from-olive-950 via-stone-900 to-olive-900 p-4 text-stone-100">
      <div className="flex w-full max-w-3xl flex-col items-center gap-6 sm:flex-row sm:items-stretch sm:gap-10">
        <div className="flex flex-col items-center justify-center gap-2 text-center sm:items-start sm:text-left">
          <h1 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">
            Cálculo <span className="text-khaki">Royale</span>
          </h1>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-stone-400">Battle royale militar · Cálculo Multivariable</p>
          <div className="mt-1 flex items-center gap-2 text-sm text-stone-400">
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-500'}`} />
            {connected ? 'Conectado' : 'Conectando…'}
          </div>
        </div>

        <form
          className="flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-stone-800/70 p-5 shadow-xl backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault();
            if (canJoin) run(() => joinRoom(code, name));
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, NAME_MAX_LENGTH))}
            placeholder="Tu nombre"
            autoComplete="nickname"
            className="rounded-xl bg-stone-900 px-4 py-3 text-lg outline-none ring-khaki focus:ring-2"
          />
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, ROOM_CODE_LENGTH))}
              placeholder="CÓDIGO"
              autoCapitalize="characters"
              className="w-0 flex-1 rounded-xl bg-stone-900 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] outline-none ring-khaki focus:ring-2"
            />
            <button
              type="submit"
              disabled={!canJoin}
              className="rounded-xl bg-khaki px-5 font-bold text-olive-950 transition disabled:opacity-40"
            >
              Entrar
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs text-stone-500">
            <div className="h-px flex-1 bg-stone-700" /> o <div className="h-px flex-1 bg-stone-700" />
          </div>
          <button
            type="button"
            disabled={!connected || busy || !name.trim()}
            onClick={() => run(() => createRoom(name))}
            className="rounded-xl border border-stone-600 py-2.5 font-semibold text-stone-200 transition hover:bg-stone-700 disabled:opacity-40"
          >
            Crear sala (profe)
          </button>
          {(error || notice) && <p className="text-center text-sm text-red-400">{error || notice}</p>}
        </form>
      </div>
    </main>
  );
}
