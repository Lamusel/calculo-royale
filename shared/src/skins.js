// Catálogo de skins. El servidor valida contra esta lista; los modelos viven en el cliente:
// las procedurales en client/src/game/models/skins.js y las externas (GLB) se configuran en
// client/src/game/character/skins/registry.js (aquí solo van sus IDs genéricos).

export const SKIN_RARITIES = {
  comun: { name: 'Común', color: '#9ca3af' },
  raro: { name: 'Rara', color: '#3b82f6' },
  epico: { name: 'Épica', color: '#a855f7' },
  legendario: { name: 'Legendaria', color: '#eab308' },
  honor: { name: 'De honor', color: '#f43f5e' },
};

// Logros de cálculo que desbloquean las skins de honor (progreso guardado en el navegador)
export const ACHIEVEMENTS = {
  legendarias: { name: 'Cazador de doradas', description: 'Acierta 10 cajas legendarias', goal: 10 },
  invicto: { name: 'Invicto', description: 'Gana una partida sin fallar ninguna pregunta', goal: 1 },
  operador: { name: 'Operador estrella', description: '5 aciertos seguidos como operador de radio', goal: 5 },
  aciertos: { name: 'Calculista', description: '50 aciertos en total', goal: 50 },
};

export const DEFAULT_SKIN = 'soldado';

export const SKINS = [
  { id: 'soldado', name: 'Soldado', collection: 'Básicas', rarity: 'comun' },

  { id: 'newton', name: 'Isaac Newton', collection: 'Leyendas de las Matemáticas', rarity: 'legendario' },
  { id: 'gauss', name: 'Carl F. Gauss', collection: 'Leyendas de las Matemáticas', rarity: 'legendario' },
  { id: 'euler', name: 'Leonhard Euler', collection: 'Leyendas de las Matemáticas', rarity: 'legendario' },
  { id: 'hipatia', name: 'Hipatia', collection: 'Leyendas de las Matemáticas', rarity: 'legendario' },
  { id: 'ada', name: 'Ada Lovelace', collection: 'Leyendas de las Matemáticas', rarity: 'legendario' },

  { id: 'culona', name: 'Comando Culona', collection: 'Santander', rarity: 'epico' },
  { id: 'chicamocha', name: 'Guardián del Chicamocha', collection: 'Santander', rarity: 'epico' },
  { id: 'arriero', name: 'Arriero', collection: 'Santander', rarity: 'epico' },

  { id: 'princesa', name: 'Princesa de Gala', collection: 'Fantasía', rarity: 'epico' },
  { id: 'caballero', name: 'Caballero Medieval', collection: 'Fantasía', rarity: 'raro' },
  { id: 'hechicera', name: 'Hechicera de Fuego', collection: 'Fantasía', rarity: 'epico' },
  { id: 'samurai', name: 'Samurái', collection: 'Fantasía', rarity: 'raro' },
  { id: 'ninja', name: 'Ninja Sombra', collection: 'Fantasía', rarity: 'raro' },

  { id: 'astronauta', name: 'Astronauta', collection: 'Locuras', rarity: 'epico' },
  { id: 'luchador', name: 'Luchador Integral', collection: 'Locuras', rarity: 'raro' },
  { id: 'dino', name: 'Dinosaurio Inflable', collection: 'Locuras', rarity: 'epico' },
  { id: 'robot', name: 'Robot Retro', collection: 'Locuras', rarity: 'raro' },
  { id: 'momia', name: 'Momia', collection: 'Locuras', rarity: 'raro' },
  { id: 'mariachi', name: 'Mariachi Táctico', collection: 'Locuras', rarity: 'epico' },

  { id: 'general', name: 'General Integral', collection: 'De honor', rarity: 'honor', achievement: 'legendarias' },
  { id: 'invicto', name: 'El Invicto', collection: 'De honor', rarity: 'honor', achievement: 'invicto' },
  { id: 'operador', name: 'Operador de Oro', collection: 'De honor', rarity: 'honor', achievement: 'operador' },
  { id: 'centurion', name: 'Centurión del Cálculo', collection: 'De honor', rarity: 'honor', achievement: 'aciertos' },

  // Espacios para skins externas (GLB). Nombre, rareza y ajustes: client/src/game/character/skins/registry.js
  ...[1, 2, 3, 4, 5].map((n) => ({
    id: `externa_0${n}`,
    name: `Skin externa ${n}`,
    collection: 'Skins externas',
    rarity: 'legendario',
    type: 'external',
  })),
];

export const EXTERNAL_SKIN_IDS = SKINS.filter((s) => s.type === 'external').map((s) => s.id);

export const SKIN_IDS = new Set(SKINS.map((s) => s.id));
export const skinById = (id) => SKINS.find((s) => s.id === id) ?? SKINS[0];

// ¿Puede usarla? Las de honor necesitan su logro (el cliente envía las que tiene desbloqueadas;
// es solo estética, así que el servidor confía en esa lista)
export function canUseSkin(id, unlocked = []) {
  if (!SKIN_IDS.has(id)) return false;
  const skin = skinById(id);
  return skin.rarity !== 'honor' || unlocked.includes(id);
}
