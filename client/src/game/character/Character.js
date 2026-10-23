import * as THREE from 'three';
import { modelMaterial } from '../models/build.js';
import { applyMasterPose, createAnimState, createDeltas, poseDeltas, updateAnim } from './animation/pose.js';
import { attachWeapons, mountProcedural } from './proceduralSkin.js';
import { createRig } from './rig.js';
import { FALLBACK_SKIN, getSkinEntry } from './skins/index.js';

const DEG = Math.PI / 180;
// El cargador de GLB se pide recién cuando alguien usa una skin externa (import dinámico)
let loaderModule = null;
export const loadSkinSystem = () => (loaderModule ??= import('./loaders/skinLoader.js'));

const handWorld = new THREE.Vector3();

// Parte visual de un jugador:
//   visualRoot
//   └── Master Rig (huesos y sockets; el arma va en WeaponSocket_R)
//       └── skin activa: piezas procedurales sobre los huesos, o un modelo externo (GLB)
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
    this.entry = null;
    this.procedural = null;
    this.external = null;
    this.status = 'idle'; // 'ready' | 'loading' | 'fallback' (falló la externa)
    this.weapons = attachWeapons(this.rig, material);
    this.deltas = createDeltas();
    this.anim = null;
    this.order = 0;
    this.shadows = true;
    this.lod = 0;
    this.setSkin(skin);
  }

  setSkin(skinId) {
    if (skinId === this.skinId && (this.procedural || this.external)) return;
    this.skinId = skinId;
    this.entry = getSkinEntry(skinId);
    this.dropExternal();
    this.applyWeaponOffset();
    if (this.entry.type === 'external') {
      // Mientras carga se ve el soldado gris
      this.mountProcedural(FALLBACK_SKIN);
      this.status = 'loading';
      const wanted = skinId;
      loadSkinSystem()
        .then((m) => m.createSkinInstance(this.entry))
        .then((instance) => {
          if (this.skinId !== wanted) {
            loaderModule.then((m) => m.disposeSkinInstance(instance));
            return;
          }
          this.procedural?.remove();
          this.procedural = null;
          this.external = instance;
          this.rig.root.add(instance.object);
          instance.setShadows(this.shadows);
          instance.setLod(this.lod);
          this.status = 'ready';
          if (this.anim) this.pose();
        })
        .catch((err) => {
          if (this.skinId !== wanted) return;
          console.warn('Skin asset missing:', skinId, err?.message ?? err);
          this.status = 'fallback';
        });
    } else {
      this.mountProcedural(skinId);
      this.status = 'ready';
    }
  }

  mountProcedural(skin) {
    this.procedural?.remove();
    this.procedural = mountProcedural(this.rig, { skin, color: this.color, vest: this.vest }, this.material);
    this.applyLook();
    this.setShadows(this.shadows);
  }

  dropExternal() {
    this.rig.sockets.WeaponSocket_R.position.set(0, 0, 0);
    if (!this.external) return;
    const instance = this.external;
    this.external = null;
    loaderModule?.then((m) => m.disposeSkinInstance(instance));
  }

  // Ajuste del arma por skin (registro: weaponOffset)
  applyWeaponOffset() {
    const { position = [0, 0, 0], rotation = [0, 0, 0] } = this.entry.weaponOffset ?? {};
    for (const w of this.weapons) {
      w.position.set(...position);
      w.rotation.set(rotation[0] * DEG, rotation[1] * DEG, rotation[2] * DEG);
    }
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
    this.shadows = on;
    this.rig.root.traverse((o) => {
      if (o.isMesh) o.castShadow = on;
    });
  }

  // 0 = completo, 1 = sin piezas secundarias, 2 = lo mínimo (solo afecta a las externas)
  setLod(level) {
    this.lod = level;
    this.external?.setLod(level);
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
    this.pose(dt);
  }

  pose(dt = 0) {
    poseDeltas(this.anim, this.deltas);
    applyMasterPose(this.rig, this.deltas);
    if (!this.external) return;
    this.external.apply(this.anim, this.deltas, dt);
    // Modo C: el socket del arma sigue la mano del modelo (otras proporciones que el rig)
    const socket = this.rig.sockets.WeaponSocket_R;
    socket.position.set(0, 0, 0);
    this.visualRoot.updateMatrixWorld(true);
    if (this.external.handWorldPosition(handWorld)) socket.position.copy(socket.parent.worldToLocal(handWorld));
  }

  // Pose quieta (selector de skins, galería): brazos un poco abajo
  holdStill(armPitch = -0.25) {
    this.anim = createAnimState(0, 0, 0);
    this.anim.pitch = armPitch;
    this.pose();
  }

  // Libera la skin (React puede volver a montarla con setSkin: StrictMode monta dos veces)
  dispose() {
    this.procedural?.remove();
    this.procedural = null;
    this.dropExternal();
    this.skinId = null;
  }
}
