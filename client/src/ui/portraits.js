// Retratos de las skins procedurales (6.5): se dibujan una sola vez fuera de pantalla con un único
// renderer compartido y se guardan en caché (memoria y localStorage). Las externas usan su PNG.
const CACHE_KEY = 'cr-portrait-v1-';
const W = 192;
const H = 256;
const memory = new Map();
let shared = null; // { THREE, renderer, scene, camera, Character }
let queue = Promise.resolve();

async function setup() {
  if (shared) return shared;
  const THREE = await import('three');
  const { Character } = await import('../game/character/Character.js');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff7e0', '#3a3f2a', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 20);
  camera.position.set(0.6, 1.25, 3.4);
  camera.lookAt(0, 0.95, 0);
  shared = { THREE, renderer, scene, camera, Character };
  return shared;
}

const read = (id) => {
  try {
    return localStorage.getItem(CACHE_KEY + id);
  } catch {
    return null;
  }
};

// Devuelve (promesa) la URL de datos del retrato de una skin procedural; de a una por vez
export function proceduralPortrait(id, color = '#f97316') {
  const key = `${id}:${color}`;
  if (memory.has(key)) return Promise.resolve(memory.get(key));
  const stored = read(key);
  if (stored) {
    memory.set(key, stored);
    return Promise.resolve(stored);
  }
  const job = queue.then(async () => {
    if (memory.has(key)) return memory.get(key);
    const { renderer, scene, camera, Character } = await setup();
    const ch = new Character({ skin: id, color, vest: 2 });
    ch.setWeapon(6);
    ch.holdStill();
    ch.visualRoot.rotation.y = -1.15; // el modelo mira a +X: de tres cuartos hacia la cámara
    scene.add(ch.visualRoot);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(ch.visualRoot);
    ch.dispose();
    memory.set(key, url);
    try {
      localStorage.setItem(CACHE_KEY + key, url);
    } catch {
      // Sin espacio o en privado: queda solo en memoria
    }
    return url;
  });
  queue = job.catch(() => null);
  return queue;
}

export const cachedPortrait = (id, color = '#f97316') => memory.get(`${id}:${color}`) ?? null;
