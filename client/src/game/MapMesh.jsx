import { useMemo } from 'react';
import * as THREE from 'three';
import { CONTOUR_STEP, GRID_STEP, MAP_HALF, MAP_SIZE, TERRAIN } from '@calculo-royale/shared/constants';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { textTexture } from './labels.js';

// Convención: el plano matemático (x, y) se dibuja en Three.js como (x, altura, −y),
// así y crece hacia arriba en la pantalla igual que en el tablero.

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Pizarra: piso verde oscuro, cuadrícula de tiza, curvas de nivel y ejes x (rojo) e y (azul).
// La altura y la normal se calculan exactas por píxel con f(x, y) y su gradiente,
// así las curvas de nivel salen suaves aunque la malla sea de triángulos.
const fragmentShader = /* glsl */ `
  uniform float uAmp;
  uniform float uScale;
  uniform float uGrid;
  uniform float uContour;
  uniform float uHalf;
  varying vec3 vWorld;

  // 1 sobre líneas en múltiplos de 'spacing' con medio ancho 'w', suavizado de 1 píxel
  float lines(float v, float spacing, float w) {
    float d = abs(fract(v / spacing + 0.5) - 0.5) * spacing;
    float aa = fwidth(v);
    return 1.0 - smoothstep(w, w + aa, d);
  }

  float axis(float v, float w) {
    return 1.0 - smoothstep(w, w + fwidth(v), abs(v));
  }

  void main() {
    float x = vWorld.x;
    float y = -vWorld.z;
    float sx = sin(x / uScale), cx = cos(x / uScale);
    float sy = sin(y / uScale), cy = cos(y / uScale);
    float h = uAmp * sx * cy;
    float fx = uAmp / uScale * cx * cy;
    float fy = -uAmp / uScale * sx * sy;
    vec3 normal = normalize(vec3(-fx, 1.0, fy));

    float t = clamp((h + uAmp) / (2.0 * uAmp), 0.0, 1.0);
    vec3 color = mix(vec3(0.07, 0.18, 0.16), vec3(0.19, 0.38, 0.31), t);
    vec3 light = normalize(vec3(0.4, 1.0, 0.3));
    color *= 0.6 + 0.5 * max(dot(normal, light), 0.0);

    color = mix(color, vec3(0.98, 0.88, 0.50), 0.25 * lines(h, uContour, 0.0));
    float grid = max(lines(x, uGrid, 0.04), lines(y, uGrid, 0.04));
    color = mix(color, vec3(0.92, 0.95, 0.93), 0.4 * grid);
    color = mix(color, vec3(0.98, 0.45, 0.45), axis(y, 0.12));
    color = mix(color, vec3(0.45, 0.70, 1.00), axis(x, 0.12));

    float edge = uHalf - max(abs(x), abs(y));
    color = mix(color, vec3(0.95), 1.0 - smoothstep(0.25, 0.25 + fwidth(edge), edge));

    gl_FragColor = vec4(color, 1.0);
  }
`;

function buildTerrain() {
  const segments = MAP_SIZE;
  const geometry = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), -pos.getZ(i)));
  }
  return geometry;
}

// Números de los ejes, como carteles que siempre miran a la cámara
function axisLabels() {
  const labels = [];
  for (let k = -MAP_HALF + GRID_STEP; k < MAP_HALF; k += GRID_STEP) {
    if (k === 0) continue;
    labels.push({ text: String(k), x: k, y: -1.4, color: '#fecaca' });
    labels.push({ text: String(k), x: -1.6, y: k, color: '#bfdbfe' });
  }
  labels.push({ text: 'x', x: MAP_HALF - 2, y: 1.6, color: '#f87171', size: 64 });
  labels.push({ text: 'y', x: 1.6, y: MAP_HALF - 2, color: '#60a5fa', size: 64 });
  labels.push({ text: '0', x: -1.2, y: -1.2, color: '#e2e8f0' });
  return labels.map((l) => ({ ...l, ...textTexture(l.text, { color: l.color, size: l.size ?? 48 }) }));
}

export default function MapMesh() {
  const geometry = useMemo(buildTerrain, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uAmp: { value: TERRAIN.amplitude },
          uScale: { value: TERRAIN.scale },
          uGrid: { value: GRID_STEP },
          uContour: { value: CONTOUR_STEP },
          uHalf: { value: MAP_HALF },
        },
      }),
    [],
  );
  const labels = useMemo(axisLabels, []);

  return (
    <group>
      <mesh geometry={geometry} material={material} />
      {labels.map((l) => (
        <sprite
          key={`${l.text}-${l.x}-${l.y}`}
          position={[l.x, terrainHeight(l.x, l.y) + 0.5, -l.y]}
          scale={[l.aspect * 0.9, 0.9, 1]}
        >
          <spriteMaterial map={l.texture} depthWrite={false} transparent />
        </sprite>
      ))}
    </group>
  );
}
