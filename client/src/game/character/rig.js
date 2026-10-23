import * as THREE from 'three';
import { ARM_JOINTS, HIP, SHOULDER } from '../models/soldier.js';

// Master Rig: esqueleto común de todos los personajes (Groups con nombre, sin malla).
// Mira hacia +x, y hacia arriba, +z es su derecha, pies en y = 0, altura 1.8.
// En reposo todos los huesos tienen rotación nula: las animaciones escriben rotaciones
// de huesos (nunca de piezas concretas) y las skins se montan sobre ellos.

export const RIG_HEIGHT = 1.8;
const CHEST_Y = SHOULDER - 0.12; // los hombros cuelgan del pecho
const SPINE_Y = HIP + 0.15;
const sub = (a, b) => a.map((v, i) => v - b[i]);

// [nombre, clave, padre, posición relativa al padre]
export const BONES = [
  ['Root', 'root', null, [0, 0, 0]],
  ['Hips', 'hips', 'root', [0, HIP, 0]],
  ['Spine', 'spine', 'hips', [0, SPINE_Y - HIP, 0]],
  ['Chest', 'chest', 'spine', [0, CHEST_Y - SPINE_Y, 0]],
  ['Neck', 'neck', 'chest', [0, 1.66 - CHEST_Y, 0]],
  ['Head', 'head', 'neck', [0, 0.16, 0]],
  ['Shoulder_R', 'shoulderR', 'chest', [0, SHOULDER - CHEST_Y, ARM_JOINTS.shoulderR[2]]],
  ['UpperArm_R', 'upperArmR', 'shoulderR', [0, 0, 0]],
  ['LowerArm_R', 'lowerArmR', 'upperArmR', sub(ARM_JOINTS.elbowR, ARM_JOINTS.shoulderR)],
  ['Hand_R', 'handR', 'lowerArmR', sub(ARM_JOINTS.handR, ARM_JOINTS.elbowR)],
  ['Shoulder_L', 'shoulderL', 'chest', [0, SHOULDER - CHEST_Y, ARM_JOINTS.shoulderL[2]]],
  ['UpperArm_L', 'upperArmL', 'shoulderL', [0, 0, 0]],
  ['LowerArm_L', 'lowerArmL', 'upperArmL', sub(ARM_JOINTS.elbowL, ARM_JOINTS.shoulderL)],
  ['Hand_L', 'handL', 'lowerArmL', sub(ARM_JOINTS.handL, ARM_JOINTS.elbowL)],
  ['UpperLeg_R', 'upperLegR', 'hips', [0, 0, 0.16]],
  ['LowerLeg_R', 'lowerLegR', 'upperLegR', [0, -0.45, 0]],
  ['Foot_R', 'footR', 'lowerLegR', [0, -0.42, 0]],
  ['UpperLeg_L', 'upperLegL', 'hips', [0, 0, -0.16]],
  ['LowerLeg_L', 'lowerLegL', 'upperLegL', [0, -0.45, 0]],
  ['Foot_L', 'footL', 'lowerLegL', [0, -0.42, 0]],
];

// [nombre, hueso, posición relativa al hueso]
export const SOCKETS = [
  ['WeaponSocket_R', 'handR', [0, 0, 0]],
  ['WeaponSocket_L', 'handL', [0, 0, 0]],
  ['BackWeaponSocket', 'chest', [-0.42, 0, 0]],
  ['HipWeaponSocket', 'hips', [0, 0, 0.3]],
  ['HeadTopSocket', 'head', [0, 0.17, 0]],
  ['FaceSocket', 'head', [0.16, 0.03, 0]],
  ['BackSocket', 'chest', [-0.36, 0, 0]],
  ['AccessorySocket_L', 'chest', [0, 0, -0.45]],
  ['AccessorySocket_R', 'chest', [0, 0, 0.45]],
];

export function createRig() {
  const bones = {};
  for (const [name, key, parent, position] of BONES) {
    const bone = new THREE.Group();
    bone.name = name;
    bone.position.set(...position);
    bone.userData.rest = new THREE.Vector3(...position);
    bones[key] = bone;
    if (parent) bones[parent].add(bone);
  }
  const sockets = {};
  for (const [name, bone, position] of SOCKETS) {
    const socket = new THREE.Group();
    socket.name = name;
    socket.position.set(...position);
    bones[bone].add(socket);
    sockets[name] = socket;
  }
  return { root: bones.root, bones, sockets };
}

// Posición en el suelo (y = 0) de un hueso del rig en reposo: sirve para montar piezas
// construidas en coordenadas del personaje sobre su hueso
export function restWorldPosition(key) {
  const out = [0, 0, 0];
  let current = BONES.find((b) => b[1] === key);
  while (current) {
    current[3].forEach((v, i) => (out[i] += v));
    current = BONES.find((b) => b[1] === current[2]);
  }
  return out;
}
