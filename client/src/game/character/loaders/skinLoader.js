import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ExternalSkin } from '../external/ExternalSkin.js';
import { getSkinEntry } from '../skins/index.js';

// Carga de skins externas (GLB). Este módulo se carga con import() dinámico: no pesa en la
// carga inicial. Cada archivo se descarga una vez (caché por ruta); cada jugador recibe un
// clon que comparte geometrías, materiales y texturas. Con conteo de referencias: lo que usa
// otro jugador nunca se libera.

// Draco apagado por defecto. Para activarlo, copiar node_modules/three/examples/jsm/libs/draco/
// a client/public/draco/ y poner true.
export const USE_DRACO = false;

// Avisos para celular
export const LIMITS = { bytes: 3 * 1024 * 1024, triangles: 15_000, texture: 1024 };

const cache = new Map(); // ruta → { promise, asset, refs }
let loader = null;

function getLoader() {
  if (loader) return loader;
  loader = new GLTFLoader();
  if (USE_DRACO) loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));
  return loader;
}

// Dependencias reemplazables en las pruebas
const deps = {
  fetch: (url, options) => globalThis.fetch(url, options),
  parse: (buffer, path) => getLoader().parseAsync(buffer, path),
};
export function setLoaderDeps(next) {
  Object.assign(deps, next);
}

const isGlb = (buffer) => buffer.byteLength >= 4 && new TextDecoder().decode(new Uint8Array(buffer, 0, 4)) === 'glTF';

// Triángulos, mallas, materiales y texturas del archivo
export function analyzeScene(scene, bytes = 0, animations = []) {
  const materials = new Set();
  const textures = new Set();
  let triangles = 0;
  let meshes = 0;
  let skinned = false;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    if (o.isSkinnedMesh) skinned = true;
    const g = o.geometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    for (const m of [o.material].flat()) {
      materials.add(m);
      for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
    }
  });
  const sizes = [...textures].map((t) => Math.max(t.image?.width ?? 0, t.image?.height ?? 0));
  return {
    bytes,
    triangles: Math.round(triangles),
    meshes,
    materials: materials.size,
    textures: textures.size,
    maxTexture: Math.max(0, ...sizes),
    skinned,
    animations: animations.map((a) => a.name),
  };
}

export function limitWarnings(stats) {
  const warnings = [];
  if (stats.bytes > LIMITS.bytes) warnings.push(`Pesa ${(stats.bytes / 1048576).toFixed(1)} MB (máximo recomendado 3 MB)`);
  if (stats.triangles > LIMITS.triangles) warnings.push(`${stats.triangles} triángulos (máximo recomendado 15 000)`);
  if (stats.maxTexture > LIMITS.texture) warnings.push(`Texturas de ${stats.maxTexture} px (máximo recomendado 1024)`);
  return warnings;
}

// Texturas de color en sRGB y anisotropía moderada; el resto de los materiales, tal cual
function prepareMaterials(scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) {
      for (const key of ['map', 'emissiveMap']) if (m[key]) m[key].colorSpace = THREE.SRGBColorSpace;
      for (const value of Object.values(m)) if (value?.isTexture) value.anisotropy = Math.max(value.anisotropy, 4);
    }
  });
}

function disposeAsset(asset) {
  asset.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of [o.material].flat()) {
      for (const value of Object.values(m)) if (value?.isTexture) value.dispose();
      m.dispose();
    }
  });
}

async function fetchAsset(entry) {
  const res = await deps.fetch(entry.source);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  // Sin archivo, el servidor de desarrollo (o un rewrite) puede devolver index.html
  if (!isGlb(buffer)) throw new Error('no es un GLB (¿falta el archivo?)');
  const gltf = await deps.parse(buffer, entry.source.replace(/[^/]*$/, ''));
  prepareMaterials(gltf.scene);
  const stats = analyzeScene(gltf.scene, buffer.byteLength, gltf.animations);
  stats.warnings = limitWarnings(stats);
  for (const w of stats.warnings) console.warn(`Skin ${entry.id}: ${w}`);
  return { scene: gltf.scene, animations: gltf.animations ?? [], stats };
}

function record(entry) {
  let rec = cache.get(entry.source);
  if (!rec) {
    rec = { refs: 0, asset: null, promise: null };
    rec.promise = fetchAsset(entry).then((asset) => (rec.asset = asset));
    // Si falla, se puede reintentar más tarde
    rec.promise.catch(() => cache.get(entry.source) === rec && cache.delete(entry.source));
    cache.set(entry.source, rec);
  }
  return rec;
}

export const loadSkinAsset = (entry) => record(entry).promise;

// Toma una referencia al archivo (lo carga si hace falta)
export async function acquireSkin(entry) {
  const rec = record(entry);
  rec.refs++;
  try {
    return await rec.promise;
  } catch (err) {
    rec.refs--;
    throw err;
  }
}

export function releaseSkin(source) {
  const rec = cache.get(source);
  if (!rec) return;
  rec.refs = Math.max(0, rec.refs - 1);
  if (rec.refs === 0 && rec.asset) {
    disposeAsset(rec.asset);
    cache.delete(source);
  }
}

// Clon listo para montar sobre el Master Rig
export async function createSkinInstance(entry) {
  const asset = await acquireSkin(entry);
  try {
    return new ExternalSkin(entry, asset, cloneSkinned(asset.scene));
  } catch (err) {
    releaseSkin(entry.source);
    throw err;
  }
}

export function disposeSkinInstance(instance) {
  instance.object.removeFromParent();
  instance.mixer?.stopAllAction();
  releaseSkin(instance.entry.source);
}

// Al iniciar la partida: descarga las externas que alguien eligió (para que no haya tirones)
export function preloadMatchSkins(skinIds) {
  const entries = [...new Set(skinIds)].map(getSkinEntry).filter((e) => e.type === 'external');
  return Promise.allSettled(
    entries.map((e) =>
      loadSkinAsset(e).catch((err) => {
        console.warn('Skin asset missing:', e.id, err.message);
        throw err;
      }),
    ),
  );
}

// ¿Está el archivo? (la galería muestra "Asset pendiente" si no)
export async function assetStatus(entry) {
  try {
    const res = await deps.fetch(entry.source, { method: 'HEAD' });
    const type = res.headers?.get?.('content-type') ?? '';
    return res.ok && !type.includes('html') ? 'ok' : 'missing';
  } catch {
    return 'missing';
  }
}

export const cacheInfo = () => [...cache.entries()].map(([source, r]) => ({ source, refs: r.refs, loaded: Boolean(r.asset) }));
