import * as THREE from 'three';
import { ARM_JOINTS } from '../../models/soldier.js';
import { POSE_KEYS } from '../animation/pose.js';

// Huesos de un esqueleto externo con nombres conocidos (incluido Mixamo: "mixamorig:Hips"
// llega como "mixamorigHips"). Si están los principales, se le aplican las mismas animaciones
// procedurales del Master Rig (modo C), relativas a la pose de reposo de cada hueso.

export const BONE_ALIASES = {
  hips: ['Hips', 'hips', 'mixamorigHips', 'Pelvis'],
  spine: ['Spine', 'spine', 'mixamorigSpine'],
  chest: ['Chest', 'Spine1', 'Spine2', 'mixamorigSpine1', 'mixamorigSpine2', 'UpperChest'],
  neck: ['Neck', 'mixamorigNeck'],
  head: ['Head', 'head', 'mixamorigHead'],
  shoulderL: ['Shoulder_L', 'LeftShoulder', 'mixamorigLeftShoulder', 'Clavicle_L'],
  upperArmL: ['UpperArm_L', 'LeftArm', 'mixamorigLeftArm', 'LeftUpperArm'],
  lowerArmL: ['LowerArm_L', 'LeftForeArm', 'mixamorigLeftForeArm', 'LeftLowerArm'],
  handL: ['Hand_L', 'LeftHand', 'mixamorigLeftHand'],
  shoulderR: ['Shoulder_R', 'RightShoulder', 'mixamorigRightShoulder', 'Clavicle_R'],
  upperArmR: ['UpperArm_R', 'RightArm', 'mixamorigRightArm', 'RightUpperArm'],
  lowerArmR: ['LowerArm_R', 'RightForeArm', 'mixamorigRightForeArm', 'RightLowerArm'],
  handR: ['Hand_R', 'RightHand', 'mixamorigRightHand'],
  upperLegL: ['UpperLeg_L', 'LeftUpLeg', 'mixamorigLeftUpLeg', 'LeftUpperLeg', 'Thigh_L'],
  lowerLegL: ['LowerLeg_L', 'LeftLeg', 'mixamorigLeftLeg', 'LeftLowerLeg', 'Calf_L'],
  footL: ['Foot_L', 'LeftFoot', 'mixamorigLeftFoot'],
  upperLegR: ['UpperLeg_R', 'RightUpLeg', 'mixamorigRightUpLeg', 'RightUpperLeg', 'Thigh_R'],
  lowerLegR: ['LowerLeg_R', 'RightLeg', 'mixamorigRightLeg', 'RightLowerLeg', 'Calf_R'],
  footR: ['Foot_R', 'RightFoot', 'mixamorigRightFoot'],
};

// Los imprescindibles para animar con el Master Rig
const REQUIRED = ['hips', 'spine', 'upperArmR', 'lowerArmR', 'handR', 'upperArmL', 'lowerArmL', 'handL', 'upperLegR', 'upperLegL'];

// "mixamorig:LeftArm", "mixamorig1_LeftArm", "Armature|LeftArm" → "leftarm"
const clean = (name) =>
  name
    .toLowerCase()
    .replace(/^.*\|/, '')
    .replace(/^mixamorig\d*[_:]?/, '')
    .replace(/[^a-z0-9]/g, '');

export function mapBones(root) {
  const byName = new Map();
  root.traverse((o) => {
    if (o.isBone && !byName.has(clean(o.name))) byName.set(clean(o.name), o);
  });
  const mapping = {};
  for (const [key, aliases] of Object.entries(BONE_ALIASES)) {
    for (const alias of aliases) {
      const bone = byName.get(clean(alias));
      if (bone) {
        mapping[key] = bone;
        break;
      }
    }
  }
  return mapping;
}

export const isRigCompatible = (mapping) => REQUIRED.every((k) => mapping[k]);

const tmp = new THREE.Quaternion();
const holderInv = new THREE.Quaternion();
const worldQuat = (o, out) => o.getWorldQuaternion(out).premultiply(holderInv);
const worldPos = (o, holder) => holder.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
const dir = (a, b) => new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize();

// Guarda la pose de reposo (en el espacio del personaje = holder) y devuelve apply(deltas).
// local = (padre en reposo)⁻¹ · delta · alineación · (padre en reposo) · local en reposo
export function createExternalAnimator(holder, mapping) {
  holder.updateMatrixWorld(true);
  holder.getWorldQuaternion(holderInv).invert();
  const rest = {};
  for (const key of POSE_KEYS) {
    const bone = mapping[key];
    if (!bone || key === 'root') continue;
    const parentRest = bone.parent ? worldQuat(bone.parent, new THREE.Quaternion()) : new THREE.Quaternion();
    rest[key] = { bone, local: bone.quaternion.clone(), parentRest, parentRestInv: parentRest.clone().invert(), align: new THREE.Quaternion() };
  }
  // Brazos: de su reposo (en T o en A) a la pose de sostener el arma del Master Rig
  for (const side of ['R', 'L']) {
    const upper = rest[`upperArm${side}`];
    const lower = rest[`lowerArm${side}`];
    const hand = mapping[`hand${side}`];
    if (!upper || !lower || !hand) continue;
    const upperDir = worldPos(lower.bone, holder).sub(worldPos(upper.bone, holder)).normalize();
    const lowerDir = worldPos(hand, holder).sub(worldPos(lower.bone, holder)).normalize();
    const j = ARM_JOINTS;
    upper.align.setFromUnitVectors(upperDir, dir(j[`shoulder${side}`], j[`elbow${side}`]));
    const target = dir(j[`elbow${side}`], j[`hand${side}`]).applyQuaternion(upper.align.clone().invert());
    lower.align.setFromUnitVectors(lowerDir, target);
  }
  return {
    rest,
    apply(deltas) {
      for (const key in rest) {
        const r = rest[key];
        tmp.copy(deltas.q[key]).multiply(r.align);
        r.bone.quaternion.copy(r.parentRestInv).multiply(tmp).multiply(r.parentRest).multiply(r.local);
      }
    },
  };
}
