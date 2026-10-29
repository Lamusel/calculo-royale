// Iconos SVG propios y consistentes para el HUD (fases 29 y 32): trazo redondeado de 2 px sobre
// 24 × 24, en el color del texto. Nada de abreviaturas: cada acción tiene su dibujo.
const PATHS = {
  backpack: 'M8 6V5a4 4 0 0 1 8 0v1M6 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12H6zM9 13h6M9 17h6',
  heal: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z',
  bandage: 'M5 15 15 5l4 4-10 10zM9 11l1 1M12 8l1 1M11 13l1 1',
  medkit: 'M4 8h16v12H4zM9 8V5h6v3M12 11v6M9 14h6',
  drink: 'M8 3h8l-1 4h-6zM9 7h6l1 14H8zM10 12h4',
  frag: 'M12 9a6 6 0 1 1-6 6 6 6 0 0 1 6-6zM10 9V6h4v3M14 6l3-2',
  smoke: 'M6 15a3 3 0 0 1 1-6 4 4 0 0 1 8-1 3 3 0 0 1 3 5 3 3 0 0 1-3 4H8a3 3 0 0 1-2-2z',
  flash: 'M13 2 6 13h5l-1 9 7-11h-5z',
  molotov: 'M10 9V5h4v4l2 3v9H8v-9zM12 5c0-2 2-3 2-3',
  sensor: 'M12 13a1 1 0 1 0 0-.01M8 9a6 6 0 0 0 0 8M16 9a6 6 0 0 1 0 8M5 6a10 10 0 0 0 0 14M19 6a10 10 0 0 1 0 14',
  wall: 'M3 20c3-10 15-10 18 0M7 20c1-5 9-5 10 0',
  uav: 'M12 10v4M8 12h8M4 8a2 2 0 1 0 4 0 2 2 0 1 0-4 0M16 8a2 2 0 1 0 4 0 2 2 0 1 0-4 0M4 16a2 2 0 1 0 4 0 2 2 0 1 0-4 0M16 16a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  reload: 'M20 12a8 8 0 1 1-3-6.3M20 4v5h-5',
  ammo: 'M7 21V9l2-5 2 5v12zM13 21V9l2-5 2 5v12z',
  take: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  open: 'M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0',
  loot: 'M4 9h16v11H4zM4 9l2-4h12l2 4M10 13h4',
  enter: 'M4 15h16l-2-6H6zM7 15v3M17 15v3M9 9l1-3h4l1 3',
  exit: 'M10 5H5v14h5M14 8l4 4-4 4M18 12H9',
  seat: 'M7 4v9h9l2 7M7 13l-2 7',
  zipline: 'M3 5l18 6M12 8v5M9 16a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  horn: 'M4 10h4l6-4v12l-6-4H4zM17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12',
  melee: 'M5 19l9-9M14 10l5-5 1 4-4 4zM4 16l4 4',
  revive: 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10zM12 10v5M9.5 12.5h5',
  next: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6 6 18',
  swap: 'M7 7h12l-3-3M17 17H5l3 3',
  drop: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  glide: 'M2 12c5-6 15-6 20 0M12 8v12',
};

export default function Icon({ name, className = 'h-5 w-5', title }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={PATHS[name] ?? PATHS.close} />
    </svg>
  );
}
