// Optimiza los audios propios (7B): .wav (o los muy pesados) → .mp3 liviano, recorta el silencio del
// inicio de los efectos, iguala el volumen por categoría (sin pasar de −1 dB de pico) y pone fundidos
// cortos en los bucles para que no se oiga el corte. El original queda en audio-originales/ (fuera de
// git y del deploy). Usa ffmpeg de npx (no se instala en el proyecto):
//   npx -y -p ffmpeg-static node -e "" && node scripts/audio-optimize.js
// o con la ruta a mano: FFMPEG=C:/ruta/ffmpeg.exe node scripts/audio-optimize.js
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const AUDIO = join(ROOT, 'client/public/assets/audio');
const BACKUP = join(ROOT, 'audio-originales');

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const cache = join(process.env.LOCALAPPDATA ?? join(homedir(), '.npm'), process.env.LOCALAPPDATA ? 'npm-cache/_npx' : '_npx');
  if (existsSync(cache)) {
    for (const dir of readdirSync(cache)) {
      for (const bin of ['ffmpeg.exe', 'ffmpeg']) {
        const path = join(cache, dir, 'node_modules/ffmpeg-static', bin);
        if (existsSync(path)) return path;
      }
    }
  }
  throw new Error('No encuentro ffmpeg: corre antes  npx -y -p ffmpeg-static node -e ""  (o pon FFMPEG=ruta)');
}

// Volumen medio objetivo (dB) por categoría: explosiones fuertes sin aturdir, disparos claros,
// motores y ambiente de fondo, música por debajo de los efectos
const TARGETS = [
  [/^explosion-lejana/, -24],
  [/^explosion/, -16],
  [/^disparo-lejano/, -24],
  [/^disparo/, -18],
  [/^(golpe|tajo|estocada|filo)/, -20],
  [/^(motor|fuego)/, -24],
  [/^(humo|aturdidora|muro|sensor|uav|granada)/, -24],
  [/^(recarga|sin-balas|cambio-arma|casquillo|clic|tomar)/, -25],
  [/^radio-camion/, -25],
];
const MUSIC_TARGET = -24;
const LOOP = /^(motor|fuego|lluvia|viento|rio|ambiente|tormenta|tirolina|nadar)/;
const HEAVY = { sfx: 1 << 20, music: 4 << 20 };

// ffmpeg escribe la información en stderr
const info = (ff, args) => spawnSync(ff, ['-hide_banner', ...args], { encoding: 'utf8' }).stderr ?? '';
const volumes = (ff, file) => {
  const text = info(ff, ['-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const mean = Number(text.match(/mean_volume: (-?[\d.]+) dB/)?.[1] ?? -20);
  const max = Number(text.match(/max_volume: (-?[\d.]+) dB/)?.[1] ?? -1);
  return { mean, max };
};

function optimize(ff, sub, file) {
  const name = basename(file, extname(file)).replace(/-\d+$/, '');
  const music = sub === 'music' && !name.startsWith('radio-camion');
  const target = music ? MUSIC_TARGET : TARGETS.find(([re]) => re.test(name))?.[1] ?? -22;
  const { mean, max } = volumes(ff, file);
  // Ganancia hacia el objetivo, sin pasar de −1 dB de pico
  const gain = Math.min(target - mean, -1 - max).toFixed(1);
  const loop = sub === 'music' || LOOP.test(name);
  const filters = [];
  if (!loop) filters.push('silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.01');
  filters.push(`volume=${gain}dB`);
  if (loop) filters.push(sub === 'music' ? 'afade=t=in:d=0.25' : 'afade=t=in:d=0.03');
  const dur = Number(info(ff, ['-i', file]).match(/Duration: (\d+):(\d+):([\d.]+)/)?.slice(1).reduce((t, v) => t * 60 + Number(v), 0) ?? 0) || null;
  if (loop && dur) {
    const fade = sub === 'music' ? 1 : 0.06;
    filters.push(`afade=t=out:st=${Math.max(0, dur - fade).toFixed(2)}:d=${fade}`);
  }
  const out = join(AUDIO, sub, `${basename(file, extname(file))}.mp3`);
  const tmp = `${out}.tmp.mp3`;
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-af', filters.join(','), '-ar', '44100'];
  if (sub === 'sfx') args.push('-ac', '1', '-q:a', '4');
  else args.push('-q:a', '5');
  execFileSync(ff, [...args, '-c:a', 'libmp3lame', tmp]);
  // El original se guarda fuera del deploy
  mkdirSync(join(BACKUP, sub), { recursive: true });
  renameSync(file, join(BACKUP, sub, basename(file)));
  renameSync(tmp, out);
  return { file: basename(file), out: basename(out), gain, before: statSync(join(BACKUP, sub, basename(file))).size, after: statSync(out).size };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ff = findFfmpeg();
  const done = [];
  for (const sub of ['sfx', 'music']) {
    const dir = join(AUDIO, sub);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const path = join(dir, f);
      const ext = extname(f).toLowerCase();
      // Los .wav siempre; los demás solo si pesan de más
      if (ext === '.wav' || (['.mp3', '.ogg', '.m4a'].includes(ext) && statSync(path).size > HEAVY[sub] && !f.endsWith('.tmp.mp3'))) {
        if (ext === '.mp3') continue; // un .mp3 pesado se deja: reconvertirlo pierde calidad
        done.push(optimize(ff, sub, path));
      }
    }
  }
  const kb = (b) => `${Math.round(b / 1024)} KB`;
  for (const d of done) console.log(`${d.file} → ${d.out}  ${kb(d.before)} → ${kb(d.after)}  (${d.gain} dB)`);
  console.log(done.length ? `[audio] ${done.length} archivos optimizados; originales en audio-originales/` : '[audio] nada que optimizar');
}
