import * as THREE from 'three';
import { box, cylinder, piece } from './build.js';

// Estilos de cada skin: colores del uniforme y piezas procedurales extra. Coordenadas del
// soldado: mira hacia +x, y hacia arriba, +z es su derecha. Cabeza centrada en (0, 1.82, 0),
// coronilla en 1.97, hombros en 1.47, cadera en 0.95, espalda hacia −x.
// `extra(accent)` y `armExtra(accent)` reciben el color del jugador: siempre debe verse en
// alguna pieza para distinguir a cada jugador.

// --- Piezas ---
const B = (w, h, d, color, position, rotation) => piece(box(w, h, d), color, { position, rotation });
const S = (r, color, position, scale = [1, 1, 1], w = 8, h = 6) => piece(new THREE.SphereGeometry(r, w, h), color, { position, scale });
const C = (rt, rb, h, color, position, rotation = [0, 0, 0], seg = 10) => piece(cylinder(rt, rb, h, seg), color, { position, rotation });
const K = (r, h, color, position, rotation = [0, 0, 0], seg = 8) => piece(new THREE.ConeGeometry(r, h, seg), color, { position, rotation });
const T = (r, tube, color, position, rotation = [Math.PI / 2, 0, 0]) => piece(new THREE.TorusGeometry(r, tube, 6, 16), color, { position, rotation });
const HALF = (r, color, position, scale = [1, 1, 1]) =>
  piece(new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), color, { position, scale });

const GOLD = '#d4a72c';
const WHITE = '#ece8dc';
const BLACK = '#1b1b1d';
const STEEL = '#8c9198';

// Sombrero de ala ancha (copa + ala)
const hat = (brimR, crownR, crownH, color, band, y = 1.98) => [
  C(brimR, brimR, 0.04, color, [0, y, 0], [0, 0, 0], 16),
  C(crownR * 0.9, crownR, crownH, color, [0, y + crownH / 2, 0], [0, 0, 0], 12),
  C(crownR + 0.005, crownR + 0.005, 0.06, band, [0, y + 0.05, 0], [0, 0, 0], 12),
];
// Capa colgando de los hombros por la espalda
const cape = (color, length = 1.1, width = 0.7) => [
  B(0.05, length, width, color, [-0.3, 1.6 - length / 2, 0], [0, 0, -0.12]),
];
// Bigote
const mustache = (color = BLACK) => [B(0.03, 0.04, 0.2, color, [0.16, 1.76, 0])];

export const SKIN_STYLES = {
  soldado: {},

  // --- Leyendas de las Matemáticas ---
  newton: {
    uniform: '#2c3e70', sleeve: '#2c3e70', pants: '#3b3020', helmet: false, goggles: false, backpack: false,
    extra: (accent) => [
      // Peluca blanca de rizos: copa, rizos a los lados y melena atrás
      S(0.21, WHITE, [-0.02, 1.95, 0], [1.1, 0.75, 1.15]),
      ...[-1, 1].flatMap((side) => [S(0.1, WHITE, [-0.02, 1.8, side * 0.19]), S(0.09, WHITE, [-0.04, 1.66, side * 0.2])]),
      S(0.15, WHITE, [-0.16, 1.72, 0], [1, 1.2, 1.3]),
      // Corbatín blanco, faldones del abrigo y botones del color del jugador
      B(0.06, 0.12, 0.12, WHITE, [0.2, 1.56, 0]),
      B(0.06, 0.45, 0.6, '#24345e', [-0.18, 0.82, 0]),
      ...[1.45, 1.32, 1.19].map((y) => B(0.04, 0.05, 0.05, accent, [0.23, y, 0.08])),
      // La manzana en el cinturón
      S(0.085, '#c0262d', [0.2, 0.98, 0.26]),
      B(0.015, 0.05, 0.015, '#4a3220', [0.2, 1.07, 0.26]),
      B(0.05, 0.015, 0.03, '#3f7a2a', [0.22, 1.08, 0.28]),
    ],
  },
  gauss: {
    uniform: '#5a4630', sleeve: '#5a4630', pants: '#2b2620', helmet: false, goggles: false, backpack: false,
    extra: (accent) => [
      // Gorro negro de terciopelo y pelo blanco a los lados
      C(0.17, 0.2, 0.12, BLACK, [-0.01, 2.0, 0], [0, 0, 0.12], 12),
      ...[-1, 1].map((side) => S(0.08, WHITE, [-0.04, 1.84, side * 0.17], [1, 1.2, 0.8])),
      // Bufanda del color del jugador y cuello blanco
      T(0.13, 0.04, accent, [0, 1.64, 0], [Math.PI / 2, 0, 0]),
      B(0.05, 0.2, 0.08, accent, [0.16, 1.5, 0.1]),
      B(0.04, 0.08, 0.16, WHITE, [0.2, 1.6, 0]),
      // Libro bajo el brazo (las Disquisitiones)
      B(0.28, 0.06, 0.2, '#7a2a1e', [0.02, 1.15, -0.4], [0.2, 0, 0]),
    ],
  },
  euler: {
    uniform: '#4a5a78', sleeve: '#4a5a78', pants: '#2b2f3a', helmet: false, goggles: false, backpack: false,
    extra: (accent) => [
      // Turbante: rollo grueso y copa
      T(0.17, 0.08, '#d9c8a5', [0, 1.98, 0], [Math.PI / 2, 0, 0]),
      S(0.15, '#cdbb96', [0, 2.04, 0], [1, 0.7, 1]),
      B(0.05, 0.1, 0.1, accent, [0.16, 2.0, 0]),
      // Bata con solapas del color del jugador y la e en el pecho
      B(0.04, 0.45, 0.06, accent, [0.22, 1.35, -0.12]),
      B(0.04, 0.45, 0.06, accent, [0.22, 1.35, 0.12]),
      T(0.06, 0.018, WHITE, [0.24, 1.3, 0], [0, Math.PI / 2, 0]),
    ],
  },
  hipatia: {
    uniform: '#e9e1cf', sleeve: '#e9e1cf', pants: '#d8cfb8', boots: '#8a6a3d', helmet: false, goggles: false, backpack: false,
    extra: (accent) => [
      // Pelo largo oscuro y corona de laurel
      S(0.17, '#2a1c14', [-0.04, 1.9, 0], [1.05, 0.9, 1.1]),
      B(0.12, 0.5, 0.3, '#2a1c14', [-0.13, 1.6, 0]),
      T(0.165, 0.025, '#5e8a3a', [0, 1.95, 0], [Math.PI / 2, 0, 0]),
      ...[-1, 1].map((side) => S(0.04, '#6fa046', [0.05, 1.96, side * 0.15], [1.4, 0.6, 1])),
      // Túnica larga y faja cruzada del color del jugador
      K(0.42, 0.75, '#e2d9c4', [0, 0.72, 0], [0, 0, 0], 10),
      B(0.05, 0.75, 0.1, accent, [0.22, 1.32, 0], [0.75, 0, 0]),
      // Astrolabio en la mano (disco dorado)
      C(0.12, 0.12, 0.03, GOLD, [0.35, 1.05, 0.32], [Math.PI / 2, 0, 0], 14),
    ],
  },
  ada: {
    uniform: '#5b3a6e', sleeve: '#5b3a6e', pants: '#4a2f5a', boots: '#2b1f2e', helmet: false, goggles: false, backpack: false,
    extra: (accent) => [
      // Peinado con moño y cinta del color del jugador
      S(0.165, '#3b2418', [-0.03, 1.9, 0], [1.05, 0.85, 1.12]),
      S(0.1, '#3b2418', [-0.17, 1.92, 0]),
      T(0.08, 0.02, accent, [-0.17, 1.92, 0], [0, Math.PI / 2, 0]),
      // Falda amplia de época y encaje blanco al cuello
      K(0.48, 0.7, '#4f3060', [0, 0.72, 0], [0, 0, 0], 12),
      T(0.12, 0.03, WHITE, [0, 1.63, 0], [Math.PI / 2, 0, 0]),
      // Tarjetas perforadas de la máquina analítica
      B(0.02, 0.22, 0.16, '#d9c79a', [0.24, 1.2, 0.18], [0, 0, 0.2]),
      B(0.02, 0.22, 0.16, '#cbb98c', [0.25, 1.22, 0.14], [0, 0, 0.1]),
    ],
  },

  // --- Santander ---
  culona: {
    uniform: '#4e5a2b', helmet: false, goggles: false, backpack: false,
    extra: (accent) => [
      // Casco de hormiga culona: cabeza grande, ojos, mandíbulas y antenas
      S(0.25, '#5a1e12', [0.02, 1.93, 0], [1.1, 0.95, 1.1]),
      ...[-1, 1].flatMap((side) => [
        S(0.07, BLACK, [0.17, 1.95, side * 0.15]),
        B(0.16, 0.04, 0.04, '#3a120a', [0.27, 1.78, side * 0.08], [0, side * 0.5, 0]),
        C(0.015, 0.015, 0.45, '#3a120a', [0.12, 2.25, side * 0.12], [side * 0.35, 0, -0.5], 5),
        S(0.045, accent, [0.23, 2.44, side * 0.2]),
      ]),
      // La culona: abdomen enorme a la espalda con franja del color del jugador
      S(0.32, '#6e2414', [-0.48, 1.18, 0], [1.25, 0.95, 1]),
      T(0.27, 0.035, accent, [-0.48, 1.18, 0], [0, Math.PI / 2, 0]),
      B(0.2, 0.08, 0.12, '#3a120a', [-0.24, 1.3, 0]),
    ],
  },
  chicamocha: {
    uniform: '#7a5a3a', sleeve: '#7a5a3a', pants: '#5a4630', helmet: false, goggles: false, backpack: false,
    extra: (accent) => [
      ...hat(0.38, 0.17, 0.2, '#6b4f2e', '#2b1d10'),
      // Pluma de cóndor en el sombrero
      B(0.04, 0.32, 0.08, BLACK, [-0.12, 2.18, 0.18], [0.3, 0, 0.4]),
      B(0.04, 0.08, 0.08, WHITE, [-0.06, 2.06, 0.15], [0.3, 0, 0.4]),
      // Pañoleta del color del jugador y capa color cañón con franjas de roca
      B(0.08, 0.1, 0.3, accent, [0.16, 1.73, 0]),
      ...cape('#b5653a', 1.2, 0.75),
      ...[1.4, 1.1, 0.8].map((y) => B(0.055, 0.06, 0.76, '#8a4a28', [-0.3 - (1.6 - y) * 0.12, y, 0], [0, 0, -0.12])),
      // Bastón de guardián
      C(0.03, 0.03, 1.9, '#5a4026', [0.1, 0.95, -0.45], [0.1, 0, 0], 6),
    ],
  },
  arriero: {
    uniform: '#efe9dc', sleeve: '#efe9dc', pants: '#3b3a36', boots: '#2b2620', helmet: false, goggles: false, backpack: false,
    extra: (accent) => [
      // Sombrero aguadeño: blanco, ala ancha y cinta negra
      ...hat(0.42, 0.17, 0.18, '#f2ecd8', BLACK),
      ...mustache(),
      // Ruana sobre los hombros con franjas del color del jugador
      B(0.62, 0.42, 0.88, '#7a2e2a', [0, 1.42, 0]),
      B(0.63, 0.06, 0.89, accent, [0, 1.3, 0]),
      B(0.63, 0.04, 0.89, '#3a1512', [0, 1.5, 0]),
      // Carriel de cuero al costado y machete
      B(0.22, 0.2, 0.08, '#6b4626', [0, 1.0, 0.38]),
      B(0.5, 0.06, 0.03, STEEL, [-0.05, 0.85, -0.38], [0, 0, -1.2]),
    ],
  },

  // --- Fantasía ---
  princesa: {
    uniform: '#e48ab1', sleeve: '#f0a7c6', pants: '#e48ab1', boots: '#c46a94', vest: ['#e48ab1', '#f3c1d6', '#f7cfe0', '#fbe0ec'],
    helmet: false, goggles: false, backpack: false,
    extra: (accent) => [
      // Pelo largo dorado y tiara con gemas
      S(0.17, '#e3b44f', [-0.03, 1.9, 0], [1.05, 0.88, 1.12]),
      B(0.12, 0.55, 0.32, '#e3b44f', [-0.13, 1.6, 0]),
      C(0.16, 0.16, 0.05, GOLD, [0, 2.0, 0], [0, 0, 0], 12),
      ...[-0.1, 0, 0.1].map((z, i) => K(0.035, i === 1 ? 0.16 : 0.1, GOLD, [0.12, i === 1 ? 2.1 : 2.07, z])),
      S(0.035, accent, [0.16, 2.0, 0]),
      // Armadura de gala: falda de placas y hombreras
      K(0.5, 0.7, '#e070a4', [0, 0.72, 0], [0, 0, 0], 12),
      ...[-1, 1].map((side) => S(0.13, '#f3c1d6', [0, 1.58, side * 0.36], [1, 0.7, 1])),
      T(0.42, 0.03, accent, [0, 0.4, 0], [Math.PI / 2, 0, 0]),
    ],
  },
  caballero: {
    uniform: '#8c9198', sleeve: '#9aa0a6', pants: '#7d8389', boots: '#5b6066', vest: ['#8c9198', '#a3a9af', '#b1b7bd', '#c3c9cf'],
    helmet: false, goggles: false, backpack: false, face: '#8c9198',
    extra: (accent) => [
      // Yelmo cerrado con rendija y penacho del color del jugador
      C(0.19, 0.19, 0.38, STEEL, [0, 1.86, 0], [0, 0, 0], 12),
      HALF(0.19, STEEL, [0, 2.05, 0], [1, 0.5, 1]),
      B(0.03, 0.03, 0.26, BLACK, [0.19, 1.89, 0]),
      K(0.06, 0.4, accent, [-0.04, 2.3, 0], [0, 0, 0.35]),
      // Tabardo del color del jugador y hombreras redondas
      B(0.04, 0.6, 0.36, accent, [0.23, 1.25, 0]),
      ...[-1, 1].map((side) => HALF(0.15, '#a3a9af', [0, 1.6, side * 0.36], [1.2, 0.8, 1])),
      // Escudo a la espalda
      B(0.06, 0.55, 0.45, '#6b4a2a', [-0.33, 1.3, 0]),
      B(0.065, 0.12, 0.46, accent, [-0.33, 1.3, 0]),
    ],
  },
  hechicera: {
    uniform: '#8c2a1e', sleeve: '#8c2a1e', pants: '#5a1a12', boots: '#2b1a12', helmet: false, goggles: false, backpack: false,
    extra: (accent) => [
      // Sombrero puntiagudo con ala y llamas
      C(0.33, 0.33, 0.03, '#5a1414', [0, 1.98, 0], [0, 0, 0], 14),
      K(0.18, 0.62, '#6e1a1a', [-0.05, 2.3, 0], [0, 0, 0.25], 10),
      C(0.185, 0.185, 0.06, accent, [0, 2.03, 0], [0, 0, 0], 12),
      ...[0, 1, 2].map((i) => K(0.06, 0.22, i === 1 ? '#ffd23a' : '#ff7a1a', [-0.1 + i * 0.03, 2.6 + (i % 2) * 0.05, -0.05 + i * 0.05], [0, 0, 0.25])),
      // Pelo rojo, capa y túnica larga
      B(0.1, 0.4, 0.3, '#c2401e', [-0.13, 1.66, 0]),
      ...cape('#4a0f0f', 1.25, 0.72),
      K(0.44, 0.7, '#7a2418', [0, 0.72, 0], [0, 0, 0], 12),
      // Bastón con orbe de fuego
      C(0.025, 0.025, 1.6, '#3a2414', [0.35, 1.05, 0.38], [0, 0, 0], 6),
      S(0.09, '#ff8a1a', [0.35, 1.9, 0.38]),
    ],
  },
  samurai: {
    uniform: '#2a1e1e', sleeve: '#3a1e1e', pants: '#2a1e1e', boots: '#1a1414', vest: ['#7a1e1e', '#8c2222', '#9a2a24', '#a8342a'],
    helmet: false, goggles: false, backpack: false,
    extra: (accent) => [
      // Kabuto lacado con cuernos dorados (kuwagata) y faldón del casco
      HALF(0.22, '#1e1414', [0, 1.9, 0], [1.05, 0.85, 1.05]),
      C(0.26, 0.3, 0.12, '#1e1414', [-0.03, 1.86, 0], [0, 0, 0], 12),
      ...[-1, 1].map((side) => B(0.04, 0.3, 0.05, GOLD, [0.16, 2.1, side * 0.1], [side * 0.45, 0, 0])),
      S(0.04, accent, [0.2, 1.98, 0]),
      // Hombreras de láminas (sode) con cordón del color del jugador
      ...[-1, 1].flatMap((side) =>
        [0, 1, 2].map((i) => B(0.3, 0.06, 0.12, i === 1 ? accent : '#7a1e1e', [0, 1.55 - i * 0.07, side * (0.4 + i * 0.02)])),
      ),
      // Katanas al cinto
      B(0.9, 0.04, 0.04, BLACK, [-0.1, 1.0, -0.36], [0, 0, 0.35]),
    ],
  },
  ninja: {
    uniform: '#1b1b20', sleeve: '#1b1b20', pants: '#1b1b20', boots: '#111114', vest: ['#24242a', '#2b2b33', '#33333d', '#3b3b47'],
    helmet: false, goggles: false, backpack: false, face: '#1b1b20',
    extra: (accent) => [
      // Capucha con rendija para los ojos
      S(0.18, '#1b1b20', [0, 1.88, 0], [1.05, 0.95, 1.05]),
      B(0.03, 0.05, 0.22, '#c49a72', [0.17, 1.86, 0]),
      // Banda larga del color del jugador ondeando atrás
      T(0.17, 0.025, accent, [0, 1.94, 0], [Math.PI / 2, 0, 0]),
      B(0.4, 0.05, 0.08, accent, [-0.35, 1.9, 0.05], [0, 0.3, -0.4]),
      B(0.3, 0.05, 0.08, accent, [-0.55, 1.75, -0.02], [0, -0.3, -0.6]),
      // Katana cruzada en la espalda
      B(0.04, 1.0, 0.04, STEEL, [-0.26, 1.35, 0], [0.75, 0, 0]),
      B(0.05, 0.25, 0.05, BLACK, [-0.26, 1.78, -0.32], [0.75, 0, 0]),
    ],
  },

  // --- Locuras ---
  astronauta: {
    uniform: '#e8eaee', sleeve: '#e8eaee', pants: '#dfe2e7', boots: '#9aa0a8', vest: ['#e8eaee', '#cfd5dc', '#c0c8d2', '#b2bcc8'],
    helmet: false, goggles: false, backpack: false, face: '#e8eaee',
    extra: (accent) => [
      // Casco esférico con visera dorada
      S(0.3, '#f4f5f7', [0, 1.86, 0], [1, 1, 1], 12, 8),
      piece(new THREE.SphereGeometry(0.31, 12, 8, -Math.PI / 2.4, Math.PI / 1.2, Math.PI / 4, Math.PI / 2.2), '#d9a52c', {
        position: [0, 1.86, 0],
      }),
      // Mochila de soporte vital con franja del color del jugador y antena
      B(0.24, 0.55, 0.52, '#f0f1f4', [-0.33, 1.3, 0]),
      B(0.25, 0.08, 0.53, accent, [-0.33, 1.42, 0]),
      C(0.012, 0.012, 0.4, STEEL, [-0.38, 1.75, 0.18], [0, 0, 0], 5),
      S(0.03, '#ff4040', [-0.38, 1.96, 0.18]),
      // Parche de misión
      C(0.07, 0.07, 0.02, accent, [0.22, 1.42, -0.15], [0, 0, Math.PI / 2], 12),
    ],
  },
  luchador: {
    uniform: '#c62828', sleeve: '#c49a72', pants: '#1f3b8c', boots: '#f2f2f2', vest: ['#c62828', '#d43a3a', '#e04a4a', '#ea5b5b'],
    helmet: false, goggles: false, backpack: false,
    extra: (accent) => [
      // Máscara de diseño propio: base del color del jugador, ojos y boca con ribete blanco y una ∫ en la frente
      S(0.175, accent, [0, 1.84, 0], [1.05, 1.08, 1.05]),
      ...[-1, 1].map((side) => B(0.04, 0.06, 0.09, WHITE, [0.17, 1.88, side * 0.07], [0, 0, side * 0.2])),
      B(0.04, 0.03, 0.12, WHITE, [0.17, 1.75, 0]),
      B(0.03, 0.14, 0.03, GOLD, [0.15, 1.98, 0], [0, 0, 0.2]),
      // Capa corta y cinturón de campeón
      ...cape(accent, 0.7, 0.62),
      B(0.46, 0.16, 0.7, GOLD, [0, 1.0, 0]),
      C(0.1, 0.1, 0.03, '#f5d76e', [0.24, 1.0, 0], [0, 0, Math.PI / 2], 12),
    ],
  },
  dino: {
    uniform: '#4caf50', sleeve: '#4caf50', pants: '#43a047', boots: '#388e3c', vest: ['#4caf50', '#57b85b', '#62c166', '#6dca71'],
    helmet: false, goggles: false, backpack: false, face: '#4caf50',
    extra: (accent) => [
      // Cabezota de dinosaurio inflable con hocico, ojos y dientes
      S(0.3, '#55b95a', [0.02, 2.05, 0], [1.1, 0.95, 1]),
      B(0.32, 0.2, 0.34, '#55b95a', [0.25, 1.98, 0]),
      ...[-1, 1].flatMap((side) => [S(0.06, WHITE, [0.15, 2.16, side * 0.15]), S(0.03, BLACK, [0.19, 2.17, side * 0.16])]),
      ...[-0.12, -0.04, 0.04, 0.12].map((z) => K(0.025, 0.06, WHITE, [0.36, 1.86, z], [Math.PI, 0, 0], 4)),
      // Cola y crestas del color del jugador en la espalda
      K(0.18, 0.9, '#4caf50', [-0.55, 0.85, 0], [0, 0, 1.25], 8),
      ...[1.75, 1.5, 1.25, 1.0].map((y) => K(0.07, 0.18, accent, [-0.24, y, 0], [0, 0, 1.2], 4)),
    ],
  },
  robot: {
    uniform: '#9ea7b0', sleeve: '#8a939c', pants: '#7d868f', boots: '#5b636b', vest: ['#9ea7b0', '#aab3bc', '#b6bfc8', '#c2cbd4'],
    helmet: false, goggles: false, backpack: false, face: '#b8c0c8',
    extra: (accent) => [
      // Cabeza cuadrada con ojos cian, rejilla y antena con bombillo
      B(0.36, 0.34, 0.36, '#b8c0c8', [0, 1.86, 0]),
      ...[-1, 1].map((side) => B(0.03, 0.07, 0.07, '#33e0ff', [0.19, 1.9, side * 0.08])),
      ...[0, 1, 2].map((i) => B(0.03, 0.02, 0.18, BLACK, [0.19, 1.76 + i * 0.03, 0])),
      C(0.012, 0.012, 0.22, STEEL, [0, 2.14, 0], [0, 0, 0], 5),
      S(0.05, accent, [0, 2.27, 0]),
      // Panel del pecho con perillas y orejas de tornillo
      B(0.04, 0.22, 0.3, '#5b636b', [0.23, 1.38, 0]),
      ...[-0.08, 0.08].map((z) => C(0.035, 0.035, 0.03, accent, [0.26, 1.4, z], [0, 0, Math.PI / 2], 8)),
      ...[-1, 1].map((side) => C(0.06, 0.06, 0.05, STEEL, [0, 1.86, side * 0.2], [Math.PI / 2, 0, 0], 8)),
    ],
  },
  momia: {
    uniform: '#d9cfb3', sleeve: '#d9cfb3', pants: '#d0c6a8', boots: '#b8ad8e', vest: ['#d9cfb3', '#cfc4a5', '#c5ba9b', '#bbb091'],
    helmet: false, goggles: false, backpack: false, face: '#d9cfb3',
    extra: (accent) => [
      // Cabeza vendada con ojos verdes brillantes
      S(0.175, '#e3dac0', [0, 1.84, 0], [1.05, 1.05, 1.05]),
      ...[1.76, 1.84, 1.92].map((y, i) => T(0.16 + (i % 2) * 0.01, 0.022, '#c8bd9e', [0, y, 0], [Math.PI / 2 + (i - 1) * 0.2, 0, 0])),
      ...[-1, 1].map((side) => S(0.03, '#7dff6a', [0.17, 1.86, side * 0.07])),
      // Vendas sueltas y amuleto del color del jugador
      ...[1.5, 1.3, 1.1].map((y, i) => T(0.36, 0.022, '#c8bd9e', [0, y, 0], [Math.PI / 2 + (i - 1) * 0.15, 0, 0])),
      B(0.35, 0.05, 0.06, '#e3dac0', [-0.3, 1.2, 0.2], [0, 0.4, -0.8]),
      S(0.06, accent, [0.23, 1.5, 0], [0.5, 1, 1]),
    ],
  },
  mariachi: {
    uniform: '#141414', sleeve: '#141414', pants: '#141414', boots: '#2b1d10', vest: ['#1e1e1e', '#2a2a2a', '#333333', '#3d3d3d'],
    helmet: false, goggles: false, backpack: false,
    extra: (accent) => [
      // Sombrero charro enorme con ribete dorado
      C(0.55, 0.55, 0.04, '#1e1e1e', [0, 1.98, 0], [0, 0, 0], 18),
      T(0.55, 0.02, GOLD, [0, 1.99, 0], [Math.PI / 2, 0, 0]),
      C(0.13, 0.19, 0.32, '#1e1e1e', [0, 2.16, 0], [0, 0, 0], 12),
      T(0.18, 0.02, GOLD, [0, 2.06, 0], [Math.PI / 2, 0, 0]),
      ...mustache(),
      // Moño del color del jugador y botonadura de plata
      B(0.05, 0.08, 0.2, accent, [0.21, 1.6, 0]),
      ...[1.45, 1.32, 1.19].flatMap((y) => [-1, 1].map((side) => S(0.025, '#d9d9d9', [0.22, y, side * 0.12]))),
      // Guitarrón a la espalda
      S(0.26, '#8a5a2a', [-0.34, 1.15, 0], [0.4, 1, 1]),
      B(0.05, 0.5, 0.06, '#5a3a1a', [-0.34, 1.55, 0]),
    ],
  },

  // --- De honor ---
  general: {
    uniform: '#1d2a1a', sleeve: '#1d2a1a', pants: '#1a2318', vest: ['#1d2a1a', '#26351f', '#2f4026', '#384a2d'], helmet: false, goggles: false,
    extra: (accent) => [
      // Gorra de plato con visera y la ∫ dorada
      C(0.2, 0.22, 0.1, '#1d2a1a', [0, 2.02, 0], [0, 0, 0], 14),
      C(0.24, 0.24, 0.04, '#1d2a1a', [0, 2.08, 0], [0, 0, 0], 14),
      B(0.12, 0.02, 0.24, BLACK, [0.17, 1.97, 0]),
      B(0.03, 0.12, 0.03, GOLD, [0.22, 2.05, 0], [0, 0, 0.25]),
      // Charreteras doradas, medallas y capa del color del jugador
      ...[-1, 1].map((side) => B(0.22, 0.06, 0.16, GOLD, [0, 1.62, side * 0.36])),
      ...[0, 1, 2].map((i) => C(0.035, 0.035, 0.02, i === 1 ? accent : GOLD, [0.23, 1.45, -0.18 + i * 0.07], [0, 0, Math.PI / 2], 8)),
      ...cape(accent, 1.1, 0.7),
    ],
  },
  invicto: {
    uniform: '#c9a23a', sleeve: '#d4ad45', pants: '#b8922e', boots: '#8a6a1e', vest: ['#d4ad45', '#e0bb52', '#ebc85f', '#f5d56c'],
    helmet: false, goggles: false, backpack: false, face: '#d4ad45',
    extra: (accent) => [
      // Armadura dorada completa con laurel y aura
      S(0.18, '#e0bb52', [0, 1.86, 0], [1.05, 1.05, 1.05]),
      B(0.03, 0.04, 0.24, BLACK, [0.18, 1.88, 0]),
      T(0.175, 0.03, '#5e8a3a', [0, 1.98, 0], [Math.PI / 2, 0, 0]),
      T(0.3, 0.02, '#fff2a8', [0, 2.3, 0], [Math.PI / 2, 0, 0]),
      ...[-1, 1].map((side) => HALF(0.16, '#f5d56c', [0, 1.6, side * 0.36], [1.2, 0.8, 1])),
      ...cape(accent, 1.15, 0.72),
    ],
  },
  operador: {
    uniform: '#3d4a2a', helmet: false, goggles: false, backpack: false,
    extra: (accent) => [
      // Gorra con audífonos dorados y micrófono
      HALF(0.18, '#3d4a2a', [0, 1.9, 0], [1.05, 0.7, 1.05]),
      B(0.12, 0.02, 0.2, '#2b3420', [0.16, 1.92, 0]),
      T(0.2, 0.02, GOLD, [0, 1.9, 0], [0, 0, 0]),
      ...[-1, 1].map((side) => C(0.07, 0.07, 0.05, GOLD, [0, 1.84, side * 0.18], [Math.PI / 2, 0, 0], 10)),
      B(0.18, 0.02, 0.02, BLACK, [0.1, 1.76, 0.17], [0, 0.6, 0]),
      S(0.025, accent, [0.18, 1.76, 0.12]),
      // Radio enorme a la espalda con antena alta y luz del color del jugador
      B(0.3, 0.55, 0.5, '#2b3420', [-0.36, 1.3, 0]),
      B(0.31, 0.06, 0.51, GOLD, [-0.36, 1.45, 0]),
      C(0.012, 0.012, 1.0, STEEL, [-0.42, 2.0, 0.18], [0, 0, 0], 5),
      S(0.04, accent, [-0.42, 2.5, 0.18]),
    ],
  },
  centurion: {
    uniform: '#8a2a1e', sleeve: '#8a2a1e', pants: '#7a241a', boots: '#5a3a1a', vest: ['#a87a3a', '#b8873f', '#c69444', '#d4a14a'],
    helmet: false, goggles: false, backpack: false,
    extra: (accent) => [
      // Casco romano de bronce con penacho transversal del color del jugador
      HALF(0.2, '#b8873f', [0, 1.88, 0], [1.05, 0.9, 1.05]),
      ...[-1, 1].map((side) => B(0.12, 0.16, 0.03, '#b8873f', [0.04, 1.8, side * 0.19])),
      B(0.1, 0.18, 0.5, accent, [-0.02, 2.12, 0]),
      // Capa roja y faldón de tiras
      ...cape('#7a1a12', 1.2, 0.72),
      ...[-0.24, -0.08, 0.08, 0.24].map((z) => B(0.36, 0.3, 0.12, '#a87a3a', [0, 0.85, z])),
    ],
  },
};

export const styleOf = (id) => SKIN_STYLES[id] ?? SKIN_STYLES.soldado;
