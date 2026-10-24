// Logo de Cálculo Royale (SVG hecho a mano): una mira con el signo de integral en el centro
export default function Logo({ className = 'h-24 w-24' }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="40" fill="none" stroke="#c8b27a" strokeWidth="5" />
      <circle cx="50" cy="50" r="27" fill="none" stroke="#c8b27a" strokeWidth="2" strokeDasharray="5 4" />
      {[[50, 2, 50, 18], [50, 82, 50, 98], [2, 50, 18, 50], [82, 50, 98, 50]].map(([x1, y1, x2, y2]) => (
        <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c8b27a" strokeWidth="5" strokeLinecap="round" />
      ))}
      <path d="M58 26c-4-3-9-1-10 5l-6 38c-1 6-6 8-10 5" fill="none" stroke="#f4ead2" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
