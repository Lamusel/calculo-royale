import { WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';

// Siluetas propias de cada arma (killfeed y barra de armas). viewBox 48×16, apuntan a la derecha.
const PATHS = {
  pistol: 'M14 4h20v4H22l-2 7h-5l1.5-7H14z',
  shotgun: 'M2 6h7l2-2h33v4H22l-1 2h-6l-1 3H9l1-3H2z',
  rifle: 'M2 6h8l2-2h26v2h8v2H30l-2 6h-4l1-6h-7l-1 3h-5l1-3H2z',
  sniper: 'M1 7h9l2-2h34v2H26l-2 5h-4l1-5h-9l-1 3H6l1-3H1zM18 2h10v2H18z',
  grenade: 'M24 4a6 6 0 1 1-0.1 0zM22 1h6v3h-6zM28 2l5-1v2l-5 1z',
  // Zona: anillo con una onda; bombardeo: bomba con aletas
  zone: 'M24 1a7 7 0 1 1-0.1 0zm0 3a4 4 0 1 0 0.1 0zM12 8h4v1h-4zM32 8h4v1h-4z',
  bomb: 'M14 5h18l6 3-6 3H14l-3 2V3zM8 6h3v4H8z',
  // Jeep de perfil
  jeep: 'M8 6h8l3-4h6v4h12l3 2v4H8zM12 11a3 3 0 1 0 0.1 0zM34 11a3 3 0 1 0 0.1 0z',
  // Fase 29: subfusil, ametralladora, especiales, puños y lanzables
  smg: 'M10 5h22v4H22l-2 6h-4l1-6h-2l-1 5h-4l1-5h-1z',
  lmg: 'M1 6h8l2-2h28v2h8v2H30l-1 3h4v3h-9l1-6h-7l-1 3h-5l1-3H1z',
  rpg: 'M2 5h36l6 3-6 3H2zM14 11h4l-1 4h-4z',
  crossbow: 'M6 7h26v2H6zM30 1l2 14M28 8h-6l-2 5h-4l1-5',
  gl: 'M6 5h20a4 4 0 0 1 0 6H18l-2 4h-4l1-4H6z',
  fists: 'M14 6h16v6H14zM14 6l2-3h4l1 3M22 6l1-3h4l1 3',
  smoke: 'M18 8a6 6 0 0 1 12 0v6H18z', flash: 'M26 1 18 9h5l-2 6 8-8h-5z', molotov: 'M21 5h6v3l3 3v4H18v-4l3-3z',
  sensor: 'M18 8h12v6H18zM24 2v6', wall: 'M8 14c4-12 28-12 32 0', uav: 'M14 7h20v2H14zM10 5h6M32 5h6',
};
// Categoría → silueta (cada arma con nombre propio usa la de su tipo)
const BY_CATEGORY = { pistol: 'pistol', smg: 'smg', ar: 'rifle', shotgun: 'shotgun', dmr: 'sniper', sniper: 'sniper', lmg: 'lmg', melee: 'fists' };
const pathOf = (id) => PATHS[id] ?? PATHS[id === 'frag' ? 'grenade' : BY_CATEGORY[WEAPONS[id]?.category]] ?? PATHS.pistol;

export default function WeaponIcon({ weapon, className = 'h-4 w-12' }) {
  const id = typeof weapon === 'number' ? WEAPON_IDS[weapon] : weapon;
  return (
    <svg viewBox="0 0 48 16" className={className} fill="currentColor" aria-hidden="true">
      <path d={pathOf(id)} />
    </svg>
  );
}
