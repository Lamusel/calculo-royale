import * as THREE from 'three';
import { BONES } from './rig.js';

// Depuración de skins (galería /skins y ?debugSkins=1): esqueleto, caja, sockets y conteos.

export const debugSkinsEnabled = () => new URLSearchParams(globalThis.location?.search ?? '').has('debugSkins');

// Triángulos, mallas, materiales y texturas de lo que se dibuja del personaje
export function characterStats(character) {
  const materials = new Set();
  const textures = new Set();
  let triangles = 0;
  let meshes = 0;
  character.rig.root.traverseVisible((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    for (const m of [o.material].flat()) {
      materials.add(m);
      for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
    }
  });
  return { triangles: Math.round(triangles), meshes, materials: materials.size, textures: textures.size };
}

// Nombres de los huesos que se animan (del rig o del modelo externo, con su alias)
export function boneNames(character) {
  const ext = character.external;
  if (ext?.mode === 'C') return Object.entries(ext.mapping).map(([key, bone]) => `${key} → ${bone.name}`);
  if (ext) {
    const names = [];
    ext.model.traverse((o) => o.isBone && names.push(o.name));
    return names;
  }
  return BONES.map(([name]) => name);
}

const lineMaterial = new THREE.LineBasicMaterial({ color: '#22d3ee', depthTest: false, transparent: true });
const boxColor = new THREE.Color('#f472b6');

// Ayudas visuales que se agregan a la escena (no al personaje) y se actualizan cada cuadro
export class CharacterDebug {
  constructor(character, scene) {
    this.character = character;
    this.scene = scene;
    this.box = new THREE.Box3();
    this.boxHelper = new THREE.Box3Helper(this.box, boxColor);
    this.lines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMaterial);
    this.lines.renderOrder = 10;
    this.lines.frustumCulled = false;
    this.axes = Object.values(character.rig.sockets).map((socket) => {
      const a = new THREE.AxesHelper(0.18);
      a.material.depthTest = false;
      a.renderOrder = 11;
      socket.add(a);
      return a;
    });
    scene.add(this.boxHelper, this.lines);
  }

  update() {
    const ch = this.character;
    ch.visualRoot.updateMatrixWorld(true);
    this.box.setFromObject(ch.rig.root);
    // Esqueleto: de cada hueso a su padre (el del modelo externo si lo hay)
    const points = [];
    const root = ch.external?.model ?? ch.rig.root;
    const isJoint = (o) => (ch.external ? o.isBone : o.name && !o.name.includes('Socket') && !o.isMesh);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    root.traverse((o) => {
      if (!isJoint(o) || !o.parent || !isJoint(o.parent)) return;
      o.getWorldPosition(a);
      o.parent.getWorldPosition(b);
      points.push(a.x, a.y, a.z, b.x, b.y, b.z);
    });
    this.lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  }

  dispose() {
    this.scene.remove(this.boxHelper, this.lines);
    this.lines.geometry.dispose();
    for (const a of this.axes) a.removeFromParent();
  }
}
