import { hasMusic } from '../audio/sound.js';
import { useEffect, useState } from 'react';
import {
  AMMO_TYPES, ARMOR_ABSORB, BACKPACK, GRENADE, MAX_HP, vehicleType, RESPAWN_MS, THROWABLE_IDS, THROWABLES, TIER_COLORS, WEAPON_IDS, WEAPONS,
} from '@calculo-royale/shared/constants';
import { BUTTONS } from '@calculo-royale/shared/protocol';
import { GEAR_INFO } from '@calculo-royale/shared/gear';
import { magazineOf } from '@calculo-royale/shared/inventory';
import { actions, inputState, press, toggleGrenadeMode } from '../input/inputState.js';
import WeaponIcon from './WeaponIcon.jsx';
import Icon from './Icons.jsx';
import { BoxPanel, InventoryScreen, OfferChooser, ReplacePrompt, WeaponCard } from './Inventory.jsx';
import { QuestionCard } from './Operator.jsx';

// Interfaz de combate (fases 29 y 32). En el celular solo hay pocos botones fijos (joysticks, Recargar,
// Obtener balas, mochila, lanzables y curación) y una única zona de acción contextual (Tomar, Abrir,
// Subir, Saquear…) que aparece cuando sirve. Lanzables y curación son un solo botón que despliega sus
// opciones. En vehículo, cayendo o en tirolina se ocultan los botones que no sirven.

const HEAL_IDS = ['bandage', 'medkit', 'drink'];
const HEAL_NAMES = { bandage: 'Venda', medkit: 'Botiquín', drink: 'Bebida' };
const HEAL_LABEL = { bandage: 'Vendándote', medkit: 'Usando botiquín', drink: 'Bebiendo' };
const SLOT_KEYS = ['1', '2', '3'];

// Vida del jeep y asiento (mientras vas en uno)
function JeepBar({ vehicle, client }) {
  const hp = Math.max(0, (vehicle.hp ?? 0) / vehicleType(vehicle).hp);
  const [, refresh] = useState(0);
  return (
    <div className="flex w-56 items-center gap-2 sm:w-72">
      <span className="w-10 text-right font-mono text-[10px] text-orange-300">{vehicleType(vehicle).name}</span>
      <div className="h-2 flex-1 overflow-hidden rounded bg-black/60">
        <div className={`h-full transition-all ${hp > 0.35 ? 'bg-orange-400' : 'bg-red-500'}`} style={{ width: `${hp * 100}%` }} />
      </div>
      <span className="font-mono text-[10px] text-stone-300">{vehicle.seat === 'driver' ? 'Conduces' : 'Pasajero'}</span>
      {/* Radio del camión (7A): solo si hay música para ella; se apaga para uno mismo */}
      {vehicle.type === 'truck' && client && hasMusic('radio-camion') && (
        <TouchButton
          onPress={() => {
            client.truckRadioOff = !client.truckRadioOff;
            refresh((n) => n + 1);
          }}
          className="pointer-events-auto rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-stone-200"
          title="Radio del camión"
        >
          📻 {client.truckRadioOff ? 'Apagada' : 'Radio'}
        </TouchButton>
      )}
    </div>
  );
}

function HealthBar({ self }) {
  const hp = Math.max(0, self.hp / MAX_HP);
  const armor = self.armorLevel ? self.armor / ARMOR_ABSORB[3] : 0;
  return (
    <div className="flex w-56 flex-col gap-1 sm:w-72">
      {self.armorLevel > 0 && (
        <div className="flex items-center gap-2">
          <span className="w-10 text-right font-mono text-[10px] text-sky-300">Chaleco {self.armorLevel}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded bg-black/60">
            <div className="h-full bg-sky-400 transition-all" style={{ width: `${armor * 100}%` }} />
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="w-10 text-right font-mono text-xs font-bold text-white">{self.hp}</span>
        <div className="h-3 flex-1 overflow-hidden rounded bg-black/60">
          <div className={`h-full transition-all ${hp > 0.5 ? 'bg-green-500' : hp > 0.25 ? 'bg-yellow-400' : 'bg-red-500'}`} style={{ width: `${hp * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

// Botón que reacciona al tocar (pointerdown): en el celular un `click` no llega
// si hay otro dedo en la pantalla (por ejemplo, en el joystick de movimiento)
export function TouchButton({ onPress, className, style, title, children }) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPress();
      }}
      className={className}
      style={style}
      title={title}
    >
      {children}
    </button>
  );
}

// Botón redondo fijo del celular (o de la barra en PC): icono y una etiqueta corta en palabras
function RoundButton({ icon, label, onPress, active = false, alert = false, badge = null, disabled = false }) {
  return (
    <TouchButton
      onPress={() => !disabled && onPress()}
      title={label}
      className={`relative flex h-11 w-11 flex-col items-center justify-center rounded-full border text-[8px] font-bold uppercase leading-none ${
        alert ? 'animate-pulse border-red-300 bg-red-700/85 text-white' : active ? 'border-khaki bg-khaki/30 text-khaki-light' : disabled ? 'border-white/5 bg-black/35 text-stone-500' : 'border-white/15 bg-black/55 text-stone-100'
      }`}
    >
      <Icon name={icon} className="h-5 w-5" />
      <span className="mt-0.5 max-w-[3rem] truncate">{label}</span>
      {badge !== null && <span className="absolute -right-1 -top-1 rounded-full bg-stone-900 px-1 font-mono text-[9px] text-khaki-light">{badge}</span>}
    </TouchButton>
  );
}

// Armas: tres ranuras (1 y 2 principales, 3 secundaria). Tocar una la equipa.
function WeaponBar({ self, reloadProgress, isTouch }) {
  return (
    <div className="relative flex items-end gap-1.5">
      {[0, 1, 2].map((slot) => {
        const w = self.weapons?.[slot];
        const def = w && WEAPONS[w.id];
        const active = self.active === slot;
        return (
          <TouchButton
            key={slot}
            onPress={() => w && actions.switchWeapon(slot + 1)}
            className={`flex min-w-[5.2rem] flex-col items-center rounded border px-2 py-1 text-[11px] leading-tight ${
              active ? 'bg-stone-950/95 text-khaki-light' : 'bg-stone-900/90 text-stone-400'
            }`}
            style={{ borderColor: def ? (active ? TIER_COLORS[def.rarity] : 'rgba(255,255,255,0.1)') : 'rgba(255,255,255,0.05)' }}
          >
            {!isTouch && <span className="self-start font-mono text-[9px] opacity-60">{SLOT_KEYS[slot]}</span>}
            {w ? (
              <>
                <WeaponIcon weapon={w.id} className="h-4 w-12" />
                <span className="max-w-[5.5rem] truncate text-[10px]">{def.name}</span>
                <span className="font-mono">
                  {w.id === 'fists' ? '—' : `${w.mag}/${magazineOf(w.id, w.att)} · ${self.ammo?.[def.ammo] ?? 0}`}
                </span>
              </>
            ) : (
              <span className="py-2 text-stone-500">{slot === 2 ? 'secundaria' : 'vacía'}</span>
            )}
          </TouchButton>
        );
      })}
      {/* Ranura de arma blanca (7A): solo se muestra; se usa con V o con "Golpear" */}
      <div className="pointer-events-none flex flex-col items-center rounded border border-white/10 bg-stone-900/90 px-1.5 py-1 text-[10px] leading-tight text-stone-300">
        {!isTouch && <span className="self-start font-mono text-[9px] opacity-60">V</span>}
        <WeaponIcon weapon={self.melee ?? 'fists'} className="h-4 w-10" />
        <span className="max-w-[4.5rem] truncate" style={{ color: self.melee ? TIER_COLORS[WEAPONS[self.melee].rarity] : undefined }}>
          {WEAPONS[self.melee ?? 'fists'].name}
        </span>
      </div>
      {reloadProgress !== null && (
        <div className="absolute -top-5 left-1/2 w-40 -translate-x-1/2">
          <p className="text-center text-[10px] uppercase tracking-widest text-khaki-light">Recargando</p>
          <div className="h-1 overflow-hidden rounded bg-black/60">
            <div className="h-full bg-khaki" style={{ width: `${reloadProgress * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

// Despliegue en fila (lanzables o curaciones): iconos grandes con su cantidad, solo lo que tienes
function Fan({ items, onPick, onClose, selected = null }) {
  return (
    <div className="absolute right-full top-1/2 mr-2 flex -translate-y-1/2 gap-1.5 rounded-full bg-black/70 p-1.5">
      {items.map(({ id, icon, label, count }) => (
        <TouchButton
          key={id}
          onPress={() => onPick(id)}
          title={label}
          className={`relative flex h-11 w-11 flex-col items-center justify-center rounded-full border text-[8px] font-bold uppercase ${selected === id ? 'border-khaki bg-khaki/30 text-khaki-light' : 'border-white/15 bg-stone-900/90 text-stone-100'}`}
        >
          <Icon name={icon} className="h-5 w-5" />
          <span className="max-w-[3rem] truncate">{label}</span>
          <span className="absolute -right-1 -top-1 rounded-full bg-stone-900 px-1 font-mono text-[9px] text-khaki-light">{count}</span>
        </TouchButton>
      ))}
      <TouchButton onPress={onClose} className="flex h-12 w-8 items-center justify-center rounded-full text-stone-400">
        <Icon name="close" className="h-4 w-4" />
      </TouchButton>
    </div>
  );
}

const throwItems = (self) =>
  THROWABLE_IDS.filter((id) => self.throwables?.[id] > 0).map((id) => ({ id, icon: id, label: THROWABLES[id].name.split(' ')[0], count: self.throwables[id] }));
const healItems = (self) => HEAL_IDS.filter((id) => self.heals?.[id] > 0).map((id) => ({ id, icon: id, label: HEAL_NAMES[id], count: self.heals[id] }));

// Lanzables: un botón que despliega los que tienes. Elegir uno lo apunta con el joystick derecho
// (como la granada); el UAV no se apunta: se activa al tocarlo.
function ThrowableButton({ self, client, open, setOpen, isTouch }) {
  const items = throwItems(self);
  const sel = self.throwSel;
  const count = self.throwables?.[sel] ?? 0;
  const pick = (id) => {
    client.selectThrowable(id);
    setOpen(null);
    if (THROWABLES[id].instant) press(BUTTONS.GRENADE);
    else if (isTouch) toggleGrenadeMode(true);
    else inputState.grenadeAiming = true;
  };
  return (
    <div className="relative">
      {open && items.length > 0 && <Fan items={items} selected={sel} onPick={pick} onClose={() => setOpen(null)} />}
      <RoundButton
        icon={count > 0 ? sel : 'frag'}
        label={count > 0 ? THROWABLES[sel].name.split(' ')[0] : 'Lanzables'}
        badge={items.length ? count : null}
        active={inputState.grenadeMode || inputState.grenadeAiming}
        disabled={items.length === 0}
        onPress={() => (inputState.grenadeMode ? toggleGrenadeMode(false) : setOpen(open ? null : 'throw'))}
      />
    </div>
  );
}

function HealButton({ self, open, setOpen }) {
  const items = healItems(self);
  const total = items.reduce((t, i) => t + i.count, 0);
  return (
    <div className="relative">
      {open && items.length > 0 && (
        <Fan
          items={items}
          onPick={(id) => {
            actions.useItem(id);
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      )}
      <RoundButton icon="heal" label="Curar" badge={total || null} disabled={total === 0} onPress={() => setOpen(open ? null : 'heal')} />
    </div>
  );
}

// "Obtener balas": botón (celular) o B (PC); con espera tras fallar
function AmmoButton({ self, client, isTouch }) {
  const hand = self.weapons?.[self.active];
  const def = hand && WEAPONS[hand.id];
  const reserve = def?.ammo ? self.ammo?.[def.ammo] ?? 0 : 0;
  const cooldown = Math.ceil(Math.max(0, (client.ammoCooldownEndsAt ?? 0) - performance.now()) / 1000);
  const empty = (hand?.mag ?? 0) + reserve === 0 && hand?.id !== 'fists';
  const busy = Boolean(client.ammoQuestion);
  const label = busy ? 'Respondiendo' : cooldown > 0 ? `${cooldown} s` : 'Balas';
  if (isTouch) return <RoundButton icon="ammo" label={label} alert={empty && cooldown <= 0 && !busy} disabled={cooldown > 0 || busy} onPress={() => client.requestAmmo()} />;
  return (
    <p className={`rounded px-2 py-0.5 text-[11px] ${empty ? 'animate-pulse bg-red-700/85 text-white' : reserve === 0 ? 'bg-amber-700/80 text-amber-50' : 'bg-black/55 text-amber-200'}`}>
      {cooldown <= 0 && !busy && <kbd className="mr-1 rounded bg-amber-300 px-1 font-bold text-black">B</kbd>}
      {empty ? 'Sin balas · ' : ''}
      {busy ? 'Respondiendo…' : cooldown > 0 ? `Balas en ${cooldown} s` : `Obtener balas${def?.ammo ? ` (${AMMO_TYPES[def.ammo].name})` : ''}`}
    </p>
  );
}

// Zona de acción: una sola, siempre en el mismo lugar. La más cercana; con varias, una flechita cambia.
function ActionZone({ list, isTouch, inVehicle }) {
  const [index, setIndex] = useState(0);
  const key = list.map((a) => a.kind).join(',');
  useEffect(() => setIndex(0), [key]);
  const items = inVehicle ? [list[0], { kind: 'seat', icon: 'seat', label: 'Cambiar asiento', enabled: true, color: '#fb923c' }].filter(Boolean) : list;
  const current = items.length ? items[Math.min(index, items.length - 1)] : null;
  inputState.actionKind = current?.kind ?? null;
  useEffect(() => {
    actions.cycleAction = () => setIndex((i) => i + 1);
  }, []);
  if (!current) return null;
  const use = (a) => {
    if (!a.enabled) return;
    if (a.kind === 'melee') actions.meleeLocal();
    actions.interact(a.kind);
  };
  if (!isTouch) {
    return (
      <p className={`rounded border-l-4 bg-black/65 px-3 py-1.5 text-sm ${current.enabled ? 'text-khaki-light' : 'text-stone-400'}`} style={{ borderColor: current.color ?? 'transparent' }}>
        {current.enabled && <kbd className="mr-1 rounded bg-khaki px-1.5 font-bold text-olive-950">E</kbd>}
        {current.label}
        {items.length > 1 && <span className="ml-2 text-xs text-stone-400">(F: {items[(index + 1) % items.length].label})</span>}
      </p>
    );
  }
  // En vehículo: Bajar y Cambiar asiento lado a lado
  if (inVehicle) {
    return (
      <div className="flex gap-2">
        {items.map((a) => (
          <TouchButton key={a.kind} onPress={() => use(a)} className="flex items-center gap-1 rounded-full border-2 border-orange-300 bg-orange-500/85 px-4 py-2 text-sm font-bold text-white">
            <Icon name={a.icon} className="h-4 w-4" />
            {a.label}
          </TouchButton>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <TouchButton
        onPress={() => use(current)}
        className={`flex max-w-[16rem] items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-bold ${current.enabled ? 'bg-khaki text-olive-950' : 'bg-black/60 text-stone-400'}`}
        style={{ borderColor: current.color ?? 'transparent' }}
      >
        <Icon name={current.icon ?? 'take'} className="h-4 w-4 shrink-0" />
        <span className="truncate">{current.label}</span>
      </TouchButton>
      {items.length > 1 && (
        <TouchButton onPress={() => setIndex((i) => (i + 1) % items.length)} title="Siguiente" className="flex h-10 w-8 items-center justify-center rounded-full bg-black/60 text-stone-100">
          <Icon name="next" className="h-4 w-4" />
        </TouchButton>
      )}
    </div>
  );
}

// Equipo puesto (solo información): chaleco, casco y mochila
function GearChips({ self, drinkLeft }) {
  const chips = [
    ['Chaleco', self.armorLevel],
    ['Casco', self.helmetLevel ?? 0],
    ['Mochila', self.backpackLevel ?? 0],
  ];
  return (
    <div className="pointer-events-none flex flex-wrap gap-1">
      {chips.map(([name, level]) => (
        <span key={name} className={`rounded px-1.5 py-0.5 text-[0.65rem] ${level > 0 ? 'bg-black/65 text-sky-100' : 'bg-black/35 text-stone-500'}`}>
          {name} {level || '—'}
        </span>
      ))}
      {drinkLeft > 0 && <span className="rounded bg-emerald-800/80 px-1.5 py-0.5 text-[0.65rem] text-emerald-100">Bebida {drinkLeft} s</span>}
    </div>
  );
}

function DeathScreen({ self, phase, deathAt, roster, myId }) {
  const killer = roster.find((p) => p.id === self.killedBy);
  const weapon = WEAPON_IDS[self.killedWith];
  const weaponName = weapon === 'frag' ? GRENADE.name : WEAPONS[weapon]?.name ?? THROWABLES[weapon]?.name;
  const respawnIn = Math.max(0, Math.ceil((RESPAWN_MS - (performance.now() - deathAt)) / 1000));
  let cause = weaponName ?? '';
  if (weapon === 'zone') cause = 'La zona te alcanzó';
  else if (weapon === 'jeep') cause = killer && self.killedBy !== myId ? `Atropellado por ${killer.name}` : 'Un jeep te pasó por encima';
  else if (self.killedBy === myId) cause = 'por tu propio explosivo';
  else if (killer) cause = `por ${killer.name}${weaponName ? ` · ${weaponName}` : ''}`;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/40 text-center">
      <p className="text-4xl font-black uppercase tracking-[0.2em] text-red-500 drop-shadow">Eliminado</p>
      <p className="text-stone-200">{cause}</p>
      <p className="text-sm text-stone-400">{phase === 'lobby' ? `Reapareces en ${respawnIn}…` : 'Espera el final de la partida'}</p>
    </div>
  );
}

// Interfaz de combate: vida, armas, botones, zona de acción, inventario y pantalla de muerte
export default function CombatHUD({ view, phase, roster, myId, isTouch, client }) {
  const { self, me, reloadProgress, actions: nearby = [], damageFlashAt, deathAt, vehicle, healing, drinkLeft, toasts = [], gearCard } = view;
  const [fan, setFan] = useState(null); // 'throw' | 'heal' | null
  const [inventory, setInventory] = useState(false);
  // Tab o I abren el inventario; F cambia de acción (KeyboardMouse llama a estas)
  useEffect(() => {
    actions.toggleInventory = () => setInventory((v) => !v);
    return () => {
      actions.toggleInventory = () => {};
    };
  }, []);
  if (!self) return null;
  const air = Boolean(client?.deploying);
  const mode = !self.alive || air ? 'none' : vehicle ? (vehicle.seat === 'driver' ? 'driver' : 'passenger') : client?.onZipline ? 'zipline' : 'foot';

  return (
    <>
      {/* De dónde viene el daño: una marca roja en el borde, 1,2 s (la cámara siempre mira al norte) */}
      {client?.hurtFrom && me && performance.now() - client.hurtFrom.at < 1200 && Math.hypot(client.hurtFrom.x - me.x, client.hurtFrom.y - me.y) > 1 && (
        <div
          key={`hurt-${client.hurtFrom.at}`}
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-0 w-0 animate-[damage_1200ms_ease-out_forwards]"
          style={{ transform: `rotate(${-Math.atan2(client.hurtFrom.y - me.y, client.hurtFrom.x - me.x)}rad)` }}
        >
          <div className="absolute left-[min(42vw,42vh)] top-0 h-24 w-3 -translate-y-1/2 rounded-full bg-red-600/80 shadow-[0_0_16px_rgba(220,38,38,0.9)]" />
        </div>
      )}
      {damageFlashAt > 0 && (
        <div key={damageFlashAt} className="pointer-events-none absolute inset-0 z-20 animate-[damage_400ms_ease-out_forwards] shadow-[inset_0_0_80px_rgba(220,38,38,0.65)]" />
      )}
      {/* Derribado: un compañero lo puede levantar */}
      {self.alive && self.downedLeft > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-[30%] z-30 -translate-x-1/2 rounded-lg bg-red-950/85 px-4 py-2 text-center text-red-100">
          <p className="font-black uppercase tracking-widest">Derribado</p>
          <p className="text-xs">Arrástrate hacia un compañero: te puede reanimar</p>
          <div className="mx-auto mt-1 h-2 w-48 overflow-hidden rounded bg-black/60">
            <div className="h-full bg-red-500 transition-[width]" style={{ width: `${self.downedHp ?? 0}%` }} />
          </div>
        </div>
      )}
      {self.reviving && self.reviving.left > 0 && (
        <p className="pointer-events-none absolute left-1/2 top-[30%] z-30 -translate-x-1/2 rounded bg-green-950/85 px-3 py-1 text-sm text-green-100">Reanimando… {Math.ceil(self.reviving.left / 1000)} s (no te muevas)</p>
      )}
      {client?.transmission?.kind === 'revive' && (
        <div className="absolute left-1/2 top-[5.5rem] z-40 w-[min(92vw,28rem)] -translate-x-1/2 rounded-lg border border-green-400/70 bg-black/85 p-2 text-stone-100 shadow-xl">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-green-300">Reanimar: acierta para levantarlo</p>
          <QuestionCard item={client.transmission} compact onAnswer={(i) => client.answerTransmission(client.transmission.id, i)} />
        </div>
      )}
      {/* Aturdidora: pantalla blanca que se va apagando */}
      {self.flashLeft && <div className="pointer-events-none absolute inset-0 z-40 animate-[flash_2500ms_ease-out_forwards] bg-white" />}

      {self.alive && (
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5">
          {vehicle && <JeepBar vehicle={vehicle} client={client} />}
          <HealthBar self={self} />
          {healing && (
            <div className="w-40">
              <p className="text-center text-[10px] uppercase tracking-widest text-emerald-300">{HEAL_LABEL[healing.item]}</p>
              <div className="h-1 overflow-hidden rounded bg-black/60">
                <div className="h-full bg-emerald-400" style={{ width: `${Math.min(1, healing.progress) * 100}%` }} />
              </div>
            </div>
          )}
          {(mode === 'foot' || mode === 'passenger') && <WeaponBar self={self} reloadProgress={reloadProgress} isTouch={isTouch} />}
        </div>
      )}

      {self.alive && (
        <div className="absolute bottom-3 left-3 z-20 flex flex-col items-start gap-1">
          <GearChips self={self} drinkLeft={drinkLeft} />
          {!isTouch && <p className="pointer-events-none text-[0.6rem] text-stone-400">Tab inventario · G lanzar · 4–9 o rueda: lanzable · H venda · J botiquín · K bebida</p>}
        </div>
      )}

      {gearCard && (
        <div className="pointer-events-none absolute left-1/2 top-[30%] z-30 flex w-[min(90vw,22rem)] -translate-x-1/2 flex-col gap-1">
          {gearCard.items.map((id) =>
            WEAPONS[id] ? (
              <WeaponCard key={id} id={id} />
            ) : (
              <div key={id} className="flex items-center gap-2 rounded-lg border border-amber-400/60 bg-black/85 px-3 py-2 text-stone-100 shadow-lg">
                <span className="text-2xl leading-none">{GEAR_INFO[id].icon}</span>
                <span className="text-[0.8rem] leading-snug">
                  <b className="text-amber-200">{GEAR_INFO[id].short}</b>
                  <br />
                  {GEAR_INFO[id].effect}
                </span>
              </div>
            ),
          )}
        </div>
      )}

      {/* Avisos de botín: cola en la esquina inferior izquierda, uno debajo del otro, máximo 3 */}
      {toasts.length > 0 && (
        <div className="pointer-events-none absolute bottom-[4.5rem] left-3 z-20 flex flex-col items-start gap-1">
          {toasts.map((t) => (
            <p key={t.at} className="max-w-[14rem] truncate rounded bg-black/70 px-2 py-0.5 text-[11px] text-stone-100">
              {t.text}
            </p>
          ))}
        </div>
      )}

      {/* Zona de acción: una sola, sobre la barra de armas (no tapa los joysticks) */}
      {mode !== 'none' && (
        <div className="absolute bottom-[8.5rem] left-1/2 z-20 -translate-x-1/2">
          <ActionZone list={mode === 'zipline' ? [{ kind: 'zip', icon: 'drop', label: 'Soltarse', enabled: true, color: '#38bdf8', dist: 0 }] : nearby} isTouch={isTouch} inVehicle={Boolean(vehicle)} />
        </div>
      )}


      {!isTouch && self.alive && client && mode !== 'none' && (
        <div className="absolute bottom-3 right-3 z-20">
          <AmmoButton self={self} client={client} isTouch={false} />
        </div>
      )}

      {/* Celular: botones fijos en una columna al borde derecho; en vehículo solo lo que sirve */}
      {isTouch && client && (mode === 'foot' || mode === 'passenger' || mode === 'zipline') && (
        <div className="absolute bottom-[4.5rem] right-2 z-20 flex flex-col items-center gap-1.5">
          <RoundButton icon="reload" label="Recargar" onPress={() => press(BUTTONS.RELOAD)} />
          <AmmoButton self={self} client={client} isTouch />
          {mode === 'foot' && (
            <>
              <RoundButton icon="backpack" label="Mochila" onPress={() => setInventory(true)} />
              <ThrowableButton self={self} client={client} open={fan === 'throw'} setOpen={setFan} isTouch />
              <HealButton self={self} open={fan === 'heal'} setOpen={setFan} />
            </>
          )}
        </div>
      )}
      {!isTouch && self.alive && mode === 'foot' && client && (
        <div className="absolute bottom-16 right-3 z-20 flex gap-2">
          <ThrowableButton self={self} client={client} open={fan === 'throw'} setOpen={setFan} isTouch={false} />
          <HealButton self={self} open={fan === 'heal'} setOpen={setFan} />
          <RoundButton icon="backpack" label="Mochila" onPress={() => setInventory(true)} />
        </div>
      )}

      {client && self.alive && <OfferChooser client={client} />}
      {client && self.alive && <ReplacePrompt client={client} self={self} />}
      {client && self.alive && <BoxPanel client={client} me={me} />}
      {client && inventory && self.alive && <InventoryScreen client={client} self={self} onClose={() => setInventory(false)} />}

      {/* En partida, el caído pasa a espectador o al Gulag (otros paneles); aquí solo el lobby y los resultados */}
      {!self.alive && phase !== 'playing' && <DeathScreen self={self} phase={phase} deathAt={deathAt} roster={roster} myId={myId} />}
    </>
  );
}

// Para la prueba de capacidad (BACKPACK) desde la interfaz
export const bagOf = (self) => BACKPACK[self?.backpackLevel ?? 0];
