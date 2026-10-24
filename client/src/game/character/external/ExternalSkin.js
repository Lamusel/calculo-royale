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

// Distancia vertical (en reposo) del hueso de la cabeza a lo más alto del modelo, menos un poco
// para que el casco se apoye (sin pasar de 0,22 m: sombreros y adornos altos no lo levantan)
function headTop(holder, head) {
  holder.updateMatrixWorld(true);
  const top = new THREE.Box3().setFromObject(holder).max.y;
  return Math.min(0.22, Math.max(0.05, top - head.getWorldPosition(new THREE.Vector3()).y - 0.08));
}

// La cabeza tiene que quedar bien por encima de la cadera (en metros, ya normalizado a 1,8 m)
function usableSkeleton(holder, mapping) {
  holder.updateMatrixWorld(true);
  const head = mapping.head?.getWorldPosition(new THREE.Vector3());
  const hips = mapping.hips?.getWorldPosition(new THREE.Vector3());
  return Boolean(head && hips && head.y - hips.y > 0.3);
}

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
    // ¿Los huesos están donde van? (algunos exportadores dejan todo el esqueleto en el origen):
    // si no, casco y mochila se muestran como iconos (fase 25)
    this.bonesUsable = this.mode === 'C' && usableSkeleton(holder, this.mapping);
    // Cuánto más arriba de la cabeza va el casco: hasta lo más alto del modelo (pelo, sombrero)
    this.headTopOffset = this.bonesUsable ? headTop(holder, this.mapping.head) : null;

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
        // En el jeep no dobla las piernas: queda de pie en la cabina (las piernas las tapa la
        // carrocería, revisado en /skins). La caída, el paracaídas y la muerte inclinan el rig entero
        const stride = Math.min(st.speed / 6, 1);
        o.rotation.z = -0.12 * stride;
        o.position.y = Math.abs(Math.sin(st.phase)) * 0.07 * stride;
        if (st.victory) o.rotation.y += Math.sin(st.victoryT * 5) * 0.5;
      }
    }
    this.mixer?.update(dt);
  }

  // Dónde está la mano derecha del modelo (para llevar el arma ahí), o null
  handWorldPosition(target) {
    return this.boneWorldPosition('handR', target);
  }

  // Posición de un hueso del modelo (modo C, sin clip de victoria sonando), o null: el arma, el
  // casco y la mochila siguen al modelo, que tiene otras proporciones que el Master Rig
  boneWorldPosition(name, target) {
    const bone = this.mapping[name];
    return bone && this.mode === 'C' && !this.action ? bone.getWorldPosition(target) : null;
  }

  stats() {
    return this.asset.stats;
  }
}
