import * as THREE from 'three';
import { isMelee, WEAPON_IDS } from '@calculo-royale/shared/constants';

// Adaptador de animación: traduce el estado del juego a una pose y la pose a rotaciones de
// huesos. Las rotaciones se expresan en el espacio del personaje (mira a +x, +z a su derecha)
// relativas a la pose de reposo: en el Master Rig se copian tal cual; en un esqueleto
// externo se convierten al espacio de cada hueso (ver externalPose.js).

const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const approach = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));

export const ANIM_STATES = ['idle', 'walk', 'run', 'aim', 'shoot', 'reload', 'death', 'victory', 'drive', 'passenger', 'fall', 'chute'];
const RUN_SPEED = 6;
const MELEE_INDEXES = new Set(WEAPON_IDS.map((id, i) => (isMelee(id) ? i : -1)).filter((i) => i >= 0));
const SEATED_LEG = 1.45;

export function createAnimState(x, y, aim) {
  return { x, y, speed: 0, phase: 0, legsYaw: aim, aimYaw: aim, pitch: -0.45, swing: 0, bob: 0, recoil: 0, kick: 0.14, deadSince: 0, deathYaw: 0, fall: 0, seat: null, air: null, airT: 0, victory: false, victoryT: 0, state: 'idle' };
}

// input: { x, y, aim, dead, reloading, aiming, shotAgo, weapon, seat ('driver'|'passenger'|null), seatYaw, victory, air ('fall'|'chute'|null) }
// onStep(x, y) se llama en cada pisada (polvo)
export function updateAnim(st, input, now, dt, onStep) {
  const dx = input.x - st.x;
  const dy = input.y - st.y;
  const moved = Math.hypot(dx, dy);
  st.x = input.x;
  st.y = input.y;
  st.seat = input.dead ? null : input.seat;
  st.air = input.dead ? null : (input.air ?? null);
  st.airT = st.air ? st.airT + dt : 0;
  // En el jeep o en el aire no se camina
  st.speed = st.seat || st.air ? 0 : approach(st.speed, dt > 0 ? Math.min(moved / dt, 12) : 0, 10, dt);
  st.aimYaw = input.aim;

  if (!input.dead) {
    if (st.seat) {
      st.legsYaw = input.seatYaw ?? st.legsYaw;
    } else if (st.air) {
      st.legsYaw = input.aim;
    } else {
      // Las piernas giran hacia donde camina; si la mira se aleja demasiado, los pies la siguen
      let legsGoal = st.speed > 0.5 ? Math.atan2(dy, dx) : st.legsYaw;
      if (st.speed <= 0.5 && Math.abs(angleDiff(input.aim, st.legsYaw)) > 1.6) legsGoal = input.aim;
      if (moved > 1e-4 || st.speed <= 0.5) st.legsYaw += angleDiff(legsGoal, st.legsYaw) * (1 - Math.exp(-12 * dt));
    }
  }

  // Caminar: zancada y balanceo según la velocidad real
  const stride = Math.min(st.speed / 6, 1);
  const before = Math.sin(st.phase);
  st.phase += st.speed * dt * 1.7;
  if (Math.sign(before) !== Math.sign(Math.sin(st.phase)) && st.speed > 3) onStep?.(input.x, input.y);
  st.swing = input.dead ? 0 : Math.sin(st.phase) * 0.6 * stride;
  st.bob = input.dead ? 0 : Math.abs(Math.sin(st.phase)) * 0.05 * stride;

  // Brazos: arriba al apuntar o disparar, abajo en reposo, más abajo al recargar; retroceso al disparar
  const goal = input.reloading ? -0.8 : input.aiming || input.shotAgo < 1200 ? 0 : -0.45;
  st.pitch = approach(st.pitch, goal, 10, dt);
  st.recoil = input.shotAgo < 160 ? 1 - input.shotAgo / 160 : 0;
  st.kick = input.weapon === 3 ? 0.35 : input.weapon === 1 ? 0.25 : 0.14;
  // Cuerpo a cuerpo (7A): tajo de 300 ms (el torso gira y vuelve)
  st.slash = MELEE_INDEXES.has(input.weapon) && input.shotAgo < 300 ? Math.sin((input.shotAgo / 300) * Math.PI) : 0;

  // Victoria: arma en alto y saltitos (presentación del duelo y ganador en los resultados)
  st.victory = Boolean(input.victory) && !input.dead;
  st.victoryT = st.victory ? st.victoryT + dt : 0;

  // Caída al morir: se va de espaldas en ~0.45 s
  if (input.dead && !st.deadSince) {
    st.deadSince = now;
    st.deathYaw = input.aim;
  }
  if (!input.dead) st.deadSince = 0;
  st.fall = input.dead ? 1 - (1 - Math.min(1, (now - st.deadSince) / 450)) ** 3 : 0;

  st.state = semanticState(st, input);
  return st;
}

export function semanticState(st, input = {}) {
  if (st.fall > 0) return 'death';
  if (st.victory) return 'victory';
  if (st.air) return st.air;
  if (st.seat === 'driver') return 'drive';
  if (st.seat === 'passenger') return 'passenger';
  if (input.reloading) return 'reload';
  if (st.recoil > 0) return 'shoot';
  if (st.pitch > -0.2) return 'aim';
  if (st.speed > RUN_SPEED) return 'run';
  if (st.speed > 0.5) return 'walk';
  return 'idle';
}

const KEYS = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'upperArmR', 'lowerArmR', 'upperArmL', 'lowerArmL', 'upperLegR', 'lowerLegR', 'upperLegL', 'lowerLegL'];

export function createDeltas() {
  const q = {};
  for (const k of KEYS) q[k] = new THREE.Quaternion();
  return { q, rootY: 0, spineY: 0, shoulderX: 0 };
}

const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const fallAxis = new THREE.Vector3();

// Pose → rotaciones de huesos en el espacio del personaje (relativas al reposo)
export function poseDeltas(st, out = createDeltas()) {
  const { q } = out;
  for (const k of KEYS) q[k].identity();
  const dead = st.fall > 0;
  const yaw = dead ? st.deathYaw : st.legsYaw;
  q.hips.setFromAxisAngle(Y, yaw);
  q.spine.setFromAxisAngle(Y, dead ? 0 : angleDiff(st.aimYaw, st.legsYaw) + (st.slash ?? 0) * 0.9);

  let arm = st.pitch + st.recoil * st.kick + (st.slash ?? 0) * 0.6;
  if (st.victory) arm = 1.15 + Math.sin(st.victoryT * 8) * 0.15;
  // Caída libre: brazos al frente; paracaídas: brazos arriba agarrando las cuerdas
  if (st.air === 'fall') arm = 1.1 + Math.sin(st.airT * 5) * 0.08;
  if (st.air === 'chute') arm = 2.5;
  q.upperArmR.setFromAxisAngle(Z, arm);
  q.upperArmL.setFromAxisAngle(Z, arm);

  if (st.air) {
    // Piernas: hacia atrás en caída libre, colgando y meciéndose con el paracaídas
    const legs = st.air === 'fall' ? -0.35 : 0.15 + Math.sin(st.airT * 2) * 0.12;
    q.upperLegR.setFromAxisAngle(Z, legs);
    q.upperLegL.setFromAxisAngle(Z, st.air === 'fall' ? legs : legs * 0.4);
  } else if (st.seat && st.seat !== 'stand') {
    q.upperLegR.setFromAxisAngle(Z, SEATED_LEG);
    q.upperLegL.setFromAxisAngle(Z, SEATED_LEG);
    q.lowerLegR.setFromAxisAngle(Z, -SEATED_LEG);
    q.lowerLegL.setFromAxisAngle(Z, -SEATED_LEG);
  } else {
    q.upperLegL.setFromAxisAngle(Z, st.swing);
    q.upperLegR.setFromAxisAngle(Z, -st.swing);
  }

  // Caída de espaldas sobre el eje perpendicular a la mira
  fallAxis.set(Math.sin(st.deathYaw), 0, Math.cos(st.deathYaw));
  q.root.setFromAxisAngle(fallAxis, st.fall * Math.PI * 0.48);
  // Caída libre: boca abajo hacia donde mira (el eje es el de la caída, con el signo al revés)
  if (st.air === 'fall') q.root.setFromAxisAngle(fallAxis.set(Math.sin(st.aimYaw), 0, Math.cos(st.aimYaw)), -1.15);
  out.rootY = st.fall * 0.22 + (st.seat && st.seat !== 'stand' && !dead ? 0.12 : 0) + (st.victory ? Math.abs(Math.sin(st.victoryT * 6)) * 0.22 : 0);
  out.spineY = st.bob;
  out.shoulderX = -st.recoil * 0.1;
  return out;
}

// En el Master Rig el reposo es la identidad: las rotaciones se copian tal cual
export function applyMasterPose(rig, d) {
  const b = rig.bones;
  for (const k of KEYS) if (k !== 'root') b[k].quaternion.copy(d.q[k]);
  b.root.quaternion.copy(d.q.root);
  b.root.position.y = d.rootY;
  b.spine.position.y = b.spine.userData.rest.y + d.spineY;
  b.shoulderR.position.x = d.shoulderX;
  b.shoulderL.position.x = d.shoulderX;
}

export const POSE_KEYS = KEYS;
