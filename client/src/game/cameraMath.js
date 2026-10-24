import { CAMERA } from '@calculo-royale/shared/constants';

// Cámara dinámica (fase 24), sin Three.js para poder probarla.

// Distancia base según Opciones → "Distancia de cámara"
export const baseDistance = (choice) => CAMERA.distances[choice] ?? CAMERA.distances.normal;

// Factor según dónde está: más cerca adentro, más lejos corriendo afuera o en jeep
export function dynamicFactor({ inside, speed, inJeep }) {
  if (inJeep) return CAMERA.jeepFactor;
  if (inside) return CAMERA.insideFactor;
  return speed >= CAMERA.runSpeed ? CAMERA.runFactor : 1;
}

// Distancia a la que va la cámara: en el bus o cayendo, la vista amplia de siempre
export function goalDistance({ choice, inside = false, speed = 0, inJeep = false, air = false, projector = false }) {
  if (air) return CAMERA.deployDistance;
  if (projector) return CAMERA.projectorDistance;
  return baseDistance(choice) * dynamicFactor({ inside, speed, inJeep });
}

// Tamaño aparente del soldado respecto de la cámara vieja (30,5 m): proporcional a 1/distancia
export const sizeVsOld = (distance) => CAMERA.lookScaleFrom / distance;
