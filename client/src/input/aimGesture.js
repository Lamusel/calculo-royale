import { AIM_CANCEL_ZONE, WEAPONS } from '@calculo-royale/shared/constants';
import { BUTTONS } from '@calculo-royale/shared/protocol';
import { currentAim, grenadeDistance, inputState, press } from './inputState.js';

// Un toque más corto que esto y sin salir de la zona de cancelación = disparo con auto apuntado
export const TAP_MS = 250;

// Gesto del joystick derecho, separado de nipplejs para poder probarlo.
//  - Toque rápido: dispara solo al enemigo visible más cercano (lo decide el servidor).
//  - Arrastrar fuera de la zona de cancelación (30 % del radio): aparece la mira.
//    Pistola, escopeta y rifle disparan mientras arrastras; francotirador y granada al soltar.
//  - Volver a la zona de cancelación antes de soltar: no dispara.
//  - Al soltar, el soldado conserva la última dirección de mira.
export function createAimGesture(s = inputState) {
  let g = null;
  const releaseToFire = () => s.grenadeMode || Boolean(WEAPONS[s.weapon]?.releaseToFire);

  return {
    get active() {
      return g !== null;
    },
    // Salió de la zona de cancelación y volvió: soltar ahora no hace nada
    get cancelling() {
      return g !== null && g.maxForce > AIM_CANCEL_ZONE && g.force <= AIM_CANCEL_ZONE;
    },

    start(now) {
      g = { startedAt: now, force: 0, maxForce: 0 };
    },

    // (x, y): vector del joystick, y hacia arriba, magnitud hasta 1
    move(x, y) {
      if (!g) return;
      const force = Math.min(Math.hypot(x, y), 1);
      g.force = force;
      g.maxForce = Math.max(g.maxForce, force);
      s.stickForce = force;
      s.stickAim = force > AIM_CANCEL_ZONE ? Math.atan2(y, x) : null;
      s.fireHeld = !releaseToFire() && s.stickAim !== null;
    },

    end(now) {
      if (!g) return;
      s.fireHeld = false;
      const aimed = s.stickAim !== null;
      const isTap = g.maxForce <= AIM_CANCEL_ZONE && now - g.startedAt < TAP_MS;

      if (s.grenadeMode) {
        // Lanza solo si soltó apuntando; un toque o volver al centro no lanza y el modo sigue activo
        if (aimed) {
          press(BUTTONS.GRENADE, s.stickAim, grenadeDistance());
          s.grenadeMode = false;
        }
      } else if (isTap) {
        press(BUTTONS.FIRE | BUTTONS.AUTO, currentAim(now));
      } else if (aimed && releaseToFire()) {
        press(BUTTONS.FIRE, s.stickAim);
      }

      if (aimed) {
        s.retainedAim = s.stickAim;
        s.retainedAt = now;
      }
      s.stickAim = null;
      s.stickForce = 0;
      g = null;
    },
  };
}
