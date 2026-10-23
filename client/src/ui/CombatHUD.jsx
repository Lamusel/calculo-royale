import { useState } from 'react';
import { ARMOR_ABSORB, GRENADE, MAX_HP, RESPAWN_MS, WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';
import { BUTTONS } from '@calculo-royale/shared/protocol';
import { actions, inputState, press, toggleGrenadeMode } from '../input/inputState.js';
import WeaponIcon from './WeaponIcon.jsx';

const ammoText = (mag, reserve) => `${mag} / ${reserve === null || reserve === undefined ? '∞' : reserve}`;

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
export function TouchButton({ onPress, className, style, children }) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}

function Slot({ active, alert, label, children, onPress }) {
  const tone = alert
    ? 'border-red-400 bg-red-900/70 text-red-100'
    : active
      ? 'border-khaki bg-black/70 text-khaki-light'
      : 'border-white/10 bg-black/45 text-stone-400';
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

  // Celular: entra o sale del modo granada. PC: se usa G (mantener para ver el arco)
  const onGrenade = () => {
    if (self.grenades === 0) setNoGrenadesAt(performance.now());
    else if (isTouch) toggleGrenadeMode(true);
  };
  return (
    <div className="relative flex items-end gap-1.5">
      <Slot active={self.slot === 1} label="1" onPress={() => actions.switchWeapon(1)}>
        <WeaponIcon weapon="pistol" className="h-4 w-10" />
        <span className="font-mono">{ammoText(self.pistolMag, null)}</span>
      </Slot>
      <Slot active={self.slot === 2} label="2" onPress={() => actions.switchWeapon(2)}>
        {primary ? (
          <>
            <WeaponIcon weapon={primary.id} className="h-4 w-12" />
            <span className="font-mono">{ammoText(primary.mag, primary.reserve)}</span>
          </>
        ) : (
          <span className="py-1.5 text-stone-500">vacío</span>
        )}
      </Slot>
      <Slot active={inputState.grenadeMode} alert={noGrenades} label={isTouch ? '' : 'G'} onPress={onGrenade}>
        <WeaponIcon weapon="grenade" className="h-4 w-8" />
        <span className="font-mono">
          {self.grenades}/{GRENADE.max}
        </span>
      </Slot>
      {(inputState.grenadeMode || noGrenades) && (
        <p className="absolute -top-6 right-0 whitespace-nowrap rounded bg-black/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-khaki-light">
          {noGrenades ? 'Sin granadas' : 'Arrastra a la derecha y suelta · toca otra vez para salir'}
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

function DeathScreen({ self, phase, deathAt, roster, myId }) {
  const killer = roster.find((p) => p.id === self.killedBy);
  const weapon = WEAPON_IDS[self.killedWith];
  const weaponName = weapon === 'grenade' ? GRENADE.name : WEAPONS[weapon]?.name;
  const respawnIn = Math.max(0, Math.ceil((RESPAWN_MS - (performance.now() - deathAt)) / 1000));
  let cause = weaponName ?? '';
  if (weapon === 'zone') cause = 'La zona te alcanzó';
  else if (weapon === 'bomb') cause = 'Bombardeo de los operadores de radio';
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
export default function CombatHUD({ view, phase, roster, myId, isTouch }) {
  const { self, reloadProgress, interact, damageFlashAt, deathAt } = view;
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
          <HealthBar self={self} />
          <WeaponBar self={self} reloadProgress={reloadProgress} isTouch={isTouch} />
        </div>
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

      {isTouch && self.alive && (
        <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3">
          <TouchButton
            onPress={() => press(BUTTONS.RELOAD)}
            className="h-12 w-12 rounded-full bg-black/55 text-[10px] font-bold uppercase text-khaki-light"
          >
            Rec.
          </TouchButton>
        </div>
      )}

      {!self.alive && <DeathScreen self={self} phase={phase} deathAt={deathAt} roster={roster} myId={myId} />}
    </>
  );
}
