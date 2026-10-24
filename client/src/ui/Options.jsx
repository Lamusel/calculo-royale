import { useState } from 'react';
import { BRIGHTNESS_RANGE, QUALITY_OPTIONS, safePadding, setSetting, settings, UI_SCALE_OPTIONS } from '../settings.js';

// Botones de una opción con pocos valores (Calidad, Escala)
function Choice({ label, options, value, onChange }) {
  return (
    <div className="mt-3 flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([key, name]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`rounded py-1.5 text-xs font-semibold ${value === key ? 'bg-khaki text-olive-950' : 'bg-black/40 text-stone-200'}`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

// Deslizador de volumen (0 a 100 %) atado a un ajuste guardado
function Volume({ label, setting, values, onChange, disabled }) {
  return (
    <label className={`mt-2 flex flex-col text-sm ${disabled ? 'opacity-40' : ''}`}>
      <span className="flex justify-between">
        {label} <span className="font-mono text-khaki-light">{Math.round(values[setting] * 100)} %</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={values[setting]}
        disabled={disabled}
        onChange={(e) => onChange(setting, Number(e.target.value))}
        className="h-6 w-full accent-khaki"
      />
    </label>
  );
}

const AUDIO_DEFAULTS = { volume: 0.7, musicVolume: 0.5, sfxVolume: 1, voiceVolume: 0.9, muted: false };

// Menú Opciones: ajustes del jugador guardados en este navegador
export default function Options({ onClose }) {
  const [brightness, setBrightness] = useState(settings.brightness);
  const [audio, setAudio] = useState(() => Object.fromEntries(Object.keys(AUDIO_DEFAULTS).map((k) => [k, settings[k]])));
  const [quality, setQuality] = useState(settings.quality);
  const [uiScale, setUiScale] = useState(settings.uiScale);
  const change = (value) => {
    setBrightness(value);
    setSetting('brightness', value);
  };
  const changeAudio = (key, value) => {
    setAudio((a) => ({ ...a, [key]: value }));
    setSetting(key, value);
  };
  const changeQuality = (value) => {
    setQuality(value);
    setSetting('quality', value);
  };
  const changeScale = (value) => {
    setUiScale(value);
    setSetting('uiScale', value);
  };
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/55"
      style={safePadding('0.75rem')}
      onPointerUp={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-lg border border-khaki-dark bg-olive-900 p-4 text-stone-100">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-khaki-light">Opciones</p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex justify-between">
            Brillo <span className="font-mono text-khaki-light">{Math.round(brightness * 100)} %</span>
          </span>
          <input
            type="range"
            min={BRIGHTNESS_RANGE[0]}
            max={BRIGHTNESS_RANGE[1]}
            step={0.05}
            value={brightness}
            onChange={(e) => change(Number(e.target.value))}
            className="h-8 w-full accent-khaki"
          />
        </label>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span>Sonido</span>
          <button
            onClick={() => changeAudio('muted', !audio.muted)}
            className={`rounded px-2 py-1 text-xs font-semibold ${audio.muted ? 'bg-red-800 text-red-100' : 'bg-black/40 text-stone-200'}`}
          >
            {audio.muted ? '🔇 Silenciado' : '🔊 Silenciar todo'}
          </button>
        </div>
        <Volume label="Volumen general" setting="volume" values={audio} onChange={changeAudio} disabled={audio.muted} />
        <Volume label="Música" setting="musicVolume" values={audio} onChange={changeAudio} disabled={audio.muted} />
        <Volume label="Efectos" setting="sfxVolume" values={audio} onChange={changeAudio} disabled={audio.muted} />
        <Volume label="Voz del Mando" setting="voiceVolume" values={audio} onChange={changeAudio} disabled={audio.muted} />
        <Choice label="Calidad" options={QUALITY_OPTIONS} value={quality} onChange={changeQuality} />
        <p className="mt-1 text-[0.7rem] text-stone-400">
          {quality === 'auto' ? 'Auto baja la resolución, las sombras y los detalles solo si el juego va lento.' : 'Fija: no cambia aunque el juego vaya lento.'}
        </p>
        <Choice label="Escala de la interfaz" options={UI_SCALE_OPTIONS} value={uiScale} onChange={changeScale} />
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              change(1);
              for (const [k, v] of Object.entries(AUDIO_DEFAULTS)) changeAudio(k, v);
              changeQuality('auto');
              changeScale('normal');
            }}
            className="rounded bg-black/40 px-3 py-2 text-sm"
          >
            Restablecer
          </button>
          <button onClick={onClose} className="flex-1 rounded bg-khaki py-2 font-bold text-olive-950">
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
