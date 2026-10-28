import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HOUSES, OBSTACLES, WALL_HEIGHT } from '@calculo-royale/shared/mapLayout';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { box, cylinder, limb, merge, modelMaterial, piece, shade } from './models/build.js';
import { findOccluders, insideRect } from './occlusion.js';
import { Chunked, ChunkedInstances, nearCamera } from './chunks.js';

// Edificios (casas, bodega, cabaña, hangar, barracas, búnker), contenedores y utilería,
// construidos por código a partir de mapLayout.
// Lo que tapa al jugador desde la cámara se vuelve semitransparente; el techo de la casa
// donde está el jugador se oculta.

const PLASTER = ['#c8b998', '#bfae8c', '#cdbfa2'];
const BASEBOARD = '#7b705b';
const TRIM = '#8a7c63';
const WOOD = '#5d4128';
const ROOF = ['#7c3b2a', '#6e4a33', '#5d5a4a'];
const CONTAINER = ['#8c3b2b', '#2f5a7a', '#3f6b3a', '#a8742c', '#5b5f63'];
// Colores y techo por tipo de edificio (las casas varían entre PLASTER y ROOF)
const TYPE_LOOK = {
  bodega: { plaster: '#a89a7c', roof: '#5d5a4a', shape: 'gable' },
  cabana: { plaster: '#7d5b3b', roof: '#4e3524', shape: 'gable' },
  hangar: { plaster: '#7f8673', roof: '#6c7363', shape: 'arch' },
  barraca: { plaster: '#8a8c6c', roof: '#55603f', shape: 'gable' },
  bunker: { plaster: '#8d8a80', roof: '#77736a', shape: 'flat' },
  hospital: { plaster: '#dcdcd4', roof: '#9a9fa1', shape: 'flat' },
  concreto: { plaster: '#9d9b93', roof: '#7d7b74', shape: 'flat' },
};
const FLOOR_HEIGHT = 3;
const DOOR_WIDTH = 2.2;
const ROOF_PEAK = 1.5;
const ROOF_OVERHANG = 0.35;
const FADED = 0.28;

const footprintHeights = (minX, maxX, minY, maxY) => {
  const hs = [];
  for (const x of [minX, (minX + maxX) / 2, maxX]) for (const y of [minY, (minY + maxY) / 2, maxY]) hs.push(terrainHeight(x, y));
  return { min: Math.min(...hs), max: Math.max(...hs) };
};

// Techo a dos aguas centrado en el origen, cumbrera a lo largo de x (largo) y faldones hacia ±z
function gableRoof(length, depth, color, gable) {
  const x0 = -length / 2;
  const x1 = length / 2;
  const d = depth / 2;
  const p = ROOF_PEAK;
  const tri = (pts) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
    g.computeVertexNormals();
    return g;
  };
  const A = [x0, 0, d];
  const B = [x1, 0, d];
  const C = [x1, p, 0];
  const D = [x0, p, 0];
  const E = [x0, 0, -d];
  const F = [x1, 0, -d];
  return [
    piece(tri([A, B, C, A, C, D]), color),
    piece(tri([F, E, D, F, D, C]), shade(color, -0.12)),
    piece(tri([A, D, E, B, F, C]), gable),
  ];
}

// Techo en arco (hangar): medio cilindro a lo largo de x, centrado en el origen
function archRoof(length, depth, color) {
  const g = new THREE.CylinderGeometry(depth / 2, depth / 2, length, 14, 1, false, -Math.PI / 2, Math.PI);
  g.rotateZ(Math.PI / 2);
  g.scale(1, 0.55, 1);
  return [piece(g, color)];
}

function buildHouse(house, index, walls) {
  const minX = house.x - house.w / 2 - 0.25;
  const maxX = house.x + house.w / 2 + 0.25;
  const minY = house.y - house.h / 2 - 0.25;
  const maxY = house.y + house.h / 2 + 0.25;
  const hs = footprintHeights(minX, maxX, minY, maxY);
  const base = hs.min - 0.3;
  const top = hs.max + WALL_HEIGHT;
  const look = TYPE_LOOK[house.type] ?? { plaster: PLASTER[index % PLASTER.length], roof: ROOF[index % ROOF.length], shape: 'gable' };
  const plaster = look.plaster;
  const doorWidth = house.doorWidth ?? DOOR_WIDTH;

  const wallPieces = walls.flatMap((w) => {
    const height = top - base;
    const pos = (y) => [w.x, y, -w.y];
    return [
      piece(box(w.w, height, w.h), plaster, { position: pos(base + height / 2) }),
      piece(box(w.w + 0.08, 0.5, w.h + 0.08), BASEBOARD, { position: pos(hs.max + 0.05) }),
      piece(box(w.w + 0.06, 0.16, w.h + 0.06), TRIM, { position: pos(top - 0.08) }),
    ];
  });
  // Dintel sobre la puerta
  const door = {
    n: [house.x, house.y + house.h / 2, doorWidth, 0.5],
    s: [house.x, house.y - house.h / 2, doorWidth, 0.5],
    e: [house.x + house.w / 2, house.y, 0.5, doorWidth],
    w: [house.x - house.w / 2, house.y, 0.5, doorWidth],
  }[house.door];
  wallPieces.push(piece(box(door[2] + 0.1, 0.55, door[3] + 0.1), WOOD, { position: [door[0], top - 0.28, -door[1]] }));

  const alongX = house.w >= house.h;
  const length = (alongX ? house.w : house.h) + ROOF_OVERHANG * 2 + 0.5;
  const depth = (alongX ? house.h : house.w) + ROOF_OVERHANG * 2 + 0.5;
  const shapes = {
    gable: () => gableRoof(length, depth, look.roof, plaster),
    arch: () => archRoof(length, depth, look.roof),
    flat: () => [piece(box(length, 0.35, depth), look.roof, { position: [0, 0.17, 0] })],
  };
  // Pisos de arriba (solo por fuera: el interior es la planta baja). Van con el techo, así que se
  // ocultan con él al entrar.
  const upper = ((house.floors ?? 1) - 1) * FLOOR_HEIGHT;
  const roof = shapes[look.shape]().map((g) => {
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(alongX ? 0 : Math.PI / 2));
    g.translate(house.x, top + upper, -house.y);
    return g;
  });
  for (let k = 0; k < upper / FLOOR_HEIGHT; k++) {
    const y = top + k * FLOOR_HEIGHT;
    roof.push(piece(box(house.w + 0.5, FLOOR_HEIGHT, house.h + 0.5), plaster, { position: [house.x, y + FLOOR_HEIGHT / 2, -house.y] }));
    // Franja de ventanas y cornisa de cada piso
    roof.push(piece(box(house.w + 0.56, 0.9, house.h + 0.56), '#3d4a52', { position: [house.x, y + 1.6, -house.y] }));
    roof.push(piece(box(house.w + 0.62, 0.16, house.h + 0.62), TRIM, { position: [house.x, y + 0.08, -house.y] }));
  }

  return {
    id: `house-${index}`,
    walls: merge(wallPieces),
    roof: merge(roof),
    bounds: { minX, maxX, minY, maxY, height: top - hs.min + ROOF_PEAK + upper },
  };
}

function buildContainer(o, index) {
  const vertical = o.h > o.w;
  const long = vertical ? o.h : o.w;
  const short = vertical ? o.w : o.h;
  const hs = footprintHeights(o.x - o.w / 2, o.x + o.w / 2, o.y - o.h / 2, o.y + o.h / 2);
  const base = hs.min - 0.1;
  const height = o.height + (hs.max - hs.min);
  const color = CONTAINER[index % CONTAINER.length];
  const dark = shade(color, -0.25);

  // Se construye a lo largo de x y luego se rota si es vertical
  const pieces = [piece(box(long, height, short), color, { position: [0, height / 2, 0] })];
  const ribs = Math.floor(long / 0.45);
  for (let i = 1; i < ribs; i++) {
    const x = -long / 2 + i * (long / ribs);
    for (const z of [short / 2 + 0.02, -short / 2 - 0.02]) {
      pieces.push(piece(box(0.12, height * 0.9, 0.05), dark, { position: [x, height / 2, z] }));
    }
  }
  for (const y of [0.06, height - 0.06]) pieces.push(piece(box(long + 0.04, 0.12, short + 0.04), dark, { position: [0, y, 0] }));
  if (o.height > 3) pieces.push(piece(box(long + 0.04, 0.1, short + 0.04), dark, { position: [0, height / 2, 0] }));
  // Puertas en un extremo
  for (const z of [-short / 4, short / 4]) {
    pieces.push(piece(box(0.05, height * 0.92, short / 2 - 0.06), dark, { position: [long / 2 + 0.03, height / 2, z] }));
    pieces.push(piece(box(0.06, height * 0.85, 0.05), '#2b2b2b', { position: [long / 2 + 0.07, height / 2, z] }));
  }

  const g = merge(pieces);
  g.applyMatrix4(new THREE.Matrix4().makeRotationY(vertical ? Math.PI / 2 : 0));
  g.translate(o.x, base, -o.y);
  return {
    id: `container-${index}`,
    geometry: g,
    bounds: { minX: o.x - o.w / 2, maxX: o.x + o.w / 2, minY: o.y - o.h / 2, maxY: o.y + o.h / 2, height: o.height },
  };
}

// Utilería con instancing: un modelo de tamaño 1 escalado por instancia
const crateModel = () =>
  merge([
    piece(box(1, 1, 1), '#8a6a3d', { position: [0, 0.5, 0] }),
    ...[-0.5, 0.5].flatMap((s) => [
      piece(box(1.02, 0.12, 0.04), '#5f4626', { position: [0, 0.5, s * 1.01] }),
      piece(box(0.12, 1.02, 0.04), '#5f4626', { position: [0, 0.5, s * 1.01] }),
      piece(box(0.04, 0.12, 1.02), '#5f4626', { position: [s * 1.01, 0.5, 0] }),
      piece(box(0.04, 1.02, 0.12), '#5f4626', { position: [s * 1.01, 0.5, 0] }),
    ]),
  ]);
const barrelModel = () =>
  merge([
    piece(cylinder(1, 1, 1, 12), '#4a5a32', { position: [0, 0.5, 0] }),
    piece(cylinder(1.04, 1.04, 0.07, 12), '#353f24', { position: [0, 0.3, 0] }),
    piece(cylinder(1.04, 1.04, 0.07, 12), '#353f24', { position: [0, 0.7, 0] }),
    piece(cylinder(0.9, 0.9, 0.02, 12), '#3a4428', { position: [0, 1.0, 0] }),
  ]);
const rockModel = () => {
  const g = new THREE.DodecahedronGeometry(1, 0); // ya viene sin índices
  const colors = new Float32Array(g.attributes.position.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < colors.length / 9; i++) {
    c.set(['#8a8a80', '#7a7a70', '#96968b', '#84837a'][i % 4]);
    for (let k = 0; k < 3; k++) c.toArray(colors, (i * 3 + k) * 3);
  }
  g.deleteAttribute('uv');
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
};
// Cercas: postes y dos rieles a lo largo del lado largo
function fenceGeometry(fences) {
  return merge(
    fences.flatMap((o) => {
      const alongX = o.w >= o.h;
      const len = alongX ? o.w : o.h;
      const pieces = [];
      const posts = Math.max(2, Math.round(len / 1.6) + 1);
      const point = (t, lift) => {
        const x = alongX ? o.x - len / 2 + t * len : o.x;
        const y = alongX ? o.y : o.y - len / 2 + t * len;
        return [x, terrainHeight(x, y) + lift, -y];
      };
      for (let i = 0; i < posts; i++) {
        const [x, h, z] = point(i / (posts - 1), 0);
        pieces.push(piece(box(0.12, 1.2, 0.12), '#5a4630', { position: [x, h + 0.5, z] }));
      }
      for (const lift of [0.45, 0.9]) pieces.push(limb(point(0, lift), point(1, lift), 0.07, '#6b5a45'));
      return pieces;
    }),
  );
}

function Props() {
  const crates = useMemo(() => OBSTACLES.filter((o) => o.kind === 'crate'), []);
  const barrels = useMemo(() => OBSTACLES.filter((o) => o.kind === 'barrel'), []);
  const rocks = useMemo(() => OBSTACLES.filter((o) => o.kind === 'rock'), []);
  const fences = useMemo(() => OBSTACLES.filter((o) => o.kind === 'fence'), []);
  const models = useMemo(() => ({ crate: crateModel(), barrel: barrelModel(), rock: rockModel() }), []);

  return (
    <>
      <ChunkedInstances items={crates} geometry={models.crate} place={PLACE.crate} />
      <ChunkedInstances items={barrels} geometry={models.barrel} place={PLACE.barrel} />
      <ChunkedInstances items={rocks} geometry={models.rock} place={PLACE.rock} />
      <Chunked items={fences} render={(list) => <FenceChunk items={list} />} />
    </>
  );
}

const PLACE = {
  crate: (o, m) => {
    m.position.set(o.x, terrainHeight(o.x, o.y) - 0.15, -o.y);
    m.scale.set(o.w, o.height + 0.15, o.h);
    m.rotation.set(0, 0, 0);
  },
  barrel: (o, m) => {
    m.position.set(o.x, terrainHeight(o.x, o.y) - 0.1, -o.y);
    m.scale.set(o.r, o.height + 0.1, o.r);
    m.rotation.set(0, 0, 0);
  },
  rock: (o, m) => {
    m.position.set(o.x, terrainHeight(o.x, o.y) + o.r * 0.3, -o.y);
    m.scale.set(o.r, o.r * 0.8, o.r);
    m.rotation.set(0, o.x * 7.1 + o.y * 3.3, 0);
  },
};

function FenceChunk({ items }) {
  const geometry = useMemo(() => fenceGeometry(items), [items]);
  return <mesh geometry={geometry} material={modelMaterial} receiveShadow />;
}

export default function Buildings({ frameRef, pitchDeg }) {
  const { houses, containers, items } = useMemo(() => {
    const houses = HOUSES.map((h, i) =>
      buildHouse(h, i, OBSTACLES.filter((o) => o.house === i && o.kind === 'wall')),
    );
    const containers = OBSTACLES.filter((o) => o.kind === 'container').map(buildContainer);
    const items = [...houses, ...containers].map((b) => ({ id: b.id, ...b.bounds }));
    return { houses, containers, items };
  }, []);

  // Un material por edificio para poder desvanecerlo por separado
  const materials = useMemo(() => {
    const m = new Map();
    for (const b of [...houses, ...containers]) m.set(b.id, new THREE.MeshLambertMaterial({ vertexColors: true }));
    for (const h of houses) m.set(`${h.id}-roof`, new THREE.MeshLambertMaterial({ vertexColors: true }));
    return m;
  }, [houses, containers]);

  const occluders = useMemo(() => new Set(), []);
  const cam = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
  const groups = useRef(new Map());
  const visibleAt = useRef(0);
  useFrame(({ camera }, delta) => {
    // Mapa de 1 km: solo se dibujan los edificios cercanos a la cámara (cada 250 ms)
    if (performance.now() - visibleAt.current > 250) {
      visibleAt.current = performance.now();
      for (const b of [...houses, ...containers]) {
        const g = groups.current.get(b.id);
        if (g) g.visible = nearCamera(camera, (b.bounds.minX + b.bounds.maxX) / 2, (b.bounds.minY + b.bounds.maxY) / 2, 20);
      }
    }
    const me = frameRef.current.me;
    if (me) {
      // Con la posición real de la cámara (se adelanta hacia la mira): coordenadas del mapa
      cam.x = camera.position.x;
      cam.y = -camera.position.z;
      cam.z = camera.position.y - terrainHeight(me.x, me.y);
      findOccluders(me.x, me.y, items, pitchDeg, occluders, cam);
    }
    else occluders.clear();
    const rate = 1 - Math.exp(-8 * Math.min(delta, 0.1));
    const fade = (material, goal) => {
      material.opacity += (goal - material.opacity) * rate;
      const solid = material.opacity > 0.98;
      if (material.transparent === solid) {
        material.transparent = !solid;
        material.depthWrite = solid;
        material.needsUpdate = true;
      }
    };
    for (const b of [...houses, ...containers]) fade(materials.get(b.id), occluders.has(b.id) ? FADED : 1);
    for (const h of houses) {
      const inside = me && insideRect(me.x, me.y, h.bounds);
      fade(materials.get(`${h.id}-roof`), inside ? 0 : occluders.has(h.id) ? FADED : 1);
    }
  });

  return (
    <group>
      {houses.map((h) => (
        <group key={h.id} ref={(g) => groups.current.set(h.id, g)}>
          <mesh geometry={h.walls} material={materials.get(h.id)} castShadow receiveShadow />
          <mesh geometry={h.roof} material={materials.get(`${h.id}-roof`)} castShadow receiveShadow />
        </group>
      ))}
      {containers.map((c) => (
        <mesh key={c.id} ref={(g) => groups.current.set(c.id, g)} geometry={c.geometry} material={materials.get(c.id)} castShadow receiveShadow />
      ))}
      <Props />
    </group>
  );
}
