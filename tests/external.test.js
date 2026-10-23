// Skins externas (npm test): registro, validación, normalización, alias de huesos (Mixamo),
// animación relativa al reposo, caché con referencias y fallback. Sin red: cargador falso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { canUseSkin, EXTERNAL_SKIN_IDS } from '@calculo-royale/shared/skins';
import { findAnimationBySemantic } from '../client/src/game/character/animation/clips.js';
import { Character } from '../client/src/game/character/Character.js';
import { mapBones, isRigCompatible } from '../client/src/game/character/external/bones.js';
import { normalizeExternalSkin } from '../client/src/game/character/external/normalize.js';
import { acquireSkin, cacheInfo, limitWarnings, releaseSkin, setLoaderDeps } from '../client/src/game/character/loaders/skinLoader.js';
import { externalSkins, getSkinEntry } from '../client/src/game/character/skins/index.js';

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

test('5 espacios genéricos, legendarios, en su carpeta; el servidor los valida como al resto', () => {
  const externals = externalSkins();
  assert.deepEqual(externals.map((e) => e.id), ['externa_01', 'externa_02', 'externa_03', 'externa_04', 'externa_05']);
  assert.deepEqual(EXTERNAL_SKIN_IDS, externals.map((e) => e.id));
  for (const [i, e] of externals.entries()) {
    assert.equal(e.name, `Skin externa ${i + 1}`);
    assert.equal(e.rarity, 'legendario');
    assert.equal(e.source, `/assets/skins/external/${e.id}/character.glb`);
    assert.equal(canUseSkin(e.id), true);
  }
  assert.equal(canUseSkin('externa_06'), false);
  assert.equal(getSkinEntry('no-existe').id, 'fallback');
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

test('modo C: las animaciones del Master Rig mueven los huesos del modelo igual que los del rig', async () => {
  setLoaderDeps(fakeLoader(mixamoModel()));
  const ch = new Character({ skin: 'externa_01', color: '#f00' });
  assert.equal(ch.status, 'loading');
  assert.ok(ch.procedural, 'mientras carga se ve el soldado gris');
  await until(() => ch.status !== 'loading');
  assert.equal(ch.status, 'ready');
  assert.equal(ch.external.mode, 'C');
  assert.equal(ch.procedural, null);
  const ext = ch.external.mapping;
  const rig = ch.rig.bones;
  // Apuntando, con la mira girada respecto a las piernas, y caminando
  for (let i = 0; i < 30; i++) ch.update({ x: i * 0.2, y: 0, aim: 0.8, dead: false, aiming: true, shotAgo: 1e9, weapon: 2, seat: null }, i * 50, 0.05);
  ch.visualRoot.updateMatrixWorld(true);
  for (const [a, b] of [['upperArmR', 'lowerArmR'], ['lowerArmR', 'handR'], ['upperArmL', 'lowerArmL'], ['lowerArmL', 'handL']]) {
    const angle = worldDir(rig[a], rig[b]).angleTo(worldDir(ext[a], ext[b]));
    assert.ok(angle < 1e-3, `${a}: ${angle}`);
  }
  // Piernas: misma dirección que las del rig (zancada)
  const legRig = new THREE.Vector3(0, -1, 0).applyQuaternion(rig.upperLegL.getWorldQuaternion(new THREE.Quaternion()));
  const legExt = worldDir(ext.upperLegL, ext.lowerLegL);
  assert.ok(legRig.angleTo(legExt) < 1e-3);
  // El arma sigue en el socket del rig, llevado a la mano del modelo
  const socket = ch.rig.sockets.WeaponSocket_R.getWorldPosition(new THREE.Vector3());
  assert.ok(socket.distanceTo(ext.handR.getWorldPosition(new THREE.Vector3())) < 1e-6);
  ch.dispose();
});

test('caché con conteo de referencias: una descarga; se libera solo cuando nadie lo usa', async () => {
  const calls = { fetch: 0 };
  const scene = mixamoModel();
  let disposed = 0;
  scene.traverse((o) => o.isMesh && (o.geometry.dispose = () => disposed++));
  setLoaderDeps(fakeLoader(scene, calls));
  const entry = getSkinEntry('externa_02');
  await Promise.all([acquireSkin(entry), acquireSkin(entry)]);
  assert.equal(calls.fetch, 1);
  assert.equal(cacheInfo().find((c) => c.source === entry.source).refs, 2);
  releaseSkin(entry.source);
  assert.equal(disposed, 0, 'otro jugador lo sigue usando');
  releaseSkin(entry.source);
  assert.equal(disposed, 1);
  assert.equal(cacheInfo().some((c) => c.source === entry.source), false);
});

test('fallback: si falta el archivo (404 o index.html) queda el soldado gris y se avisa', async () => {
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    setLoaderDeps({ fetch: async () => ({ ok: false, status: 404 }) });
    const ch = new Character({ skin: 'externa_03', color: '#0f0' });
    await until(() => ch.status !== 'loading');
    assert.equal(ch.status, 'fallback');
    assert.ok(ch.procedural?.meshes.torso, 'sigue el soldado gris');
    assert.ok(warnings.some((w) => w.startsWith('Skin asset missing: externa_03')));
    // index.html en lugar del GLB (servidor de desarrollo o rewrite)
    setLoaderDeps({ fetch: async () => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('<!doctype html>').buffer }) });
    const ch2 = new Character({ skin: 'externa_04', color: '#0f0' });
    await until(() => ch2.status !== 'loading');
    assert.equal(ch2.status, 'fallback');
    // Cambio de skin en caliente a una procedural
    ch2.setSkin('ninja');
    assert.equal(ch2.status, 'ready');
  } finally {
    console.warn = warn;
  }
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
