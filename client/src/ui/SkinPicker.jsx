import { useEffect, useState } from 'react';
import { ACHIEVEMENTS, SKIN_RARITIES } from '@calculo-royale/shared/skins';
import { getSkinEntry, listSkins, rarityColor, skinInitials } from '../game/character/skins/index.js';
import { loadProgress, loadSkin, saveSkin, unlockedSkins } from '../achievements.js';
import { cachedPortrait, proceduralPortrait } from './portraits.js';

// Retrato 2D de una skin: el PNG de client/public/assets/skins/portraits/<id>.png, o si no hay
// (o falla al cargar) una tarjeta con el color de la rareza y las iniciales. Nunca carga un GLB.
// Las procedurales usan su retrato generado (portraits.js, una vez y en caché).
export function SkinPortrait({ skin, className = '' }) {
  const [broken, setBroken] = useState(false);
  const procedural = skin.type !== 'external' && !skin.portrait;
  const [generated, setGenerated] = useState(() => (procedural ? cachedPortrait(skin.id) : null));
  useEffect(() => {
    if (!procedural) return undefined;
    let alive = true;
    setGenerated(cachedPortrait(skin.id));
    proceduralPortrait(skin.id).then((url) => alive && setGenerated(url));
    return () => {
      alive = false;
    };
  }, [skin.id, procedural]);
  const color = rarityColor(skin.rarity);
  const src = skin.portrait ?? generated;
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={skin.name}
        loading="lazy"
        draggable={false}
        onError={() => setBroken(true)}
        className={`object-cover ${className}`}
        style={{ background: `linear-gradient(160deg, ${color}55, #0c0f08)` }}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center font-black tracking-wider text-white/90 ${className}`}
      style={{ background: `linear-gradient(160deg, ${color}, ${color}33 70%, #0c0f08)`, fontSize: 'clamp(1.1rem, 4vw, 2rem)' }}
      aria-label={skin.name}
    >
      {skinInitials(skin.name)}
    </div>
  );
}

const SKINS = listSkins();
const GAME_COLLECTIONS = [...new Set(SKINS.filter((s) => s.type !== 'external').map((s) => s.collection))];
const SPECIAL = SKINS.filter((s) => s.type === 'external');

function SkinCard({ skin, selected, current, locked, onSelect }) {
  return (
    <button
      onClick={() => onSelect(skin.id)}
      className={`relative overflow-hidden rounded-md border-2 text-left transition ${
        selected ? 'border-khaki shadow-[0_0_0_2px_rgba(0,0,0,0.6)]' : 'border-white/10 hover:border-white/30'
      }`}
      style={{ borderBottomColor: rarityColor(skin.rarity) }}
    >
      <SkinPortrait skin={skin} className={`aspect-[3/4] w-full ${locked ? 'opacity-40 grayscale' : ''}`} />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1 pt-4 text-[clamp(10px,2.6vw,13px)] font-bold leading-tight">
        {skin.name}
      </span>
      {locked && <span className="absolute right-1 top-1 text-sm">🔒</span>}
      {current && <span className="absolute left-1 top-1 rounded bg-khaki px-1 text-[9px] font-bold uppercase text-olive-950">en uso</span>}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-3">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-khaki-light">{title}</p>
      {children}
    </div>
  );
}

const GRID = 'grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(clamp(72px,18vw,112px),1fr))]';

// Selector del lobby: retratos 2D, "Skins del juego" (por colección) y "Personajes especiales";
// las de honor con candado y su logro. La elección se guarda en el navegador y solo viaja el skinId.
export default function SkinPicker({ onChoose, onClose }) {
  const progress = loadProgress();
  const unlocked = new Set(unlockedSkins(progress));
  const [current] = useState(loadSkin);
  const [selected, setSelected] = useState(current);
  const skin = getSkinEntry(selected);
  const rarity = SKIN_RARITIES[skin.rarity];
  const isLocked = (s) => s.rarity === 'honor' && !unlocked.has(s.id);
  const locked = isLocked(skin);
  const achievement = skin.achievement && ACHIEVEMENTS[skin.achievement];
  const card = (s) => <SkinCard key={s.id} skin={s} selected={selected === s.id} current={current === s.id} locked={isLocked(s)} onSelect={setSelected} />;

  return (
    <div
      className="absolute inset-0 z-50 flex bg-black/80 text-stone-100"
      style={{ padding: 'max(0.5rem, env(safe-area-inset-top)) max(0.5rem, env(safe-area-inset-right)) max(0.5rem, env(safe-area-inset-bottom)) max(0.5rem, env(safe-area-inset-left))' }}
    >
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-2 overflow-hidden rounded-lg border border-khaki-dark bg-olive-950/95 p-2 sm:flex-row sm:gap-3 sm:p-3 landscape:flex-row">
        <div className="flex shrink-0 gap-2 sm:w-[34%] sm:flex-col landscape:w-[30%] landscape:flex-col">
          <SkinPortrait skin={skin} className="aspect-[3/4] w-24 shrink-0 rounded-md sm:w-full landscape:min-h-0 landscape:w-full landscape:flex-1" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 landscape:flex-none">
            <div>
              <p className="truncate text-[clamp(14px,3.5vw,20px)] font-black uppercase tracking-wide">{skin.name}</p>
              <p className="text-xs text-stone-400">
                {skin.collection} · <b style={{ color: rarity.color }}>{rarity.name}</b>
              </p>
              {achievement && (
                <p className={`mt-1 text-xs ${locked ? 'text-orange-300' : 'text-green-300'}`}>
                  {locked ? '🔒 ' : '✓ '}
                  {achievement.name}: {achievement.description} ({Math.min(progress[skin.achievement], achievement.goal)}/{achievement.goal})
                </p>
              )}
            </div>
            <div className="mt-auto flex gap-2">
              <button
                disabled={locked}
                onClick={() => {
                  saveSkin(skin.id);
                  onChoose(skin.id);
                  onClose();
                }}
                className="flex-1 rounded bg-khaki py-2 text-sm font-bold text-olive-950 disabled:opacity-40"
              >
                {selected === current ? 'Usando esta' : 'Usar esta skin'}
              </button>
              <button onClick={onClose} className="rounded bg-black/40 px-3 py-2 text-sm">
                Cerrar
              </button>
            </div>
          </div>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1">
          {SPECIAL.length > 0 && (
            <Section title="Personajes especiales">
              <div className={GRID}>{SPECIAL.map(card)}</div>
            </Section>
          )}
          <Section title="Skins del juego">
            {GAME_COLLECTIONS.map((collection) => (
              <div key={collection} className="mb-2">
                <p className="mb-1 text-[11px] font-semibold text-stone-400">{collection}</p>
                <div className={GRID}>{SKINS.filter((s) => s.collection === collection && s.type !== 'external').map(card)}</div>
              </div>
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}
