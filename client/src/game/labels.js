import * as THREE from 'three';

const cache = new Map();

// Texto dibujado en un canvas como textura: sin fuentes externas y barato en celular
export function textTexture(text, { color = '#ffffff', size = 48, weight = 'bold' } = {}) {
  const key = `${text}|${color}|${size}|${weight}`;
  if (cache.has(key)) return cache.get(key);

  const font = `${weight} ${size}px system-ui, sans-serif`;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  const pad = size * 0.3;
  canvas.width = Math.ceil(ctx.measureText(text).width + pad * 2);
  canvas.height = Math.ceil(size * 1.4);

  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.18;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const result = { texture, aspect: canvas.width / canvas.height };
  cache.set(key, result);
  return result;
}
