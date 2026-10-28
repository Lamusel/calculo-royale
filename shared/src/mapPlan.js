import { MAP_HALF } from './constants.js';

// Plano del mapa de 1 km (fase 34): geografía, zonas con nombre, carreteras y puntos marcados.
// Sin dependencias pesadas: lo usan el terreno, las colisiones, el minimapa y docs/mapa.png.
// Coordenadas matemáticas (x, y): x hacia el este, y hacia el norte; el mapa va de −500 a 500.

// --- Río: cruza de oeste a este como una curva suave y = riverY(x) ---
export const RIVER = { halfWidth: 11, bank: 7, deep: 9 }; // ancho del cauce, orilla en pendiente, parte honda
export const riverY = (x) => -110 + 45 * Math.sin((x + 500) / 160);

// Represa: muro de concreto que cruza el valle; al oeste queda el embalse (agua honda)
export const DAM = { x: -425, y: Math.round(riverY(-425)), w: 12, h: 84 };
export const RESERVOIR = { x: -478, y: DAM.y, rx: 50, ry: 62 };

// Puentes (de norte a sur, por donde pasan las carreteras) y un vado poco profundo
const bridge = (x) => ({ x, y: Math.round(riverY(x)), w: 8, h: 2 * (RIVER.halfWidth + RIVER.bank) + 2 });
export const BRIDGES = [bridge(-250), bridge(-40), bridge(110), bridge(330)];
export const FORD = { x: -150, y: Math.round(riverY(-150)), w: 16, h: 2 * RIVER.halfWidth + 4 };

// Montaña al noreste: cima con la antena de radio y un cerro más bajo al lado
export const MOUNTAINS = [
  { x: 390, y: 290, height: 40, sigma: 80 },
  { x: 455, y: 405, height: 18, sigma: 50 },
];

// Vía del tren abandonada (solo visual): cruza el sur del mapa de oeste a este
export const RAILWAY = { y: -236, x0: -500, x1: 390 };

const inRect = (r, x, y, margin = 0) => Math.abs(x - r.x) <= r.w / 2 + margin && Math.abs(y - r.y) <= r.h / 2 + margin;
export const onBridge = (x, y) => BRIDGES.some((b) => inRect(b, x, y));
export const onDam = (x, y) => inRect(DAM, x, y);

// Agua en (x, y): 0 tierra, 1 poco profunda (se camina lento y se dispara), 2 honda (se nada, no se dispara)
export function waterAt(x, y) {
  if (onDam(x, y) || onBridge(x, y)) return 0;
  if (x < DAM.x) {
    const dx = (x - RESERVOIR.x) / RESERVOIR.rx;
    const dy = (y - RESERVOIR.y) / RESERVOIR.ry;
    return dx * dx + dy * dy < 1 ? 2 : 0;
  }
  const d = Math.abs(y - riverY(x));
  if (d > RIVER.halfWidth) return 0;
  if (inRect(FORD, x, y)) return 1;
  return d < RIVER.deep ? 2 : 1;
}

// --- Zonas con nombre ---
// size: big (calientes, mucho botín) | mid | small (tranquilas). r = radio del campo de entrenamiento.
export const AREAS = {
  // Grandes
  city: { x: 0, y: 0, w: 160, h: 150, name: 'Ciudad Central', size: 'big' },
  base: { x: -320, y: 320, w: 120, h: 110, name: 'Base militar', size: 'big' },
  airfield: { x: -280, y: 110, w: 150, h: 80, name: 'Aeródromo', size: 'big' },
  dam: { x: -410, y: -88, w: 64, h: 92, name: 'Represa', size: 'big' },
  stadium: { x: 240, y: 60, w: 64, h: 80, name: 'Estadio', size: 'big' },
  // Medianas
  terminal: { x: -168, y: -22, w: 56, h: 56, name: 'Terminal de buses', size: 'mid' },
  market: { x: 110, y: 200, w: 70, h: 50, name: 'Plaza de mercado', size: 'mid' },
  hospital: { x: -120, y: 210, w: 56, h: 50, name: 'Hospital', size: 'mid' },
  university: { x: 60, y: 390, w: 110, h: 70, name: 'Universidad', size: 'mid' },
  industrial: { x: 320, y: -300, w: 110, h: 90, name: 'Zona industrial', size: 'mid' },
  suburb: { x: -150, y: 400, w: 90, h: 70, name: 'Barrio residencial', size: 'mid' },
  canyon: { x: -300, y: -350, w: 100, h: 110, name: 'Cañón', size: 'mid' },
  // Pequeñas
  farm: { x: -60, y: -330, w: 80, h: 70, name: 'Granja', size: 'small' },
  gas: { x: 150, y: -30, w: 40, h: 30, name: 'Gasolinera', size: 'small' },
  dock: { x: 200, y: -129, w: 44, h: 22, name: 'Muelle', size: 'small' },
  quarry: { x: 430, y: -420, w: 70, h: 60, name: 'Cantera', size: 'small' },
  forest: { x: -430, y: 180, w: 100, h: 120, name: 'Campamento del bosque', size: 'small' },
  cemetery: { x: -440, y: -340, w: 50, h: 50, name: 'Cementerio', size: 'small' },
  lookout: { x: 310, y: 215, w: 30, h: 30, name: 'Mirador', size: 'small' },
  antenna: { x: 390, y: 290, w: 30, h: 30, name: 'Antena de radio', size: 'small' },
  sawmill: { x: 140, y: -380, w: 50, h: 40, name: 'Aserradero', size: 'small' },
  coffee: { x: 420, y: 60, w: 60, h: 60, name: 'Hacienda cafetera', size: 'small' },
  station: { x: -170, y: -214, w: 60, h: 24, name: 'Estación de tren', size: 'small' },
  ranch1: { x: -300, y: -150, w: 22, h: 18, name: 'Rancho del Río', size: 'small' },
  ranch2: { x: 250, y: -205, w: 22, h: 18, name: 'Rancho La Vía', size: 'small' },
  ranch3: { x: 450, y: 450, w: 22, h: 18, name: 'Rancho del Norte', size: 'small' },
  ranch4: { x: 180, y: 320, w: 22, h: 18, name: 'Casas del Camino', size: 'small' },
  ranch5: { x: -450, y: 450, w: 22, h: 18, name: 'Rancho Viejo', size: 'small' },
  ranch6: { x: 440, y: -170, w: 22, h: 18, name: 'Rancho del Este', size: 'small' },
  // Campo de entrenamiento (solo en el lobby): la plaza central de la ciudad
  training: { x: 0, y: 0, r: 16 },
};

// --- Carreteras (asfalto, por donde andan los vehículos) y caminos de tierra ---
// Polilíneas de puntos (x, y). Las carreteras cruzan el río por los puentes.
const B = (i, dy) => [BRIDGES[i].x, BRIDGES[i].y + dy];
const span = BRIDGES[0].h / 2 + 1;
export const ROADS = [
  // Carretera oeste–este al norte del río
  [[-500, 4], [-330, 10], [-200, -6], [-80, 0]],
  [[80, 0], [150, -12], [240, 12], [330, 0], [500, 18]],
  // Norte–sur por la ciudad y el puente central
  [[10, 500], [20, 430], [0, 300], [0, 75]],
  [[0, -75], [-40, -70], B(1, span), B(1, -span), [-50, -200], [-60, -290], [-80, -500]],
  // Oeste: aeródromo, puente oeste, estación y cañón
  [[-250, 70], [-250, 10], B(0, span), B(0, -span), [-220, -160], [-180, -228], [-280, -300]],
  [[-300, 265], [-290, 190], [-250, 150]],
  [[-260, 330], [-200, 380], [-150, 365], [-60, 300], [0, 300]],
  // Mercado y estadio
  [[0, 300], [110, 225], [230, 110], [240, 100]],
  // Este: estadio, puente este, zona industrial y cantera
  [[262, 20], [330, -40], B(3, span), B(3, -span), [320, -255], [400, -390], [430, -450]],
  // Gasolinera, puente del muelle y aserradero
  [[150, -12], B(2, span), B(2, -span), [130, -250], [140, -360]],
  // Hospital y ciudad
  [[-120, 185], [-70, 120], [-60, 75]],
  // Calles de la ciudad (anillo y cruz)
  [[-80, 75], [80, 75], [80, -75], [-80, -75], [-80, 75]],
  [[-80, 0], [80, 0]],
  [[0, 75], [0, -75]],
];

// Caminos de tierra (más angostos, solo visuales)
export const PATHS = [
  // Zigzag de la montaña hasta la antena (pasa por el mirador)
  [[300, 100], [345, 150], [295, 190], [310, 215], [365, 230], [335, 262], [390, 290]],
  [[420, 60], [380, 30], [330, 0]],
  [[-430, 150], [-380, 60], [-330, 10]],
  [[-415, -40], [-370, 0], [-330, 10]],
  [[-405, -135], [-420, -250], [-440, -340]],
  [[-440, -340], [-345, -335]],
  [[-170, -228], [-60, -236], [-60, -290]],
  [[200, -118], [170, -60], [150, -12]],
  [[-300, -150], [-245, -120]],
  [[250, -205], [320, -255]],
  [[450, 440], [460, 300], [500, 18]],
  [[180, 320], [110, 225]],
  [[-450, 450], [-380, 360]],
  [[440, -170], [345, -120]],
  [[-150, 365], [-150, 330], [-120, 235]],
  [[-150, -50], [-150, -100], [-170, -200]],
  [[60, 355], [20, 330]],
];

// --- Puntos marcados para la parte 6.4 (vehículos, lanchas, tirolinas y plataformas) ---
// heading en radianes
export const PARKING = [
  { x: -90, y: 12, heading: 0 }, { x: 92, y: -10, heading: Math.PI }, { x: -12, y: 86, heading: -Math.PI / 2 },
  { x: -268, y: 62, heading: Math.PI / 2 }, { x: -300, y: 252, heading: -Math.PI / 2 }, { x: 214, y: 14, heading: 0 },
  { x: 174, y: -14, heading: Math.PI }, { x: 300, y: -246, heading: Math.PI / 2 }, { x: -200, y: -12, heading: Math.PI },
  { x: -44, y: -286, heading: Math.PI / 2 }, { x: -140, y: 350, heading: 0 }, { x: 100, y: 345, heading: Math.PI },
  { x: 395, y: 40, heading: Math.PI }, { x: -150, y: 182, heading: 0 },
];
export const DOCKS = [
  { x: 200, y: -147, heading: 0 }, { x: -458, y: -50, heading: -Math.PI / 2 }, { x: 30, y: -114, heading: Math.PI },
];
// Tirolinas: de un punto alto a uno bajo
export const ZIPLINES = [
  { from: [390, 290], to: [290, 140] },
  { from: [390, 290], to: [470, 160] },
  { from: [310, 215], to: [200, 255] },
  { from: [-425, -50], to: [-360, 0] },
];
// Plataformas de salto (te lanzan al aire y planeas)
export const PLATFORMS = [
  { x: -205, y: 255 }, { x: 160, y: -250 }, { x: -350, y: -40 }, { x: 410, y: -60 }, { x: 0, y: 220 }, { x: -230, y: -400 },
];

export const insidePlayable = (x, y, margin = 0) => Math.abs(x) <= MAP_HALF - margin && Math.abs(y) <= MAP_HALF - margin;
