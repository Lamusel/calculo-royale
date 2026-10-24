import WeaponIcon from './WeaponIcon.jsx';

// Killfeed: "Ana [icono del arma] Juan", con el color de cada jugador
export default function Killfeed({ killfeed = [], roster, myId }) {
  if (killfeed.length === 0) return null;
  const byId = new Map(roster.map((p) => [p.id, p]));
  const name = (id) => byId.get(id) ?? { name: '¿?', color: '#a8a29e' };

  return (
    <div className="pointer-events-none absolute right-3 top-14 z-20 flex flex-col items-end gap-1 text-xs sm:text-sm">
      {killfeed.map((k) => {
        const killer = name(k.killer);
        const victim = name(k.victim);
        const mine = k.killer === myId || k.victim === myId;
        return (
          <div
            key={`${k.at}-${k.victim}`}
            className={`flex items-center gap-2 rounded px-2 py-0.5 ${mine ? 'bg-black/70 ring-1 ring-khaki/60' : 'bg-black/50'}`}
          >
            {k.killer !== null && k.killer !== k.victim && <span style={{ color: killer.color }}>{killer.name}</span>}
            <WeaponIcon weapon={k.weapon} className="h-3.5 w-10 text-stone-200" />
            <span style={{ color: victim.color }}>{victim.name}</span>
          </div>
        );
      })}
    </div>
  );
}
