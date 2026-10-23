// Master Rig (npm test): huesos, sockets, montaje de las skins procedurales y animación sobre huesos
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Character } from '../client/src/game/character/Character.js';
import { BONES, SOCKETS } from '../client/src/game/character/rig.js';
import { HAND, SHOULDER } from '../client/src/game/models/soldier.js';

const world = (o) => {
  o.updateWorldMatrix(true, false);
  return o.getWorldPosition(new THREE.Vector3());
};
const near = (a, b, msg) => assert.ok(a.distanceTo(b) < 1e-6, `${msg}: ${a.toArray()} vs ${b.toArray()}`);

const baseInput = { x: 0, y: 0, aim: 0, dead: false, reloading: false, aiming: false, shotAgo: 1e9, weapon: 2, seat: null };

test('el rig tiene la jerarquía de huesos y todos los sockets con nombre', () => {
  const ch = new Character({ skin: 'soldado', color: '#ff0000' });
  const names = [];
  ch.rig.root.traverse((o) => names.push(o.name));
  for (const [name] of [...BONES, ...SOCKETS]) assert.ok(names.includes(name), name);
  assert.equal(ch.rig.bones.upperArmR.parent.name, 'Shoulder_R');
  assert.equal(ch.rig.bones.head.parent.name, 'Neck');
  assert.equal(ch.rig.bones.footL.parent.parent.parent.name, 'Hips');
  assert.equal(ch.weapons[0].parent.name, 'WeaponSocket_R');
});

test('en reposo las piezas de la fase 8 quedan exactamente donde estaban', () => {
  const ch = new Character({ skin: 'newton', color: '#ff0000', vest: 2 });
  ch.visualRoot.updateMatrixWorld(true);
  const m = ch.procedural.meshes;
  // Torso en coordenadas del suelo, brazos en el pivote de los hombros, piernas en la cadera
  near(world(m.torso), new THREE.Vector3(0, 0, 0), 'torso');
  near(world(m.armR), new THREE.Vector3(0, SHOULDER, 0), 'brazo derecho');
  near(world(m.armL), new THREE.Vector3(0, SHOULDER, 0), 'brazo izquierdo');
  near(world(m.legR), new THREE.Vector3(0, 0.95, 0.16), 'pierna derecha');
  near(world(ch.weapons[0]), new THREE.Vector3(HAND[0], SHOULDER + HAND[1], HAND[2]), 'arma en la mano');
});

test('las animaciones mueven huesos, nunca las piezas', () => {
  const ch = new Character({ skin: 'soldado', color: '#00ff00' });
  let t = 0;
  for (let i = 0; i < 30; i++) {
    t += 50;
    ch.update({ ...baseInput, x: i * 0.3 }, t, 0.05);
  }
  assert.notEqual(ch.rig.bones.upperLegL.rotation.z, 0, 'la pierna (hueso) se mueve al caminar');
  assert.equal(ch.anim.state, 'walk');
  for (const mesh of Object.values(ch.procedural.meshes)) {
    assert.ok(mesh.quaternion.equals(new THREE.Quaternion()), `${mesh.name} sin rotación propia`);
  }
});

test('apuntar sube el brazo: el arma queda donde la ponía la animación anterior', () => {
  const ch = new Character({ skin: 'soldado', color: '#00ff00' });
  ch.update({ ...baseInput, aim: 0.7, aiming: true }, 0, 0);
  for (let i = 0; i < 40; i++) ch.update({ ...baseInput, aim: 0.7, aiming: true }, i * 50, 0.05);
  ch.visualRoot.updateMatrixWorld(true);
  // Antes: grupo "upper" girado a la mira y "shoulders" con rotation.z = pitch, el arma en HAND
  const old = new THREE.Group();
  const upper = new THREE.Group();
  const shoulders = new THREE.Group();
  const weapon = new THREE.Group();
  old.add(upper);
  upper.add(shoulders);
  shoulders.add(weapon);
  upper.rotation.y = 0.7;
  shoulders.position.y = SHOULDER;
  shoulders.rotation.z = ch.anim.pitch;
  weapon.position.set(...HAND);
  old.updateMatrixWorld(true);
  assert.ok(Math.abs(ch.anim.pitch) < 0.01, 'apuntando, el brazo queda horizontal');
  near(world(ch.weapons[0]), world(weapon), 'arma');
});

test('poses de jeep, victoria y caída', () => {
  const ch = new Character({ skin: 'soldado', color: '#00ff00' });
  ch.update({ ...baseInput, seat: 'driver', seatYaw: 1.2 }, 0, 0.05);
  assert.equal(ch.anim.state, 'drive');
  assert.ok(ch.rig.bones.upperLegR.rotation.z > 1, 'sentado: piernas hacia adelante');
  assert.ok(Math.abs(ch.rig.bones.hips.rotation.y - 1.2) < 1e-6, 'mira al frente del jeep');
  ch.update({ ...baseInput, seat: 'passenger', seatYaw: 0 }, 50, 0.05);
  assert.equal(ch.anim.state, 'passenger');
  ch.update({ ...baseInput, victory: true }, 100, 0.05);
  assert.equal(ch.anim.state, 'victory');
  assert.ok(ch.rig.bones.upperArmR.rotation.z > 0.9, 'victoria: arma en alto');
  ch.update({ ...baseInput, dead: true }, 200, 0.05);
  ch.update({ ...baseInput, dead: true }, 800, 0.05);
  assert.equal(ch.anim.state, 'death');
  assert.ok(ch.rig.root.position.y > 0.2, 'cayó');
});

test('cambiar de skin en caliente conserva rig, arma y chaleco', () => {
  const ch = new Character({ skin: 'soldado', color: '#00ff00', vest: 3 });
  const rig = ch.rig;
  ch.setWeapon(3);
  ch.setSkin('samurai');
  assert.equal(ch.rig, rig);
  assert.equal(ch.weapons[3].visible, true);
  assert.equal(ch.procedural.meshes.torso.parent.name, 'Spine');
  let count = 0;
  ch.rig.root.traverse((o) => o.name?.startsWith('skin:') && count++);
  assert.equal(count, 5, 'sin piezas repetidas de la skin anterior');
});
