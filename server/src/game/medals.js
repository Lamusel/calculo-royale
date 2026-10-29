// Medallas al final de la partida (fase 20): una por categoría para quien la ganó (sin bots).
// Si nadie hizo nada en una categoría, esa medalla no se entrega.

export const MEDALS = [
  { id: 'bajas', name: 'Más bajas', icon: '💀', value: (p) => p.kills, unit: 'bajas' },
  { id: 'calculista', name: 'Calculista', icon: '🧮', value: (p) => p.stats.correct, unit: 'aciertos' },
  { id: 'precision', name: 'Puntería matemática', icon: '🎯', value: (p) => (p.stats.answered >= 3 ? Math.round((p.stats.correct / p.stats.answered) * 100) : 0), unit: '% de aciertos' },
  { id: 'dano', name: 'Más daño', icon: '💥', value: (p) => Math.round(p.damageDealt ?? 0), unit: 'de daño' },
  { id: 'francotirador', name: 'Baja más lejana', icon: '🔭', value: (p) => Math.round(p.longestKill ?? 0), unit: 'm' },
  { id: 'saqueador', name: 'Saqueador', icon: '🎒', value: (p) => p.pickups ?? 0, unit: 'objetos' },
  { id: 'hormigas', name: 'Comehormigas', icon: '🐜', value: (p) => p.ants ?? 0, unit: 'hormigas culonas' },
  { id: 'filo', name: 'Filo', icon: '🗡️', value: (p) => p.meleeKills ?? 0, unit: 'bajas con arma blanca' },
];

// [{ id, name, icon, playerId, playerName, value, unit }]
export function awardMedals(players) {
  const people = players.filter((p) => !p.bot);
  return MEDALS.flatMap((m) => {
    let best = null;
    let bestValue = 0;
    for (const p of people) {
      const v = m.value(p);
      if (v > bestValue) {
        best = p;
        bestValue = v;
      }
    }
    return best ? [{ id: m.id, name: m.name, icon: m.icon, playerId: best.id, playerName: best.name, value: bestValue, unit: m.unit }] : [];
  });
}
