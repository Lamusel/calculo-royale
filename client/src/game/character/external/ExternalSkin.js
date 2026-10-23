import * as THREE from 'three';
import { findAnimationBySemantic } from '../animation/clips.js';
import { createExternalAnimator, isRigCompatible, mapBones } from './bones.js';
import { normalizeExternalSkin } from './normalize.js';

// Una instancia de skin externa (clon del modelo cargado). Modos:
//   A: sin esqueleto → se monta entero, mira a la mira y se inclina y rebota al caminar
//   B: esqueleto propio sin alias conocidos → clips del archivo por significado (o pose neutra)
//   C: esqueleto con alias (Mixamo y otros) → las mismas animaciones del Master Rig sobre sus
//      huesos; los clips del archivo solo se usan para la victoria
const LOD_NAME = /(^|[_\s.-])LOD([0-2])$/i;
const SECONDARY_RATIO = 0.15; // piezas con menos del 15 % de los triángulos de la principal

const trianglesOf = (mesh) => {
  const g = mesh.geometry;
  return (g.index ? g.index.count : g.attributes.position.count) / 3;
};

export class ExternalSkin {
  constructor(entry, asset, model) {
    this.entry = entry;
    this.asset = asset;
    this.model = model;
    const { holder } = normalizeExternalSkin(model, entry);
    this.object = holder;
    this.mapping = mapBones(model);
    let skinned = false;
    model.traverse((o) => {
      if (o.isSkinnedMesh) skinned = true;
    });
    this.mode = isRigCompatible(this.mapping) ? 'C' : skinned ? 'B' : 'A';
    this.animator = this.mode === 'C' ? createExternalAnimator(holder, this.mapping) : null;

    const clips = asset.animations ?? [];
    this.clips = clips;
    this.mixer = clips.length ? new THREE.AnimationMixer(model) : null;
    this.action = null;
    this.victoryClip = (entry.victoryAnimation && clips.find((c) => c.name === entry.victoryAnimation)) || findAnimationBySemantic(clips, 'victory');
    this.setupLod();
  }

  // LOD: objetos LOD0/LOD1/LOD2 del archivo, o piezas secundarias (pocas caras) que se esconden
  setupLod() {
    this.lodGroups = [];
    this.model.traverse((o) => {
      const m = o.name.match(LOD_NAME);
      if (m) this.lodGroups[Number(m[2])] = o;
    });
    const meshes = [];
    this.model.traverse((o) => o.isMesh && meshes.push(o));
    const main = Math.max(1, ...meshes.map(trianglesOf));
    this.secondary = this.lodGroups.length ? [] : meshes.filter((m) => trianglesOf(m) < main * SECONDARY_RATIO);
    this.lod = -1;
    this.setLod(0);
  }

  setLod(level) {
    if (level === this.lod) return;
    this.lod = level;
    if (this.lodGroups.length) {
      const available = this.lodGroups.map((g, i) => (g ? i : -1)).filter((i) => i >= 0);
      const use = available.filter((i) => i <= level).pop() ?? available[0];
      this.lodGroups.forEach((g, i) => g && (g.visible = i === use));
    } else {
      for (const m of this.secondary) m.visible = level === 0;
    }
  }

  setShadows(on) {
    this.model.traverse((o) => {
      if (o.isMesh) o.castShadow = on;
    });
  }

  play(clip) {
    if (this.action?.getClip() === clip) return;
    const next = clip && this.mixer.clipAction(clip);
    if (this.action) this.action.fadeOut(0.2);
    if (next) next.reset().fadeIn(0.2).play();
    this.action = next ?? null;
  }

  // st: estado de animación (animation/pose.js); deltas: rotaciones de huesos del Master Rig
  apply(st, deltas, dt) {
    const o = this.object;
    if (this.mode === 'C') {
      if (st.victory && this.victoryClip) {
        this.play(this.victoryClip);
        o.rotation.y = st.aimYaw; // el clip mueve la cadera: se orienta el modelo entero
      } else {
        if (this.action) this.play(null);
        o.rotation.y = 0;
        this.animator.apply(deltas);
      }
    } else {
      o.rotation.y = st.fall > 0 ? st.deathYaw : st.aimYaw;
      if (this.mode === 'B') {
        this.play(this.mixer ? findAnimationBySemantic(this.clips, st.state) : null);
      } else {
        // Estático: inclinación hacia adelante y rebote al caminar para no verse congelado
        const stride = Math.min(st.speed / 6, 1);
        o.rotation.z = -0.12 * stride;
        o.position.y = Math.abs(Math.sin(st.phase)) * 0.07 * stride;
      }
    }
    this.mixer?.update(dt);
  }

  // Dónde está la mano derecha del modelo (para llevar el arma ahí), o null
  handWorldPosition(target) {
    const hand = this.mapping.handR;
    return hand && this.mode === 'C' && !this.action ? hand.getWorldPosition(target) : null;
  }

  stats() {
    return this.asset.stats;
  }
}
