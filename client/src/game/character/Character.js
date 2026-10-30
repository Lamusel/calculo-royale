import * as THREE from 'three';
import { modelMaterial } from '../models/build.js';
import { applyMasterPose, createAnimState, createDeltas, poseDeltas, updateAnim } from './animation/pose.js';
import { attachWeapons, mountProcedural } from './proceduralSkin.js';
import { createRig } from './rig.js';
import { FALLBACK_SKIN, getSkinEntry } from './skins/index.js';
import { WEAPON_IDS } from '@calculo-royale/shared/constants';
import { attachmentGeometry, backpackGeometry, hatGeometry, helmetGeometry } from '../models/gear.js';

const DEG = Math.PI / 180;
// El cargador de GLB se pide recién cuando alguien usa una skin externa (import dinámico)
let loaderModule = null;
export const loadSkinSystem = () => (loaderModule ??= import('./loaders/skinLoader.js'));

const handWorld = new THREE.Vector3();
// Modo C: cuánto más arriba de la base de la cabeza va el casco (si el modelo no lo dice) y cuánto
// detrás del pecho la mochila
const HEAD_TOP = 0.12;
const BACK_OFFSET = -0.18;
const warned = new Set(); // un solo aviso por skin que falla
const EXTERNAL_WAIT_MS = 3_000; // espera máxima de una skin externa antes de mostrar la base

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
    this.weaponIndex = -1;
    // Equipo visible (fase 25): accesorios del arma, casco y mochila
    this.gear = null;
    this.gearKey = '';
    this.gearMeshes = [];
    this.deltas = createDeltas();
    this.anim = null;
    this.order = 0;
    this.shadows = true;
    this.lod = 0;
    this.setSkin(skin);
  }

  setSkin(skinId) {
    // La misma skin ya puesta o cargándose: nada (antes, una segunda llamada mientras cargaba montaba
    // dos modelos encimados)
    if (skinId === this.skinId && (this.procedural || this.external || this.status === 'loading')) return;
    this.skinId = skinId;
    // Turno de carga: solo la última pedida se monta; las anteriores se liberan al llegar
    const token = (this.loadToken = (this.loadToken ?? 0) + 1);
    this.entry = getSkinEntry(skinId);
    this.dropExternal();
    this.applyWeaponOffset();
    if (this.entry.type === 'external') {
      // 7A: mientras carga no se ve nadie (solo el anillo del jugador, que va aparte); si en 3 s no
      // llegó, la skin procedural base hasta que llegue (o para siempre si falla)
      this.procedural?.remove();
      this.procedural = null;
      this.visualRoot.visible = false;
      this.status = 'loading';
      const wanted = skinId;
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = setTimeout(() => {
        if (this.skinId !== wanted || this.status !== 'loading') return;
        this.mountProcedural(FALLBACK_SKIN);
        this.visualRoot.visible = true;
      }, EXTERNAL_WAIT_MS);
      loadSkinSystem()
        .then((m) => m.createSkinInstance(this.entry))
        .then((instance) => {
          if (this.skinId !== wanted || this.loadToken !== token || this.external) {
            loaderModule.then((m) => m.disposeSkinInstance(instance));
            return;
          }
          clearTimeout(this.fallbackTimer);
          this.procedural?.remove();
          this.procedural = null;
          this.visualRoot.visible = true;
          this.external = instance;
          this.rig.root.add(instance.object);
          instance.setShadows(this.shadows);
          instance.setLod(this.lod);
          this.status = 'ready';
          this.buildGear();
          if (this.anim) this.pose();
        })
        .catch((err) => {
          if (this.skinId !== wanted || this.loadToken !== token) return;
          if (!warned.has(skinId)) console.warn('Skin asset missing:', skinId, err?.message ?? err);
          warned.add(skinId);
          clearTimeout(this.fallbackTimer);
          if (!this.procedural) this.mountProcedural(FALLBACK_SKIN);
          this.visualRoot.visible = true;
          this.status = 'fallback';
        });
    } else {
      clearTimeout(this.fallbackTimer);
      this.visualRoot.visible = true;
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
    // Casco y mochila vuelven a los sockets del rig (en modo C seguían al modelo)
    for (const name of ['HeadTopSocket', 'BackSocket']) {
      const socket = this.rig.sockets[name];
      if (socket.userData.rest) socket.position.copy(socket.userData.rest);
    }
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

  // Accesorio de temporada (7A): solo en las skins procedurales; va por encima del casco
  setHat(hat) {
    if (hat === this.hat) return;
    this.hat = hat;
    this.buildGear();
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
    for (const m of [...Object.values(this.procedural?.meshes ?? {}), ...this.weapons, ...(this.gearMeshes ?? [])]) {
      m.material = this.material;
      m.renderOrder = this.order;
    }
  }

  // Índice del arma en la mano (0 a 3) o −1 para ninguna
  setWeapon(index) {
    this.weapons.forEach((w, i) => (w.visible = i === index));
    if (index !== this.weaponIndex) {
      this.weaponIndex = index;
      this.buildGear();
    }
  }

  // gear: { helmet, backpack, scope, mag, stock, muzzle } (decodeGear de shared/gear.js)
  setGear(gear) {
    const key = gear ? `${gear.helmet}${gear.backpack}${gear.scope}${gear.mag}${gear.stock}${gear.muzzle}` : '';
    if (key === this.gearKey) return;
    this.gearKey = key;
    this.gear = gear;
    this.buildGear();
  }

  // ¿El casco y la mochila se pueden poner en este modelo? (las skins externas sin los huesos del
  // rig no: ahí se muestran como iconos junto a la barra de vida)
  get gearOnModel() {
    return !this.external || Boolean(this.external.bonesUsable);
  }

  buildGear() {
    for (const m of this.gearMeshes) m.removeFromParent();
    this.gearMeshes = [];
    const g = this.gear ?? { helmet: 0, backpack: 0 };
    const add = (geometry, parent) => {
      if (!geometry || !parent) return;
      const m = new THREE.Mesh(geometry, this.material);
      m.castShadow = this.shadows;
      m.renderOrder = this.order;
      parent.add(m);
      this.gearMeshes.push(m);
    };
    const weaponId = WEAPON_IDS[this.weaponIndex];
    const weapon = this.weapons[this.weaponIndex];
    if (weapon) {
      if (g.scope) add(attachmentGeometry(g.scope, weaponId), weapon);
      if (g.mag) add(attachmentGeometry('extmag', weaponId), weapon);
      if (g.stock) add(attachmentGeometry('stock', weaponId), weapon);
      if (g.muzzle) add(attachmentGeometry('silencer', weaponId), weapon);
    }
    if (this.gearOnModel) {
      add(helmetGeometry(g.helmet), this.rig.sockets.HeadTopSocket);
      add(backpackGeometry(g.backpack), this.rig.sockets.BackSocket);
    }
    if (this.hat && !this.external) {
      const before = this.gearMeshes.length;
      add(hatGeometry(this.hat), this.rig.sockets.HeadTopSocket);
      if (g.helmet && this.gearMeshes[before]) this.gearMeshes[before].position.y = 0.12;
    }
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
    const socket = this.rig.sockets.WeaponSocket_R;
    // Sin brazos propios (modos A y B) el arma flotaría sobre la cabeza al tomar las cuerdas
    socket.visible = !(this.external && this.external.mode !== 'C' && this.anim.air);
    if (!this.external) return;
    this.external.apply(this.anim, this.deltas, dt);
    // Modo C: el socket del arma sigue la mano del modelo (otras proporciones que el rig)
    socket.position.set(0, 0, 0);
    this.visualRoot.updateMatrixWorld(true);
    if (this.external.handWorldPosition(handWorld)) socket.position.copy(socket.parent.worldToLocal(handWorld));
    // Casco y mochila (fase 25): sobre la cabeza y en la espalda del modelo, no del rig
    const head = this.rig.sockets.HeadTopSocket;
    const back = this.rig.sockets.BackSocket;
    head.position.copy(head.userData.rest ??= head.position.clone());
    back.position.copy(back.userData.rest ??= back.position.clone());
    if (this.external.boneWorldPosition('head', handWorld)) {
      head.position.copy(head.parent.worldToLocal(handWorld));
      head.position.y += this.external.headTopOffset ?? HEAD_TOP;
    }
    if (this.external.boneWorldPosition('chest', handWorld)) {
      back.position.copy(back.parent.worldToLocal(handWorld));
      back.position.x += BACK_OFFSET;
    }
  }

  // Pose quieta (selector de skins, galería): brazos un poco abajo
  holdStill(armPitch = -0.25) {
    this.anim = createAnimState(0, 0, 0);
    this.anim.pitch = armPitch;
    this.pose();
  }

  // Libera la skin (React puede volver a montarla con setSkin: StrictMode monta dos veces)
  dispose() {
    clearTimeout(this.fallbackTimer);
    this.loadToken = (this.loadToken ?? 0) + 1; // una carga en curso se libera al llegar
    this.procedural?.remove();
    this.procedural = null;
    this.dropExternal();
    this.skinId = null;
  }
}
