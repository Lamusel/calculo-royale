import { useCallback, useEffect, useState } from 'react';
import { NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@calculo-royale/shared/constants';
import { createRoom, joinRoom, loadName, saveName } from '../net/session.js';
import Intro, { Credits, shouldShowIntro } from '../ui/Intro.jsx';
import Logo from '../ui/Logo.jsx';
import Options from '../ui/Options.jsx';
import SkinPicker, { SkinPortrait } from '../ui/SkinPicker.jsx';
import { loadSkin } from '../achievements.js';
import { getSkinEntry } from '../game/character/skins/index.js';

const codeFromUrl = () =>
  (new URLSearchParams(location.search).get('code') ?? '').toUpperCase().slice(0, ROOM_CODE_LENGTH);

// Render (plan gratis) duerme el servidor: el primer arranque puede tardar ~50 s
function WakeUp({ connected }) {
  const [since, setSince] = useState(() => performance.now());
  const [, tick] = useState(0);
  useEffect(() => {
    if (connected) return;
    setSince(performance.now());
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [connected]);
  if (connected) {
    return (
      <div className="mt-1 flex items-center gap-2 text-sm text-stone-400">
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" /> Conectado
      </div>
    );
  }
  const seconds = Math.floor((performance.now() - since) / 1000);
  return (
    <div className="mt-1 flex flex-col gap-1 text-sm text-stone-400">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
        {seconds < 2 ? 'Conectando…' : `Despertando el servidor… ${seconds} s`}
      </div>
      {seconds >= 2 && <p className="text-xs text-stone-500">El servidor gratuito se duerme si nadie juega; tarda hasta ~50 s en arrancar.</p>}
    </div>
  );
}

export default function Home({ connected, notice, onEnter }) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(codeFromUrl);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [intro, setIntro] = useState(shouldShowIntro);
  const [credits, setCredits] = useState(false);
  // Portada (6.5): menú con Jugar, Skins, Opciones y Créditos; Jugar abre el formulario de sala
  const [view, setView] = useState(() => (codeFromUrl() ? 'play' : 'menu'));
  const [skin, setSkin] = useState(loadSkin);
  const endIntro = useCallback(() => setIntro(false), []);

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
    <main
      className="flex min-h-full items-center justify-center overflow-y-auto bg-olive-950 p-4 text-stone-100"
      style={{ background: 'radial-gradient(ellipse at 70% 40%, #4b5a2a 0%, #1f2614 55%, #0c0f08 100%)' }}
    >
      <div className="flex w-full max-w-3xl flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center sm:items-start sm:text-left">
          <Logo className="h-[clamp(4rem,14vmin,6rem)] w-[clamp(4rem,14vmin,6rem)]" />
          <h1 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">
            Cálculo <span className="text-khaki">Royale</span>
          </h1>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-stone-400">Battle royale militar · Cálculo Multivariable</p>
          <WakeUp connected={connected} />
          {view === 'menu' ? (
            <div className="mt-2 flex w-full flex-col gap-2">
              <button type="button" onClick={() => setView('play')} className="w-full rounded-xl py-3 text-lg font-black uppercase tracking-wider transition bg-khaki text-olive-950 hover:brightness-110">
                Jugar
              </button>
              <button type="button" onClick={() => setView('skins')} className="w-full rounded-xl py-3 text-lg font-black uppercase tracking-wider transition bg-stone-800/80 text-stone-100 hover:bg-stone-700">
                Skins
              </button>
              <button type="button" onClick={() => setView('options')} className="w-full rounded-xl py-3 text-lg font-black uppercase tracking-wider transition bg-stone-800/80 text-stone-100 hover:bg-stone-700">
                Opciones
              </button>
              <button type="button" onClick={() => setCredits(true)} className="w-full rounded-xl py-3 text-lg font-black uppercase tracking-wider transition bg-stone-800/80 text-stone-100 hover:bg-stone-700">
                Créditos
              </button>
            </div>
          ) : (
            view === 'play' && (
              <button type="button" onClick={() => setView('menu')} className="text-xs text-stone-400 underline">
                ← Volver al menú
              </button>
            )
          )}
        </div>
        {view === 'play' ? (
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
              Crear sala
            </button>
            {(error || notice) && <p className="text-center text-sm text-red-400">{error || notice}</p>}
          </form>
        ) : (
          <SkinPortrait skin={getSkinEntry(skin)} className="hidden aspect-[3/4] w-56 rounded-2xl drop-shadow-2xl sm:block" />
        )}
      </div>
      {view === 'skins' && (
        <SkinPicker
          onChoose={setSkin}
          onClose={() => setView('menu')}
        />
      )}
      {view === 'options' && <Options onClose={() => setView('menu')} />}
      {credits && <Credits onClose={() => setCredits(false)} />}
      {intro && <Intro onDone={endIntro} />}
    </main>
  );
}
