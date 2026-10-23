import { useState } from 'react';
import { BRIGHTNESS_RANGE, setSetting, settings } from '../settings.js';

// Menú Opciones: ajustes del jugador guardados en este navegador
export default function Options({ onClose }) {
  const [brightness, setBrightness] = useState(settings.brightness);
  const [volume, setVolume] = useState(settings.volume);
  const change = (value) => {
    setBrightness(value);
    setSetting('brightness', value);
  };
  const changeVolume = (value) => {
    setVolume(value);
    setSetting('volume', value);
  };
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-3" onPointerUp={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-lg border border-khaki-dark bg-olive-900 p-4 text-stone-100">
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
        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span className="flex justify-between">
            Volumen <span className="font-mono text-khaki-light">{Math.round(volume * 100)} %</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => changeVolume(Number(e.target.value))}
            className="h-8 w-full accent-khaki"
          />
        </label>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              change(1);
              changeVolume(0.7);
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
