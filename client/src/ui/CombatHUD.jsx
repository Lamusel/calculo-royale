import { ARMOR_ABSORB, GRENADE, ITEM_NAMES, MAX_HP, RESPAWN_MS, WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';
import { BUTTONS } from '@calculo-royale/shared/protocol';
import { actions, inputState, press } from '../input/inputState.js';
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

function Slot({ active, label, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-w-[5.5rem] flex-col items-center rounded border px-2 py-1 text-[11px] leading-tight ${
        active ? 'border-khaki bg-black/70 text-khaki-light' : 'border-white/10 bg-black/45 text-stone-400'
      }`}
    >
      <span className="self-start font-mono text-[9px] opacity-60">{label}</span>
      {children}
    </button>
  );
}

function WeaponBar({ self, reloadProgress, isTouch }) {
  const primary = self.primary;
  return (
    <div className="relative flex items-end gap-1.5">
      <Slot active={self.slot === 1} label="1" onClick={() => actions.switchWeapon(1)}>
        <WeaponIcon weapon="pistol" className="h-4 w-10" />
        <span className="font-mono">{ammoText(self.pistolMag, null)}</span>
      </Slot>
      <Slot active={self.slot === 2} label="2" onClick={() => actions.switchWeapon(2)}>
        {primary ? (
          <>
            <WeaponIcon weapon={primary.id} className="h-4 w-12" />
            <span className="font-mono">{ammoText(primary.mag, primary.reserve)}</span>
          </>
        ) : (
          <span className="py-1.5 text-stone-500">vacío</span>
        )}
      </Slot>
      <Slot
        active={inputState.grenadeMode}
        label={isTouch ? '' : 'G'}
        onClick={() => {
          if (isTouch) inputState.grenadeMode = !inputState.grenadeMode && self.grenades > 0;
          else press(BUTTONS.GRENADE);
        }}
      >
        <WeaponIcon weapon="grenade" className="h-4 w-8" />
        <span className="font-mono">
          {self.grenades}/{GRENADE.max}
        </span>
      </Slot>
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
  if (self.killedBy === myId) cause = 'por tu propia granada';
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
  const { self, reloadProgress, rack, damageFlashAt, deathAt } = view;
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

      {rack && (
        <div className="absolute bottom-28 left-1/2 z-20 -translate-x-1/2">
          {isTouch ? (
            <button onClick={actions.interact} className="rounded bg-khaki px-4 py-2 font-bold text-olive-950">
              Tomar {ITEM_NAMES[rack.item]}
            </button>
          ) : (
            <p className="rounded bg-black/60 px-3 py-1.5 text-sm text-khaki-light">
              <kbd className="mr-1 rounded bg-khaki px-1.5 font-bold text-olive-950">E</kbd> Tomar {ITEM_NAMES[rack.item]}
            </p>
          )}
        </div>
      )}

      {isTouch && self.alive && (
        <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3">
          <button
            onClick={() => press(BUTTONS.RELOAD)}
            className="h-12 w-12 rounded-full bg-black/55 text-[10px] font-bold uppercase text-khaki-light"
          >
            Rec.
          </button>
        </div>
      )}

      {!self.alive && <DeathScreen self={self} phase={phase} deathAt={deathAt} roster={roster} myId={myId} />}
    </>
  );
}
