import { useState } from 'react';
import { ARMOR_ABSORB, BACKPACK, GRENADE, JEEP, MAX_HP, RESPAWN_MS, WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';
import { BUTTONS } from '@calculo-royale/shared/protocol';
import { actions, inputState, press, toggleGrenadeMode } from '../input/inputState.js';
import WeaponIcon from './WeaponIcon.jsx';
import { GEAR_INFO } from '@calculo-royale/shared/gear';
import { magazineOf } from '@calculo-royale/shared/inventory';

const ammoText = (mag, reserve) => `${mag} / ${reserve ?? 0}`;

// Vida del jeep y asiento (mientras vas en uno)
function JeepBar({ vehicle }) {
  const hp = Math.max(0, (vehicle.hp ?? 0) / JEEP.hp);
  return (
    <div className="flex w-56 items-center gap-2 sm:w-72">
      <span className="w-10 text-right font-mono text-[10px] text-orange-300">Jeep</span>
      <div className="h-2 flex-1 overflow-hidden rounded bg-black/60">
        <div className={`h-full transition-all ${hp > 0.35 ? 'bg-orange-400' : 'bg-red-500'}`} style={{ width: `${hp * 100}%` }} />
      </div>
      <span className="font-mono text-[10px] text-stone-300">{vehicle.seat === 'driver' ? 'Conduces' : 'Pasajero'}</span>
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
          <span className="w-10 text-right font-mono text-[10px] text-sky-300">Ch {self.armorLevel}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded bg-black/60">
            <div className="h-full bg-sky-400 transition-all" style={{ width: `${armor * 100}%` }} />
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="w-10 text-right font-mono text-xs font-bold text-white">{self.hp}</span>
        <div className="h-3 flex-1 overflow-hidden rounded bg-black/60">
          <div
            className={`h-full transition-all ${hp > 0.5 ? 'bg-green-500' : hp > 0.25 ? 'bg-yellow-400' : 'bg-red-500'}`}
            style={{ width: `${hp * 100}%` }}
          />
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

// Fondo casi sólido: los blancos de práctica y objetos del mundo no se ven a través de la barra
function Slot({ active, alert, label, children, onPress }) {
  const tone = alert
    ? 'border-red-400 bg-red-950/95 text-red-100'
    : active
      ? 'border-khaki bg-stone-950/95 text-khaki-light'
      : 'border-white/10 bg-stone-900/90 text-stone-400';
  return (
    <TouchButton
      onPress={onPress}
      className={`flex min-w-[5.5rem] flex-col items-center rounded border px-2 py-1 text-[11px] leading-tight ${tone}`}
    >
      <span className="self-start font-mono text-[9px] opacity-60">{label}</span>
      {children}
    </TouchButton>
  );
}

function WeaponBar({ self, reloadProgress, isTouch }) {
  const primary = self.primary;
  const [noGrenadesAt, setNoGrenadesAt] = useState(0);
  const noGrenades = performance.now() - noGrenadesAt < 1500;

  // Celular: entra o sale del modo granada. PC: G mantenida, o este botón y luego clic donde lanzar
  const onGrenade = () => {
    if (self.grenades === 0) setNoGrenadesAt(performance.now());
    else if (isTouch) toggleGrenadeMode(true);
    else inputState.grenadeAiming = !inputState.grenadeAiming;
  };
  return (
    <div className="relative flex items-end gap-1.5">
      <Slot active={self.slot === 1} label="1" onPress={() => actions.switchWeapon(1)}>
        <WeaponIcon weapon="pistol" className="h-4 w-10" />
        <span className="font-mono">{ammoText(self.pistolMag, self.pistolReserve)}</span>
      </Slot>
      <Slot active={self.slot === 2} label="2" onPress={() => actions.switchWeapon(2)}>
        {primary ? (
          <>
            <WeaponIcon weapon={primary.id} className="h-4 w-12" />
            <span className="font-mono">{ammoText(primary.mag, primary.reserve)}</span>
            {self.attachments?.mag && <span className="text-[0.6rem] text-amber-300">📦 cargador {magazineOf(primary.id, self.attachments)}</span>}
          </>
        ) : (
          <span className="py-1.5 text-stone-500">vacío</span>
        )}
      </Slot>
      <Slot active={inputState.grenadeMode || inputState.grenadeAiming || inputState.grenadeHeld} alert={noGrenades} label={isTouch ? '' : 'G'} onPress={onGrenade}>
        <WeaponIcon weapon="grenade" className="h-4 w-8" />
        <span className="font-mono">
          {self.grenades}/{BACKPACK[self.backpackLevel ?? 0]?.grenade ?? GRENADE.max}
        </span>
      </Slot>
      {(inputState.grenadeMode || inputState.grenadeAiming || noGrenades) && (
        <p className="absolute -top-6 right-0 whitespace-nowrap rounded bg-black/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-khaki-light">
          {noGrenades
            ? 'Sin granadas'
            : inputState.grenadeAiming
              ? 'Clic donde lanzar · clic derecho o Esc para cancelar'
              : 'Arrastra a la derecha y suelta · toca otra vez para salir'}
        </p>
      )}
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

// Curaciones (tocar o 4, 5, 6), equipo y accesorios (fase 18)
const HEALS = [
  ['bandage', 'bandages', 'Venda', '4', '🩹'],
  ['medkit', 'medkits', 'Botiquín', '5', '✚'],
  ['drink', 'drinks', 'Bebida', '6', '⚡'],
];

// Lo que lleva puesto el jugador como ids de objeto (chaleco, casco, mochila y accesorios)
function equipped(self) {
  const ids = [];
  if (self.armorLevel > 0) ids.push(`armor${self.armorLevel}`);
  if (self.helmetLevel > 0) ids.push(`helmet${self.helmetLevel}`);
  if (self.backpackLevel > 0) ids.push(`backpack${self.backpackLevel}`);
  for (const a of Object.values(self.attachments ?? {})) if (a) ids.push(a);
  return ids;
}

// Panel al tocar el equipo: qué tienes y qué efecto da cada cosa (fase 25)
function GearPanel({ self, onClose }) {
  const ids = equipped(self);
  return (
    <div className="absolute bottom-full left-0 mb-2 w-[min(80vw,19rem)] rounded-lg border border-white/15 bg-black/85 p-2 text-[0.7rem] text-stone-100 shadow-xl">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono uppercase tracking-[0.2em] text-khaki-light">Tu equipo</span>
        <TouchButton onPress={onClose} className="rounded bg-white/10 px-1.5 text-xs">
          ✕
        </TouchButton>
      </div>
      {ids.length === 0 && <p className="text-stone-400">Nada todavía: abre cajas (con su pregunta) para conseguir chaleco, casco, mochila y accesorios.</p>}
      {ids.map((id) => (
        <p key={id} className="flex gap-1.5 py-0.5">
          <span className="w-5 text-center text-sm leading-tight">{GEAR_INFO[id].icon}</span>
          <span>
            <b>{GEAR_INFO[id].short}</b> · {GEAR_INFO[id].effect}
          </span>
        </p>
      ))}
    </div>
  );
}

function Inventory({ self, isTouch, drinkLeft }) {
  const cap = BACKPACK[self.backpackLevel ?? 0];
  const [panel, setPanel] = useState(false);
  const slots = [
    ['🦺', 'Chaleco', self.armorLevel],
    ['⛑️', 'Casco', self.helmetLevel ?? 0],
    ['🎒', 'Mochila', self.backpackLevel ?? 0],
  ];
  const attachments = Object.values(self.attachments ?? {}).filter(Boolean);
  return (
    <div className="relative flex flex-col items-start gap-1">
      {panel && <GearPanel self={self} onClose={() => setPanel(false)} />}
      <div className="flex flex-wrap gap-1">
        {slots.map(([icon, name, level]) => (
          <TouchButton
            key={name}
            onPress={() => setPanel((p) => !p)}
            title={`${name} ${level || 'sin'} · toca para ver el efecto`}
            className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[0.7rem] ${level > 0 ? 'bg-black/65 text-sky-100' : 'bg-black/35 text-stone-500 grayscale'}`}
          >
            <span className="text-sm leading-none">{icon}</span>
            <span className="font-mono">{level || '–'}</span>
          </TouchButton>
        ))}
        {attachments.map((a) => (
          <TouchButton key={a} onPress={() => setPanel((p) => !p)} title={GEAR_INFO[a].short} className="rounded bg-black/65 px-1.5 py-0.5 text-sm leading-none">
            {GEAR_INFO[a].icon}
          </TouchButton>
        ))}
        {drinkLeft > 0 && <span className="rounded bg-emerald-800/80 px-1.5 py-0.5 text-[0.65rem] text-emerald-100">⚡ {drinkLeft} s</span>}
      </div>
      <div className="flex gap-1">
        {HEALS.map(([item, counter, name, key, icon]) => {
          const n = self[counter] ?? 0;
          return (
            <TouchButton
              key={item}
              onPress={() => n > 0 && actions.useItem(item)}
              className={`flex h-[2.6rem] w-[3.3rem] flex-col items-center justify-center rounded border text-[0.65rem] leading-tight ${
                n > 0 ? 'border-white/20 bg-stone-950/90 text-stone-100' : 'border-white/5 bg-stone-900/85 text-stone-500'
              }`}
            >
              <span className="text-sm leading-none">{icon}</span>
              <span className="font-mono">
                {n}/{cap[item]}
              </span>
              {!isTouch && <span className="sr-only">{name} ({key})</span>}
            </TouchButton>
          );
        })}
      </div>
      {!isTouch && <p className="text-[0.6rem] text-stone-400">4 venda · 5 botiquín · 6 bebida</p>}
    </div>
  );
}

const HEAL_LABEL = { bandage: 'Vendándote', medkit: 'Usando botiquín', drink: 'Bebiendo' };

// Munición del arma en mano
function handAmmo(self) {
  const pistol = self.slot !== 2 || !self.primary;
  return pistol ? { mag: self.pistolMag, reserve: self.pistolReserve } : { mag: self.primary.mag, reserve: self.primary.reserve };
}

// "Obtener balas": botón (celular) o B (PC); con espera tras fallar
function AmmoButton({ self, client, isTouch }) {
  const { mag, reserve } = handAmmo(self);
  const cooldown = Math.ceil(Math.max(0, (client.ammoCooldownEndsAt ?? 0) - performance.now()) / 1000);
  const empty = mag + reserve === 0;
  const low = reserve === 0;
  const busy = Boolean(client.ammoQuestion);
  const label = busy ? 'Respondiendo…' : cooldown > 0 ? `Balas en ${cooldown} s` : 'Obtener balas';
  const tone = empty ? 'bg-red-700/85 text-white animate-pulse' : low ? 'bg-amber-700/80 text-amber-50' : 'bg-black/55 text-amber-200';
  if (isTouch) {
    return (
      <TouchButton
        onPress={() => cooldown <= 0 && client.requestAmmo()}
        className={`h-12 w-24 rounded-2xl px-1 text-[10px] font-bold uppercase leading-tight ${tone} ${cooldown > 0 || busy ? 'opacity-60' : ''}`}
      >
        {label}
      </TouchButton>
    );
  }
  return (
    <p className={`rounded px-2 py-0.5 text-[11px] ${tone}`}>
      {cooldown <= 0 && !busy && <kbd className="mr-1 rounded bg-amber-300 px-1 font-bold text-black">B</kbd>}
      {empty ? 'Sin balas · ' : ''}
      {label}
    </p>
  );
}

function DeathScreen({ self, phase, deathAt, roster, myId }) {
  const killer = roster.find((p) => p.id === self.killedBy);
  const weapon = WEAPON_IDS[self.killedWith];
  const weaponName = weapon === 'grenade' ? GRENADE.name : WEAPONS[weapon]?.name;
  const respawnIn = Math.max(0, Math.ceil((RESPAWN_MS - (performance.now() - deathAt)) / 1000));
  let cause = weaponName ?? '';
  if (weapon === 'zone') cause = 'La zona te alcanzó';
  else if (weapon === 'bomb') cause = 'Bombardeo de los operadores de radio';
  else if (weapon === 'jeep') cause = killer && self.killedBy !== myId ? `Atropellado por ${killer.name}` : 'Un jeep te pasó por encima';
  else if (self.killedBy === myId) cause = 'por tu propia granada';
  else if (killer) cause = `por ${killer.name}${weaponName ? ` · ${weaponName}` : ''}`;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/40 text-center">
      <p className="text-4xl font-black uppercase tracking-[0.2em] text-red-500 drop-shadow">Eliminado</p>
      <p className="text-stone-200">{cause}</p>
      <p className="text-sm text-stone-400">
        {phase === 'lobby' ? `Reapareces en ${respawnIn}…` : 'Espera el final de la partida'}
      </p>
    </div>
  );
}

// Interfaz de combate: vida, armas, botones táctiles, aviso para tomar armas y pantalla de muerte
export default function CombatHUD({ view, phase, roster, myId, isTouch, client }) {
  const { self, reloadProgress, interact, damageFlashAt, deathAt, vehicle, healing, drinkLeft, lootToast, gearCard } = view;
  if (!self) return null;

  return (
    <>
      {damageFlashAt > 0 && (
        <div
          key={damageFlashAt}
          className="pointer-events-none absolute inset-0 z-20 animate-[damage_400ms_ease-out_forwards] shadow-[inset_0_0_80px_rgba(220,38,38,0.65)]"
        />
      )}

      {self.alive && (
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5">
          {vehicle && <JeepBar vehicle={vehicle} />}
          <HealthBar self={self} />
          {healing && (
            <div className="w-40">
              <p className="text-center text-[10px] uppercase tracking-widest text-emerald-300">{HEAL_LABEL[healing.item]}</p>
              <div className="h-1 overflow-hidden rounded bg-black/60">
                <div className="h-full bg-emerald-400" style={{ width: `${Math.min(1, healing.progress) * 100}%` }} />
              </div>
            </div>
          )}
          <WeaponBar self={self} reloadProgress={reloadProgress} isTouch={isTouch} />
        </div>
      )}

      {/* También en el campo de entrenamiento: se ve el chaleco del armero */}
      {self.alive && (
        <div className="absolute bottom-3 left-3 z-20">
          <Inventory self={self} isTouch={isTouch} drinkLeft={drinkLeft} />
        </div>
      )}

      {gearCard && (
        <div className="pointer-events-none absolute left-1/2 top-[30%] z-30 flex w-[min(90vw,22rem)] -translate-x-1/2 flex-col gap-1">
          {gearCard.items.map((id) => (
            <div key={id} className="flex items-center gap-2 rounded-lg border border-amber-400/60 bg-black/85 px-3 py-2 text-stone-100 shadow-lg">
              <span className="text-2xl leading-none">{GEAR_INFO[id].icon}</span>
              <span className="text-[0.8rem] leading-snug">
                <b className="text-amber-200">{GEAR_INFO[id].short}</b>
                <br />
                {GEAR_INFO[id].effect}
              </span>
            </div>
          ))}
        </div>
      )}

      {lootToast && (
        <p className="pointer-events-none absolute bottom-[9.5rem] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-2 py-0.5 text-xs text-stone-100">
          {lootToast.full ? `No te sirve o no te cabe: ${lootToast.name}` : `+ ${lootToast.names.join(', ')}`}
        </p>
      )}

      {interact && (
        <div className="absolute bottom-28 left-1/2 z-20 -translate-x-1/2">
          {interact.enabled && isTouch ? (
            <TouchButton
              onPress={actions.interact}
              className="rounded border-2 bg-khaki px-4 py-2 font-bold text-olive-950"
              style={{ borderColor: interact.color ?? 'transparent' }}
            >
              {interact.label}
            </TouchButton>
          ) : (
            <p
              className={`rounded border-l-4 bg-black/65 px-3 py-1.5 text-sm ${interact.enabled ? 'text-khaki-light' : 'text-stone-400'}`}
              style={{ borderColor: interact.color ?? 'transparent' }}
            >
              {interact.enabled && <kbd className="mr-1 rounded bg-khaki px-1.5 font-bold text-olive-950">E</kbd>}
              {interact.label}
            </p>
          )}
        </div>
      )}

      {self.alive && self.streak > 0 && (
        <p className="pointer-events-none absolute bottom-[7.5rem] right-3 z-20 rounded bg-black/55 px-2 py-0.5 font-mono text-[11px] text-sky-200 sm:bottom-24">
          Racha {self.streak % 3 === 0 ? 3 : self.streak % 3}/3
        </p>
      )}

      {!isTouch && self.alive && client && (
        <div className="absolute bottom-3 right-3 z-20">
          <AmmoButton self={self} client={client} isTouch={false} />
        </div>
      )}

      {isTouch && self.alive && (
        <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-3">
          {client && <AmmoButton self={self} client={client} isTouch />}
          <TouchButton
            onPress={() => press(BUTTONS.RELOAD)}
            className="h-12 w-12 rounded-full bg-black/55 text-[10px] font-bold uppercase text-khaki-light"
          >
            Rec.
          </TouchButton>
        </div>
      )}

      {/* En partida, el caído pasa a operador de radio (otro panel); aquí solo el lobby y los resultados */}
      {!self.alive && phase !== 'playing' && <DeathScreen self={self} phase={phase} deathAt={deathAt} roster={roster} myId={myId} />}
    </>
  );
}
