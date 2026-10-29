// Skins externas (npm test): registro, validación, normalización, alias de huesos (Mixamo),
// animación relativa al reposo, caché con referencias y fallback. Sin red: cargador falso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { canUseSkin, EXTERNAL_SKIN_IDS, externalName } from '@calculo-royale/shared/skins';
import { findAnimationBySemantic } from '../client/src/game/character/animation/clips.js';
import { Character } from '../client/src/game/character/Character.js';
import { mapBones, isRigCompatible } from '../client/src/game/character/external/bones.js';
import { normalizeExternalSkin } from '../client/src/game/character/external/normalize.js';
import { acquireSkin, cacheInfo, limitWarnings, releaseSkin, setLoaderDeps } from '../client/src/game/character/loaders/skinLoader.js';
import { getSkinEntry, listSkins, rarityColor, skinInitials } from '../client/src/game/character/skins/index.js';
import { EXTERNAL_OVERRIDES, registerExternalSkin, registerFromManifest } from '../client/src/game/character/skins/registry.js';
import MANIFEST from '../client/src/game/character/skins/external-manifest.json' with { type: 'json' };
import { buildManifest } from '../scripts/skins-manifest.js';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const glbBytes = () => {
  const buffer = new ArrayBuffer(16);
  new Uint8Array(buffer).set([...'glTF'].map((c) => c.charCodeAt(0)));
  return buffer;
};

// Esqueleto tipo Mixamo: en centímetros (escala 0,01), mirando a +Z, en T; brazos con
// rotaciones locales arbitrarias para que el reposo no sea la identidad
function mixamoModel() {
  const armature = new THREE.Group();
  armature.name = 'Armature';
  armature.scale.setScalar(0.01);
  const bone = (name, parent, pos, rot = [0, 0, 0]) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(...pos);
    b.rotation.set(...rot);
    parent.add(b);
    return b;
  };
  const hips = bone('mixamorigHips', armature, [0, 100, 0]);
  const spine = bone('mixamorigSpine', hips, [0, 10, 0]);
  const spine1 = bone('mixamorigSpine1', spine, [0, 12, 0]);
  const spine2 = bone('mixamorigSpine2', spine1, [0, 12, 0]);
  const neck = bone('mixamorigNeck', spine2, [0, 15, 0]);
  bone('mixamorigHead', neck, [0, 10, 0]);
  for (const [side, sx] of [['Left', 1], ['Right', -1]]) {
    const shoulder = bone(`mixamorig${side}Shoulder`, spine2, [sx * 6, 10, 0], [0, 0, sx * -0.3]);
    const arm = bone(`mixamorig${side}Arm`, shoulder, [sx * 10, 0, 0], [0.4, 0.2, 0]);
    // Antebrazo y mano a lo largo del brazo, en el espacio local girado
    const local = new THREE.Vector3(sx * 25, 0, 0).applyQuaternion(arm.quaternion.clone().invert());
    const fore = bone(`mixamorig${side}ForeArm`, arm, local.toArray());
    bone(`mixamorig${side}Hand`, fore, [sx * 25, 0, 0]);
    const up = bone(`mixamorig${side}UpLeg`, hips, [sx * 9, -5, 0]);
    const leg = bone(`mixamorig${side}Leg`, up, [0, -42, 0]);
    bone(`mixamorig${side}Foot`, leg, [0, -40, 0]);
  }
  // Cuerpo de 180 cm para medir la altura
  const body = new THREE.Mesh(new THREE.BoxGeometry(40, 180, 20).translate(0, 90, 0), new THREE.MeshBasicMaterial());
  armature.add(body);
  return armature;
}

const fakeLoader = (scene, calls = { fetch: 0 }) => ({
  fetch: async () => {
    calls.fetch++;
    return { ok: true, status: 200, arrayBuffer: async () => glbBytes() };
  },
  parse: async () => ({ scene, animations: [] }),
});

const until = async (check) => {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
};

const worldDir = (a, b) => b.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3())).normalize();

// Skins de prueba (no dependen de las carpetas reales)
for (const n of [1, 2, 3, 4, 5]) registerExternalSkin({ id: `prueba_${n}`, source: `/assets/skins/external/prueba_${n}/character.glb` });

test('registro único: externas = carpetas reales del manifiesto, sin espacios vacíos; el servidor las valida', () => {
  const real = MANIFEST.map((m) => m.id);
  assert.deepEqual(EXTERNAL_SKIN_IDS, real);
  for (const id of real) {
    const e = getSkinEntry(id);
    assert.equal(e.type, 'external');
    assert.equal(e.rarity, 'legendario');
    assert.equal(e.collection, 'Personajes especiales');
    assert.equal(e.source, MANIFEST.find((m) => m.id === id).source);
    assert.equal(canUseSkin(id), true);
  }
  assert.equal(listSkins().some((s) => /^externa_0/.test(s.id)), false);
  assert.equal(canUseSkin('prueba_1'), false);
  assert.equal(canUseSkin('prueba_1'), false, 'el servidor solo conoce las carpetas reales');
  assert.equal(getSkinEntry('no-existe').id, 'soldado', 'respaldo: la procedural base');
});

test('registro: sin línea propia el nombre es el id con mayúscula; con línea, la línea manda', () => {
  registerFromManifest([{ id: 'zorro', source: '/assets/skins/external/zorro/zorro.glb', portrait: false }]);
  const e = getSkinEntry('zorro');
  assert.equal(e.name, 'Zorro');
  assert.equal(e.portrait, null);
  assert.equal(e.scale, 1);
  assert.equal(externalName('luffy'), 'Luffy');
  if (EXTERNAL_OVERRIDES['2b'] && MANIFEST.some((m) => m.id === '2b')) assert.equal(getSkinEntry('2b').name, EXTERNAL_OVERRIDES['2b'].name);
});

test('manifiesto: character.glb, o el único .glb de la carpeta; carpetas vacías o ambiguas fuera', () => {
  const root = mkdtempSync(join(tmpdir(), 'skins-'));
  const dir = join(root, 'external');
  const portraits = join(root, 'portraits');
  mkdirSync(portraits, { recursive: true });
  for (const [id, files] of Object.entries({ a: ['character.glb', 'otro.glb'], b: ['b.glb', 'tex.png'], c: [], d: ['uno.glb', 'dos.glb'] })) {
    mkdirSync(join(dir, id), { recursive: true });
    for (const file of files) writeFileSync(join(dir, id, file), '');
  }
  writeFileSync(join(portraits, 'b.png'), '');
  assert.deepEqual(buildManifest(dir, portraits), [
    { id: 'a', source: '/assets/skins/external/a/character.glb', portrait: false },
    { id: 'b', source: '/assets/skins/external/b/b.glb', portrait: true },
  ]);
  assert.deepEqual(buildManifest(join(root, 'no-existe'), portraits), []);
  rmSync(root, { recursive: true, force: true });
});

test('iniciales y color de rareza para las tarjetas sin retrato', () => {
  assert.equal(skinInitials('Isaac Newton'), 'IN');
  assert.equal(skinInitials('2B'), '2B');
  assert.equal(skinInitials('Furina'), 'FU');
  assert.equal(skinInitials('Comando Culona'), 'CC');
  assert.equal(rarityColor('legendario'), '#eab308');
  assert.equal(rarityColor('nada'), '#9ca3af');
});

test('normalización: 1,8 m, pies en el suelo, centrado y orientado a +X', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 0.5).translate(3, 7, -2), new THREE.MeshBasicMaterial());
  const { holder } = normalizeExternalSkin(mesh, {});
  const box = new THREE.Box3().setFromObject(holder);
  assert.ok(Math.abs(box.max.y - box.min.y - 1.8) < 1e-6);
  assert.ok(Math.abs(box.min.y) < 1e-6);
  assert.ok(Math.abs(box.max.x + box.min.x) < 1e-6 && Math.abs(box.max.z + box.min.z) < 1e-6);
  // El ancho (eje X del archivo) queda sobre Z del rig: mira a +X
  assert.ok(box.max.z - box.min.z > box.max.x - box.min.x);
  const scaled = normalizeExternalSkin(new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshBasicMaterial()), { scale: 1.2, offset: [0, 0.5, 0] });
  const b2 = new THREE.Box3().setFromObject(scaled.holder);
  assert.ok(Math.abs(b2.max.y - b2.min.y - 2.16) < 1e-6 && Math.abs(b2.min.y - 0.5) < 1e-6);
});

test('alias: reconoce Mixamo y nombres comunes', () => {
  const mapping = mapBones(mixamoModel());
  assert.ok(isRigCompatible(mapping));
  assert.equal(mapping.chest.name, 'mixamorigSpine1');
  assert.equal(mapping.upperLegL.name, 'mixamorigLeftUpLeg');
  const generic = new THREE.Group();
  for (const name of ['Hips', 'Spine', 'LeftArm', 'Armature|RightForeArm', 'mixamorig1_LeftHand']) {
    const b = new THREE.Bone();
    b.name = name;
    generic.add(b);
  }
  const m = mapBones(generic);
  assert.equal(m.lowerArmR?.name, 'Armature|RightForeArm');
  assert.equal(m.handL?.name, 'mixamorig1_LeftHand');
  assert.equal(isRigCompatible(m), false, 'faltan huesos: no es modo C');
});

test('6.5: toda skin externa va tiesa (sin huesos ni clips) y el arma se ve en la mano del rig', async () => {
  setLoaderDeps(fakeLoader(mixamoModel()));
  const ch = new Character({ skin: 'prueba_1', color: '#f00' });
  assert.equal(ch.status, 'loading');
  assert.ok(!ch.procedural && !ch.visualRoot.visible, '7A: mientras carga no se ve el soldado de reemplazo');
  await until(() => ch.status !== 'loading');
  assert.equal(ch.status, 'ready');
  assert.ok(ch.visualRoot.visible);
  assert.equal(ch.external.mode, 'A', 'aunque el esqueleto sea compatible');
  assert.equal(ch.external.mixer, null);
  const ext = ch.external.mapping;
  const before = ext.upperArmR.quaternion.clone();
  ch.setWeapon(7);
  for (let i = 0; i < 30; i++) ch.update({ x: i * 0.2, y: 0, aim: 0.8, dead: false, aiming: true, shotAgo: 1e9, weapon: 7, seat: null }, i * 50, 0.05);
  assert.ok(ext.upperArmR.quaternion.equals(before), 'los huesos del modelo no se mueven');
  assert.ok(ch.weapons[7].visible && ch.rig.sockets.WeaponSocket_R.visible, 'el AK-47 se ve en la mano');
  ch.dispose();
});

test('caché con conteo de referencias: una descarga; se libera solo cuando nadie lo usa', async () => {
  const calls = { fetch: 0 };
  const scene = mixamoModel();
  let disposed = 0;
  scene.traverse((o) => o.isMesh && (o.geometry.dispose = () => disposed++));
  setLoaderDeps(fakeLoader(scene, calls));
  const entry = getSkinEntry('prueba_2');
  await Promise.all([acquireSkin(entry), acquireSkin(entry)]);
  assert.equal(calls.fetch, 1);
  assert.equal(cacheInfo().find((c) => c.source === entry.source).refs, 2);
  releaseSkin(entry.source);
  assert.equal(disposed, 0, 'otro jugador lo sigue usando');
  releaseSkin(entry.source);
  assert.equal(disposed, 1);
  assert.equal(cacheInfo().some((c) => c.source === entry.source), false);
});

test('fallback: si falta el archivo (404 o index.html) queda el soldado base y se avisa', async () => {
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    setLoaderDeps({ fetch: async () => ({ ok: false, status: 404 }) });
    const ch = new Character({ skin: 'prueba_3', color: '#0f0' });
    await until(() => ch.status !== 'loading');
    assert.equal(ch.status, 'fallback');
    assert.ok(ch.procedural?.meshes.torso, 'sigue el soldado base');
    assert.ok(warnings.some((w) => w.startsWith('Skin asset missing: prueba_3')));
    // index.html en lugar del GLB (servidor de desarrollo o rewrite)
    setLoaderDeps({ fetch: async () => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('<!doctype html>').buffer }) });
    const ch2 = new Character({ skin: 'prueba_4', color: '#0f0' });
    await until(() => ch2.status !== 'loading');
    assert.equal(ch2.status, 'fallback');
    // Cambio de skin en caliente a una procedural
    ch2.setSkin('ninja');
    assert.equal(ch2.status, 'ready');
  } finally {
    console.warn = warn;
  }
});

test('modo A (sin esqueleto): mira hacia donde apunta, se balancea al caminar y usa sus LOD', async () => {
  const model = new THREE.Group();
  ['LOD0', 'LOD1', 'LOD2'].forEach((name, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 0.5 - i * 0.1).translate(0, 1, 0), new THREE.MeshBasicMaterial());
    m.name = name;
    model.add(m);
  });
  setLoaderDeps(fakeLoader(model));
  const ch = new Character({ skin: 'prueba_5', color: '#00f' });
  await until(() => ch.status !== 'loading');
  assert.equal(ch.external.mode, 'A');
  const lods = ['LOD0', 'LOD1', 'LOD2'].map((n) => ch.external.model.getObjectByName(n));
  assert.deepEqual(lods.map((o) => o.visible), [true, false, false]);
  ch.setLod(2);
  assert.deepEqual(lods.map((o) => o.visible), [false, false, true]);
  for (let i = 0; i < 20; i++) ch.update({ x: i * 0.3, y: 0, aim: 1.1, dead: false, shotAgo: 1e9, weapon: 0, seat: null }, i * 50, 0.05);
  assert.ok(Math.abs(ch.external.object.rotation.y - 1.1) < 1e-9, 'mira a la mira');
  assert.ok(ch.external.object.rotation.z < 0, 'se inclina al caminar');
  // En el jeep no camina: sin inclinación ni rebote; victoria: se balancea
  for (let i = 0; i < 10; i++) ch.update({ x: 6, y: 0, aim: 1.1, dead: false, shotAgo: 1e9, weapon: 0, seat: 'driver', seatYaw: 0 }, 1100 + i * 50, 0.05);
  assert.ok(Math.abs(ch.external.object.rotation.z) < 0.02 && Math.abs(ch.external.object.position.y) < 0.01, 'quieto en el jeep');
  ch.update({ x: 6, y: 0, aim: 1.1, dead: false, shotAgo: 1e9, weapon: 0, seat: null, victory: true }, 1700, 0.05);
  ch.update({ x: 6, y: 0, aim: 1.1, dead: false, shotAgo: 1e9, weapon: 0, seat: null, victory: true }, 1800, 0.1);
  assert.notEqual(ch.external.object.rotation.y, 1.1, 'se mueve en la victoria');
  ch.setShadows(false);
  assert.equal(lods[2].castShadow, false);
  ch.dispose();
});

test('clips por significado y avisos de límites para celular', () => {
  const clips = ['mixamo.com|Idle_01', 'Armature|Walking', 'Running', 'Dance'].map((name) => new THREE.AnimationClip(name, 1, []));
  assert.equal(findAnimationBySemantic(clips, 'idle').name, 'mixamo.com|Idle_01');
  assert.equal(findAnimationBySemantic(clips, 'run').name, 'Running');
  assert.equal(findAnimationBySemantic(clips, 'victory').name, 'Dance');
  assert.equal(findAnimationBySemantic(clips, 'aim').name, 'mixamo.com|Idle_01', 'sin clip de apuntar: idle');
  assert.equal(findAnimationBySemantic([], 'walk'), null);
  assert.equal(limitWarnings({ bytes: 1e6, triangles: 9000, maxTexture: 1024 }).length, 0);
  assert.equal(limitWarnings({ bytes: 4e6, triangles: 20000, maxTexture: 2048 }).length, 3);
});
