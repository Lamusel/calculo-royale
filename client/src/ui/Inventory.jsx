import { useEffect, useState } from 'react';
import {
  AMMO_TYPES, BACKPACK, HEALING, LOOT, LOOT_ITEMS, THROWABLE_IDS, THROWABLES, TIER_COLORS, WEAPON_CATEGORIES, WEAPONS,
} from '@calculo-royale/shared/constants';
import { GEAR_INFO } from '@calculo-royale/shared/gear';
import { attachmentFits, magazineOf, weaponBars } from '@calculo-royale/shared/inventory';
import { TouchButton } from './CombatHUD.jsx';
import Icon from './Icons.jsx';

// Inventario de battle royale (fase 29): pantalla completa (Tab o I; botón de mochila en el celular),
// elegir el premio de una caja, qué arma reemplazar y la lista de una caja de botín. Todo se pide al
// servidor (client.inventory / takeLoot / chooseOffer): aquí solo se muestra.

const SLOT_NAMES = ['Principal 1', 'Principal 2', 'Secundaria'];
const ATT_NAMES = { scope: 'Mira', mag: 'Cargador', stock: 'Culata', muzzle: 'Boca' };
const BARS = [['damage', 'Daño'], ['rate', 'Cadencia'], ['range', 'Alcance'], ['control', 'Control']];
const tierOf = (item) => LOOT_ITEMS[item]?.tier ?? 0;
const nameOf = (item) => LOOT_ITEMS[item]?.name ?? WEAPONS[item]?.name ?? item;

function useTick(ms = 250) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

// Barras para comparar armas: daño, cadencia, alcance y control
export function WeaponBars({ id, compact = false }) {
  const bars = weaponBars(id);
  return (
    <div className={`grid grid-cols-2 gap-x-2 ${compact ? 'gap-y-0.5' : 'gap-y-1'}`}>
      {BARS.map(([key, label]) => (
        <div key={key} className="flex items-center gap-1 text-[0.6rem] text-stone-300">
          <span className="w-12 shrink-0">{label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded bg-black/60">
            <div className="h-full bg-khaki" style={{ width: `${bars[key] * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Tarjeta pequeña al recoger o elegir un arma: nombre, categoría y barras
export function WeaponCard({ id }) {
  const w = WEAPONS[id];
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-black/85 px-3 py-2 text-stone-100 shadow-lg" style={{ borderColor: TIER_COLORS[w.rarity] }}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold" style={{ color: TIER_COLORS[w.rarity] }}>
          {w.name}
        </p>
        <p className="mb-1 text-[0.65rem] text-stone-400">
          {WEAPON_CATEGORIES[w.category].name} · {w.ammo ? AMMO_TYPES[w.ammo].name : 'sin munición'}
        </p>
        <WeaponBars id={id} compact />
      </div>
    </div>
  );
}

const Btn = ({ onPress, children, tone = 'bg-white/10', disabled = false }) => (
  <TouchButton onPress={() => !disabled && onPress()} className={`min-h-[2.4rem] rounded px-2.5 text-xs font-bold ${disabled ? 'bg-white/5 text-stone-500' : tone}`}>
    {children}
  </TouchButton>
);

function WeaponSlot({ client, self, slot }) {
  const w = self.weapons?.[slot];
  const active = self.active === slot;
  if (!w) {
    return (
      <div className="flex min-h-[7rem] flex-col justify-center rounded-lg border border-dashed border-white/15 p-2 text-center text-xs text-stone-500">
        {SLOT_NAMES[slot]}
        <br />
        vacía
      </div>
    );
  }
  const def = WEAPONS[w.id];
  return (
    <div className={`flex flex-col gap-1.5 rounded-lg border p-2 ${active ? 'bg-white/10' : 'bg-black/40'}`} style={{ borderColor: TIER_COLORS[def.rarity] }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold" style={{ color: TIER_COLORS[def.rarity] }}>
          {def.name}
        </span>
        <span className="font-mono text-[0.65rem] text-stone-300">
          {w.mag}/{magazineOf(w.id, w.att)} · {def.ammo ? `${self.ammo?.[def.ammo] ?? 0} ${AMMO_TYPES[def.ammo].name}` : '—'}
        </span>
      </div>
      <span className="text-[0.6rem] text-stone-400">
        {SLOT_NAMES[slot]} · {WEAPON_CATEGORIES[def.category].name}
      </span>
      <WeaponBars id={w.id} />
      <div className="flex flex-wrap gap-1">
        {WEAPON_CATEGORIES[def.category].slots.map((s) => (
          <span key={s} className="flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 text-[0.6rem]">
            {ATT_NAMES[s]}: {w.att[s] ? nameOf(w.att[s]) : '—'}
            {w.att[s] && (
              <TouchButton onPress={() => client.inventory({ op: 'detach', slot, att: s })} className="rounded bg-white/10 px-1">
                Quitar
              </TouchButton>
            )}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        {!active && <Btn onPress={() => client.switchWeaponSlot(slot + 1)}>Equipar</Btn>}
        {w.id !== 'fists' && (
          <Btn onPress={() => client.inventory({ op: 'drop', what: { kind: 'weapon', slot } })} tone="bg-red-900/70">
            Soltar
          </Btn>
        )}
      </div>
    </div>
  );
}

// Pantalla de inventario: armas, accesorios sueltos, munición, curaciones, lanzables y equipo
export function InventoryScreen({ client, self, onClose }) {
  useTick();
  const bag = BACKPACK[self.backpackLevel ?? 0];
  const row = (label, count, cap, actions) => (
    <div className="flex items-center gap-2 rounded bg-black/35 px-2 py-1 text-xs">
      <span className="flex-1">{label}</span>
      <span className="font-mono text-stone-300">
        {count}/{cap}
      </span>
      {actions}
    </div>
  );
  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-2 text-stone-100 sm:p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex w-full max-w-4xl flex-col gap-3 rounded-lg border border-khaki-dark/60 bg-olive-950/95 p-3">
        <div className="flex items-center gap-2">
          <Icon name="backpack" />
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-khaki-light">Inventario · mochila {self.backpackLevel || 'sin'}</span>
          <TouchButton onPress={onClose} className="ml-auto flex h-9 w-9 items-center justify-center rounded bg-white/10">
            <Icon name="close" />
          </TouchButton>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {[0, 1, 2].map((slot) => (
            <WeaponSlot key={slot} client={client} self={self} slot={slot} />
          ))}
        </div>
        {self.loose?.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[0.65rem] uppercase tracking-widest text-stone-400">Accesorios sueltos ({self.loose.length}/{bag.loose})</p>
            {self.loose.map((a, i) => (
              <div key={`${a}-${i}`} className="flex flex-wrap items-center gap-1 rounded bg-black/35 px-2 py-1 text-xs">
                <span className="flex-1">{nameOf(a)}</span>
                {[0, 1, 2].map((slot) =>
                  self.weapons[slot] && attachmentFits(self.weapons[slot].id, a) ? (
                    <Btn key={slot} onPress={() => client.inventory({ op: 'attach', index: i, slot })}>
                      Poner en {WEAPONS[self.weapons[slot].id].name}
                    </Btn>
                  ) : null,
                )}
                <Btn onPress={() => client.inventory({ op: 'drop', what: { kind: 'loose', index: i } })} tone="bg-red-900/70">
                  Soltar
                </Btn>
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <p className="text-[0.65rem] uppercase tracking-widest text-stone-400">Munición</p>
            {Object.entries(AMMO_TYPES).map(([type, a]) =>
              (self.ammo?.[type] ?? 0) > 0 ? (
                <div key={type}>
                  {row(a.name, self.ammo[type], bag.ammo[type], (
                    <>
                      <Btn onPress={() => client.inventory({ op: 'drop', what: { kind: 'ammo', type, n: Math.min(10, self.ammo[type]) } })}>Soltar 10</Btn>
                      <Btn onPress={() => client.inventory({ op: 'drop', what: { kind: 'ammo', type, n: self.ammo[type] } })} tone="bg-red-900/70">
                        Todo
                      </Btn>
                    </>
                  ))}
                </div>
              ) : null,
            )}
            {Object.values(self.ammo ?? {}).every((n) => !n) && <p className="text-xs text-stone-500">Sin munición: búscala en el suelo o con "Obtener balas".</p>}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[0.65rem] uppercase tracking-widest text-stone-400">Curaciones</p>
            {Object.keys(HEALING).filter((k) => k !== 'moveFactor').map((item) => (
              <div key={item}>
                {row(nameOf(item), self.heals?.[item] ?? 0, bag[item], (
                  <>
                    <Btn disabled={!self.heals?.[item]} onPress={() => client.useItem(item)}>Usar</Btn>
                    <Btn disabled={!self.heals?.[item]} onPress={() => client.inventory({ op: 'drop', what: { kind: 'heal', item, n: 1 } })} tone="bg-red-900/70">
                      Soltar
                    </Btn>
                  </>
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[0.65rem] uppercase tracking-widest text-stone-400">Lanzables</p>
            {THROWABLE_IDS.filter((id) => self.throwables?.[id] > 0).map((id) => (
              <div key={id}>
                {row(THROWABLES[id].name, self.throwables[id], THROWABLES[id].max, (
                  <>
                    <Btn disabled={self.throwSel === id} onPress={() => client.selectThrowable(id)}>{self.throwSel === id ? 'Elegido' : 'Elegir'}</Btn>
                    <Btn onPress={() => client.inventory({ op: 'drop', what: { kind: 'throwable', item: id, n: 1 } })} tone="bg-red-900/70">
                      Soltar
                    </Btn>
                  </>
                ))}
              </div>
            ))}
            {!THROWABLE_IDS.some((id) => self.throwables?.[id] > 0) && <p className="text-xs text-stone-500">Ninguno todavía (salen de las cajas).</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[['armor', 'Chaleco', self.armorLevel], ['helmet', 'Casco', self.helmetLevel], ['backpack', 'Mochila', self.backpackLevel]].map(([item, label, level]) => (
            <div key={item} className="flex items-center gap-2 rounded bg-black/35 px-2 py-1 text-xs">
              <span>
                {label} {level || '—'}
              </span>
              {level > 0 && (
                <Btn onPress={() => client.inventory({ op: 'drop', what: { kind: 'gear', item } })} tone="bg-red-900/70">
                  Soltar
                </Btn>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Elegir el premio de una caja (2 o 3 opciones). Lo que no elige queda junto a la caja, solo para él un rato.
export function OfferChooser({ client }) {
  useTick();
  const offer = client.offer;
  if (!offer) return null;
  return (
    <div className="absolute left-1/2 top-[18%] z-40 w-[min(96vw,40rem)] -translate-x-1/2 rounded-lg border border-khaki/70 bg-black/90 p-3 text-stone-100 shadow-2xl">
      <p className="mb-2 text-center font-mono text-xs uppercase tracking-[0.25em] text-khaki-light">¡Correcto! Elige tu premio</p>
      <div className={`grid gap-2 ${offer.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {offer.options.map((bundle, i) => {
          const best = Math.max(...bundle.map(tierOf));
          return (
            <TouchButton key={i} onPress={() => client.chooseOffer(i)} className="flex min-h-[6rem] flex-col items-stretch gap-1 rounded-lg border-2 bg-white/5 p-2 text-left" style={{ borderColor: TIER_COLORS[best] }}>
              {bundle.map((item) => (
                <span key={item} className="text-xs leading-tight" style={{ color: TIER_COLORS[tierOf(item)] }}>
                  {GEAR_INFO[item]?.icon ?? ''} {nameOf(item)}
                </span>
              ))}
              {WEAPONS[bundle[0]] && <WeaponBars id={bundle[0]} compact />}
            </TouchButton>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[0.65rem] text-stone-400">Lo que no elijas queda junto a la caja: solo tú lo puedes tomar por {LOOT.privateMs / 1000} s.</p>
    </div>
  );
}

// Arma sin lugar: ¿cuál reemplazar? (la otra queda en el suelo)
export function ReplacePrompt({ client, self }) {
  useTick();
  const prompt = client.replacePrompt;
  if (!prompt || performance.now() - prompt.at > 10_000) return null;
  return (
    <div className="absolute left-1/2 top-[22%] z-40 w-[min(92vw,26rem)] -translate-x-1/2 rounded-lg border border-white/20 bg-black/90 p-3 text-stone-100 shadow-2xl">
      <p className="mb-2 text-sm">
        No hay lugar para <b>{nameOf(prompt.item)}</b>. ¿Cuál reemplazas? (queda en el suelo)
      </p>
      <div className="flex flex-col gap-1.5">
        {prompt.need.map((slot) => (
          <Btn key={slot} onPress={() => client.takeLoot(prompt.lootId, { index: prompt.index, replace: slot })}>
            {SLOT_NAMES[slot]}: {self.weapons?.[slot] ? WEAPONS[self.weapons[slot].id].name : 'vacía'}
          </Btn>
        ))}
        <Btn onPress={() => (client.replacePrompt = null)} tone="bg-white/5">
          Dejarla
        </Btn>
      </div>
    </div>
  );
}

// Caja de botín: lista completa, se toma objeto por objeto o "Tomar todo lo que quepa"
export function BoxPanel({ client, me }) {
  useTick();
  let entry = client.openBox ? client.loot.get(client.openBox) : null;
  // Al tomar algo la caja vuelve con otro id en el mismo lugar: se sigue mostrando
  if (!entry && client.openBox && client.openBoxAt) {
    entry = [...client.loot.values()].find((e) => e.contents && Math.hypot(e.x - client.openBoxAt.x, e.y - client.openBoxAt.y) < 0.05) ?? null;
    if (entry) client.openBox = entry.id;
  }
  const near = entry && me && Math.hypot(entry.x - me.x, entry.y - me.y) <= LOOT.pickupRadius + 0.6;
  // Si la caja cambió (otro id, con lo que quedó) o se alejó, se cierra
  if (!entry || !near) {
    if (client.openBox && !near) client.openBox = null;
    return null;
  }
  return (
    <div className="absolute right-2 top-16 z-40 flex max-h-[70%] w-[min(90vw,20rem)] flex-col gap-1 overflow-y-auto rounded-lg border bg-black/90 p-2 text-stone-100 shadow-2xl" style={{ borderColor: TIER_COLORS[entry.tier ?? 0] }}>
      <div className="flex items-center gap-2">
        <Icon name="loot" />
        <span className="text-xs font-bold uppercase tracking-widest">Caja de botín</span>
        <TouchButton onPress={() => (client.openBox = null)} className="ml-auto flex h-8 w-8 items-center justify-center rounded bg-white/10">
          <Icon name="close" className="h-4 w-4" />
        </TouchButton>
      </div>
      <Btn onPress={() => client.takeLoot(entry.id, { all: true })} tone="bg-khaki text-olive-950">
        Tomar todo lo que quepa
      </Btn>
      {(entry.contents ?? []).map((c, i) => (
        <div key={`${c.item}-${i}`} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1 text-xs">
          <span className="flex-1" style={{ color: TIER_COLORS[tierOf(c.item)] }}>
            {nameOf(c.item)}
            {c.n > 1 ? ` × ${c.n}` : ''}
          </span>
          <Btn onPress={() => client.takeLoot(entry.id, { index: i })}>Tomar</Btn>
        </div>
      ))}
    </div>
  );
}
