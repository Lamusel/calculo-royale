// Orígenes permitidos (CORS): CLIENT_ORIGIN separado por comas; admite comodines como
// https://*.vercel.app para las vistas previas de Vercel. Vacío = cualquiera (desarrollo).

const escapeRegExp = (text) => text.replace(/[.+?^${}()|[\]\\]/g, (ch) => `\\${ch}`);

export function parseOrigins(value) {
  if (!value) return true;
  return value
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean)
    .map((o) => (o.includes('*') ? new RegExp(`^${escapeRegExp(o).replace(/\*/g, '[^.]+')}$`) : o));
}
