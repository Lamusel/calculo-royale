// Libera los puertos del entorno de desarrollo (servidor 3001 y Vite 5173): útil cuando quedó
// otro "npm run dev" abierto. Uso: npm run stop
import { execSync } from 'node:child_process';

const PORTS = [3001, 5173];
const windows = process.platform === 'win32';

function pidsOn(port) {
  try {
    if (windows) {
      return execSync(`netstat -ano -p tcp`, { encoding: 'utf8' })
        .split('\n')
        // El estado sale traducido según el idioma de Windows
        .filter((line) => /LISTENING|ESCUCHANDO/.test(line) && new RegExp(`:${port}\\s`).test(line))
        .map((line) => line.trim().split(/\s+/).pop());
    }
    return execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' }).split('\n');
  } catch {
    return []; // nadie lo usa (lsof sale con error si no encuentra nada)
  }
}

let stopped = 0;
for (const port of PORTS) {
  for (const pid of new Set(pidsOn(port).filter((p) => /^\d+$/.test(p) && p !== '0'))) {
    try {
      execSync(windows ? `taskkill /F /T /PID ${pid}` : `kill -9 ${pid}`, { stdio: 'ignore' });
      console.log(`Puerto ${port}: proceso ${pid} detenido`);
      stopped++;
    } catch {
      console.log(`Puerto ${port}: no se pudo detener el proceso ${pid}`);
    }
  }
}
console.log(stopped ? 'Listo: puertos libres.' : 'Los puertos 3001 y 5173 ya estaban libres.');
