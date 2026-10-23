// Busca el clip de un archivo por su significado, aceptando variantes de nombre
// ("Idle", "idle_01", "StandingIdle", "mixamo.com|Walking"…)

const VARIANTS = {
  idle: ['idle', 'standing', 'breath'],
  walk: ['walk'],
  run: ['run', 'sprint', 'jog'],
  aim: ['aim'],
  shoot: ['shoot', 'fire', 'attack', 'punch'],
  reload: ['reload'],
  death: ['death', 'die', 'dying', 'dead'],
  victory: ['victory', 'win', 'dance', 'celebrat', 'cheer', 'wave', 'yes', 'thumbsup'],
  drive: ['drive', 'driving', 'sit'],
  passenger: ['passenger', 'sit', 'seat'],
};

// Si no hay clip para el estado, se prueba con uno parecido antes de quedar en pose neutra
const SIMILAR = { run: 'walk', aim: 'idle', shoot: 'aim', reload: 'idle', drive: 'idle', passenger: 'drive' };

const clean = (name) =>
  name
    .toLowerCase()
    .replace(/mixamo\.com/g, '')
    .replace(/^.*\|/, '')
    .replace(/[^a-z]/g, '');

export function findAnimationBySemantic(clips, semantic) {
  for (let s = semantic; s; s = SIMILAR[s]) {
    const words = VARIANTS[s] ?? [s];
    const clip = clips.find((c) => words.some((w) => clean(c.name).includes(w)));
    if (clip) return clip;
    if (s === 'idle') break;
  }
  return null;
}
