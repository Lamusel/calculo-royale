import { WEAPON_IDS } from '@calculo-royale/shared/constants';

// Siluetas propias de cada arma (killfeed y barra de armas). viewBox 48×16, apuntan a la derecha.
const PATHS = {
  pistol: 'M14 4h20v4H22l-2 7h-5l1.5-7H14z',
  shotgun: 'M2 6h7l2-2h33v4H22l-1 2h-6l-1 3H9l1-3H2z',
  rifle: 'M2 6h8l2-2h26v2h8v2H30l-2 6h-4l1-6h-7l-1 3h-5l1-3H2z',
  sniper: 'M1 7h9l2-2h34v2H26l-2 5h-4l1-5h-9l-1 3H6l1-3H1zM18 2h10v2H18z',
  grenade: 'M24 4a6 6 0 1 1-0.1 0zM22 1h6v3h-6zM28 2l5-1v2l-5 1z',
};

export default function WeaponIcon({ weapon, className = 'h-4 w-12' }) {
  const id = typeof weapon === 'number' ? WEAPON_IDS[weapon] : weapon;
  return (
    <svg viewBox="0 0 48 16" className={className} fill="currentColor" aria-hidden="true">
      <path d={PATHS[id] ?? PATHS.pistol} />
    </svg>
  );
}
