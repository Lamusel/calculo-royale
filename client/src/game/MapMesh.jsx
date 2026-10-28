import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MAP_HALF } from '@calculo-royale/shared/constants';
import { AREAS, DAM, FIELDS, FORD, PATHS, PITCH, RAILWAY, RESERVOIR, RIVER, ROADS, RUNWAY, riverY } from '@calculo-royale/shared/mapLayout';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { distanceToPaths } from './paths.js';

// Convención: el plano matemático (x, y) se dibuja en Three.js como (x, altura, −y).
// Terreno low-poly: cada triángulo tiene un solo color (pasto, tierra, grava, asfalto…).
// Mapa de 1 km en baldosas de TILE m: todas tienen una versión gruesa (vista desde el bus y el
// proyector) y las cercanas a la cámara se reemplazan por una fina, construida una por cuadro.

const TILE = 100;
const FINE = 2; // celda de la malla fina
const COARSE = 10; // celda de la malla gruesa
const RING = 1; // baldosas extra fuera del área jugable
const FINE_REACH = 150; // baldosas finas a menos de esto de la cámara (centro a centro, más medio lado)
const FINE_DROP = 260; // más lejos que esto se liberan
const TILES = Math.round((MAP_HALF * 2) / TILE);

// Colores un poco más claros que al principio: en celular el terreno se veía muy oscuro
const GRASS_DARK = new THREE.Color('#617c38');
const GRASS_LIGHT = new THREE.Color('#819c4a');
const DIRT = new THREE.Color('#9a8052');
const GRAVEL = new THREE.Color('#938d7d');
const PAVED = new THREE.Color('#8a877d');
const PATH = new THREE.Color('#a58a5f');
const GRASS_DRY = new THREE.Color('#999953');
const FOREST = new THREE.Color('#4a6630');
const ASPHALT = new THREE.Color('#55564f');
const PITCH_GREEN = new THREE.Color('#5f9a3c');
const ROCKY = new THREE.Color('#9b7a5a');
const STONE = new THREE.Color('#8f8c84');
const SAND = new THREE.Color('#b9a67a');
const RIVERBED = new THREE.Color('#5e5a44');
const CROP_A = new THREE.Color('#7d8f3a');
const CROP_B = new THREE.Color('#8f7444');
const BALLAST = new THREE.Color('#6b5d4c');

function hash(ix, iy) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Ruido de valor suave en [0, 1]
function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const smooth = (edge0, edge1, v) => {
  const t = Math.max(0, Math.min(1, (v - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

// Qué tan dentro de un área rectangular está el punto (1 dentro, 0 lejos)
function rectWeight(area, x, y, fade) {
  const dx = Math.abs(x - area.x) - area.w / 2;
  const dy = Math.abs(y - area.y) - area.h / 2;
  return 1 - smooth(0, fade, Math.max(dx, dy));
}

// Tinte del suelo de cada zona: [color, intensidad, borde]
const AREA_TINT = {
  city: [PAVED, 0.75, 4], base: [GRAVEL, 0.55, 4], industrial: [GRAVEL, 0.85, 4], terminal: [GRAVEL, 0.7, 4], market: [GRAVEL, 0.6, 4],
  airfield: [GRAVEL, 0.35, 4], hospital: [PAVED, 0.5, 3], university: [GRAVEL, 0.4, 3], forest: [FOREST, 0.8, 8], canyon: [ROCKY, 0.7, 6],
  quarry: [ROCKY, 0.85, 5], dam: [GRAVEL, 0.5, 4], farm: [DIRT, 0.5, 5], gas: [PAVED, 0.8, 2], station: [GRAVEL, 0.6, 3], sawmill: [DIRT, 0.7, 3],
  dock: [DIRT, 0.5, 3], lookout: [ROCKY, 0.5, 3], antenna: [STONE, 0.6, 3],
};
const TINTS = Object.entries(AREA_TINT).map(([k, t]) => [AREAS[k], ...t]);

// Las polilíneas que tocan un rectángulo (para no medir la distancia a todo el mapa)
function linesNear(lines, minX, minY, maxX, maxY, pad) {
  const out = [];
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const [ax, ay] = line[i - 1];
      const [bx, by] = line[i];
      if (Math.max(ax, bx) < minX - pad || Math.min(ax, bx) > maxX + pad || Math.max(ay, by) < minY - pad || Math.min(ay, by) > maxY + pad) continue;
      out.push([line[i - 1], line[i]]);
    }
  }
  return out;
}

function groundColor(x, y, h, near, out) {
  const n = noise(x / 9, y / 9) + (hash(Math.round(x * 3), Math.round(y * 3)) - 0.5) * 0.15;
  out.copy(GRASS_DARK).lerp(GRASS_LIGHT, Math.max(0, Math.min(1, n)));
  out.lerp(GRASS_DRY, smooth(0.6, 0.85, noise(x / 23 - 7, y / 23 + 3)) * 0.5);
  out.lerp(DIRT, smooth(0.62, 0.78, noise(x / 14 + 50, y / 14 - 20)) * 0.8);
  // Montaña: roca y piedra cuanto más alto
  out.lerp(ROCKY, smooth(9, 18, h) * 0.6 * smooth(0.3, 0.6, noise(x / 7, y / 7) + 0.2));
  out.lerp(STONE, smooth(24, 34, h) * 0.8);
  for (const [area, color, amount, fade] of TINTS) {
    if (Math.abs(x - area.x) > area.w / 2 + fade || Math.abs(y - area.y) > area.h / 2 + fade) continue;
    out.lerp(color, rectWeight(area, x, y, fade) * amount);
  }
  const training = 1 - smooth(AREAS.training.r - 6, AREAS.training.r, Math.hypot(x, y));
  out.lerp(PAVED, training * 0.5);
  // Cultivos: surcos alternados
  for (const f of FIELDS) {
    if (Math.abs(x - f.x) > f.w / 2 || Math.abs(y - f.y) > f.h / 2) continue;
    out.lerp(Math.floor((f.w > f.h ? y : x) / 2.5) % 2 ? CROP_A : CROP_B, 0.85);
  }
  out.lerp(PITCH_GREEN, rectWeight(PITCH, x, y, 1) * 0.9);
  out.lerp(ASPHALT, rectWeight(RUNWAY, x, y, 0.5));
  // Orillas de arena y fondo del río
  const dr = x < DAM.x ? (Math.hypot((x - RESERVOIR.x) / RESERVOIR.rx, (y - RESERVOIR.y) / RESERVOIR.ry) - 1) * RESERVOIR.ry : Math.abs(y - riverY(x)) - RIVER.halfWidth;
  if (dr < 6) out.lerp(SAND, (1 - smooth(1, 6, dr)) * 0.7);
  if (dr < 0) out.lerp(Math.abs(x - FORD.x) < FORD.w / 2 ? SAND : RIVERBED, smooth(0, -3, dr) * 0.8);
  // Vía del tren: balasto
  if (x < RAILWAY.x1 && Math.abs(y - RAILWAY.y) < 3) out.lerp(BALLAST, 1 - smooth(1.6, 3, Math.abs(y - RAILWAY.y)));
  // Caminos de tierra con borde irregular y carreteras de asfalto
  const wobble = (noise(x / 3, y / 3) - 0.5) * 1.2;
  if (near.paths.length) out.lerp(PATH, (1 - smooth(1.1, 2.6, distanceToSegments(x, y, near.paths) + wobble)) * 0.9);
  if (near.roads.length) out.lerp(ASPHALT, (1 - smooth(3.2, 4.2, distanceToSegments(x, y, near.roads) + wobble * 0.3)) * 0.95);

  // Fuera del área jugable: más oscuro
  const outside = smooth(0, 4, Math.max(Math.abs(x), Math.abs(y)) - MAP_HALF);
  out.multiplyScalar(1 - outside * 0.35);
  return out;
}

const distanceToSegments = (x, y, segments) => distanceToPaths(x, y, segments);

// Baldosa (ix, iy) con celdas de `cell` m; se extiende un poco para tapar las uniones
function buildTile(ix, iy, cell) {
  const cx = -MAP_HALF + (ix + 0.5) * TILE;
  const cy = -MAP_HALF + (iy + 0.5) * TILE;
  const extra = cell === FINE ? 1 : 0;
  const size = TILE + extra * 2;
  const geometry = new THREE.PlaneGeometry(size, size, Math.round(size / cell), Math.round(size / cell)).toNonIndexed();
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(cx, 0, -cy);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), -pos.getZ(i)) - (cell === COARSE ? 0.12 : 0));
  const half = TILE / 2 + 6;
  const near = {
    paths: linesNear(PATHS, cx - half, cy - half, cx + half, cy + half, 4),
    roads: linesNear(ROADS, cx - half, cy - half, cx + half, cy + half, 6),
  };
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const y = -(pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const h = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    groundColor(x, y, h, near, color);
    for (let k = 0; k < 3; k++) color.toArray(colors, (i + k) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return { geometry, x: cx, y: cy };
}

const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

export default function MapMesh() {
  const group = useRef(null);
  // Baldosas gruesas: siempre existen (se ocultan donde hay una fina o si quedan muy lejos)
  const coarse = useMemo(() => {
    const out = new Map();
    for (let ix = -RING; ix < TILES + RING; ix++) {
      for (let iy = -RING; iy < TILES + RING; iy++) {
        const tile = buildTile(ix, iy, COARSE);
        const mesh = new THREE.Mesh(tile.geometry, material);
        mesh.receiveShadow = true;
        out.set(`${ix},${iy}`, { ...tile, ix, iy, mesh, fine: null });
      }
    }
    return out;
  }, []);
  const state = useRef({ at: 0 });

  useEffect(() => {
    const g = group.current;
    for (const t of coarse.values()) g.add(t.mesh);
    return () => {
      for (const t of coarse.values()) {
        g.remove(t.mesh);
        t.mesh.geometry.dispose();
        if (t.fine) t.fine.geometry.dispose();
      }
    };
  }, [coarse]);

  useFrame(({ camera }) => {
    const now = performance.now();
    if (now - state.current.at < 120) return;
    state.current.at = now;
    const camX = camera.position.x;
    const camY = -camera.position.z;
    const low = camera.position.y < 70;
    let wanted = null;
    let wantedDist = Infinity;
    for (const t of coarse.values()) {
      const d = Math.hypot(t.x - camX, t.y - camY);
      const fineHere = low && d < FINE_REACH + TILE / 2;
      if (t.fine && (d > FINE_DROP || !low)) {
        group.current.remove(t.fine);
        t.fine.geometry.dispose();
        t.fine = null;
      }
      if (fineHere && !t.fine && d < wantedDist) {
        wanted = t;
        wantedDist = d;
      }
      t.mesh.visible = !t.fine && d < 320 + Math.max(0, camera.position.y) * 3;
      if (t.fine) t.fine.visible = d < FINE_REACH + TILE;
    }
    // Una baldosa fina por vez (la más cercana que falte)
    if (wanted) {
      const tile = buildTile(wanted.ix, wanted.iy, FINE);
      wanted.fine = new THREE.Mesh(tile.geometry, material);
      wanted.fine.receiveShadow = true;
      group.current.add(wanted.fine);
      wanted.mesh.visible = false;
    }
  });

  return <group ref={group} />;
}
