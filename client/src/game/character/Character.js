import * as THREE from 'three';
import { modelMaterial } from '../models/build.js';
import { applyMasterPose, createAnimState, createDeltas, poseDeltas, updateAnim } from './animation/pose.js';
import { attachWeapons, mountProcedural } from './proceduralSkin.js';
import { createRig } from './rig.js';

// Parte visual de un jugador:
//   visualRoot
//   └── Master Rig (huesos y sockets; el arma va en WeaponSocket_R)
//       └── skin activa (piezas procedurales sobre los huesos, o un modelo externo)
// Cambiar la skin nunca toca la posición real, la hitbox ni la red (eso es del juego).
export class Character {
  constructor({ skin, color, vest = 0, material = modelMaterial }) {
    this.visualRoot = new THREE.Group();
    this.visualRoot.name = 'VisualRoot';
    this.rig = createRig();
    this.visualRoot.add(this.rig.root);
    this.material = material;
    this.color = color;
    this.vest = vest;
    this.skinId = null;
    this.procedural = null;
    this.weapons = attachWeapons(this.rig, material);
    this.deltas = createDeltas();
    this.anim = null;
    this.order = 0;
    this.setSkin(skin);
  }

  setSkin(skinId) {
    if (skinId === this.skinId && this.procedural) return;
    this.skinId = skinId;
    this.procedural?.remove();
    this.procedural = mountProcedural(this.rig, { skin: skinId, color: this.color, vest: this.vest }, this.material);
    this.applyLook();
  }

  setVest(level) {
    if (level === this.vest) return;
    this.vest = level;
    this.procedural?.update({ vest: level });
  }

  setColor(color) {
    if (color === this.color) return;
    this.color = color;
    this.procedural?.update({ color });
  }

  setMaterial(material) {
    if (material === this.material) return;
    this.material = material;
    this.applyLook();
  }

  // El jugador propio se dibuja después de su silueta
  setRenderOrder(order) {
    if (order === this.order) return;
    this.order = order;
    this.applyLook();
  }

  setShadows(on) {
    this.rig.root.traverse((o) => {
      if (o.isMesh) o.castShadow = on;
    });
  }

  applyLook() {
    for (const m of [...Object.values(this.procedural?.meshes ?? {}), ...this.weapons]) {
      m.material = this.material;
      m.renderOrder = this.order;
    }
  }

  // Índice del arma en la mano (0 a 3) o −1 para ninguna
  setWeapon(index) {
    this.weapons.forEach((w, i) => (w.visible = i === index));
  }

  // Anima el personaje a partir del estado del juego (ver animation/pose.js)
  update(input, now, dt, onStep) {
    this.anim ??= createAnimState(input.x, input.y, input.aim);
    updateAnim(this.anim, input, now, dt, onStep);
    poseDeltas(this.anim, this.deltas);
    applyMasterPose(this.rig, this.deltas);
  }

  // Pose quieta (selector de skins, galería): brazos un poco abajo
  holdStill(armPitch = -0.25) {
    this.anim = createAnimState(0, 0, 0);
    this.anim.pitch = armPitch;
    poseDeltas(this.anim, this.deltas);
    applyMasterPose(this.rig, this.deltas);
  }

  // Libera la skin (React puede volver a montarla con setSkin: StrictMode monta dos veces)
  dispose() {
    this.procedural?.remove();
    this.procedural = null;
    this.skinId = null;
  }
}
