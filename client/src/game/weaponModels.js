import * as THREE from 'three';

// Armas simples de la fase 2 (en la fase 3 se reemplazan por modelos procedurales detallados).
// Todas apuntan hacia +x local. El índice coincide con WEAPON_IDS.

export const weaponMaterial = new THREE.MeshLambertMaterial({ color: '#2b2d2f' });
export const grenadeMaterial = new THREE.MeshLambertMaterial({ color: '#4b5a2a' });
export const armorMaterial = new THREE.MeshLambertMaterial({ color: '#56603a' });

export const weaponGeometries = [
  new THREE.BoxGeometry(0.45, 0.16, 0.12), // pistola
  new THREE.BoxGeometry(0.95, 0.17, 0.15), // escopeta
  new THREE.BoxGeometry(1.05, 0.16, 0.12), // rifle de asalto
  new THREE.BoxGeometry(1.45, 0.13, 0.11), // francotirador
];

export const grenadeGeometry = new THREE.SphereGeometry(0.18, 8, 6);
export const armorGeometry = new THREE.BoxGeometry(0.8, 0.9, 0.35);
