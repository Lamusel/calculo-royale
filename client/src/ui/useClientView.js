import { useEffect, useState } from 'react';
import { INTERACT_RADIUS, WEAPONS } from '@calculo-royale/shared/constants';
import { TRAINING } from '@calculo-royale/shared/mapLayout';
import { selfWeaponId } from '../net/GameClient.js';

// Lee el estado del GameClient a 10 Hz para la interfaz (sin re-renderizar a 60 fps)
export function useClientView(client, frameRef, phase) {
  const [view, setView] = useState({});

  useEffect(() => {
    let deathAt = 0;
    const read = () => {
      const now = performance.now();
      const me = frameRef.current.me;
      const self = client.self;
      if (self && !self.alive && !deathAt) deathAt = now;
      if (!self || self.alive) deathAt = 0;
      const rack =
        phase === 'lobby' && me && self?.alive
          ? TRAINING.racks.find((r) => Math.hypot(r.x - me.x, r.y - me.y) <= INTERACT_RADIUS)
          : null;
      setView({
        me: me && { x: me.x, y: me.y },
        self,
        latency: client.latency,
        reloadProgress:
          self && client.reloadEndsAt > now
            ? 1 - (client.reloadEndsAt - now) / WEAPONS[selfWeaponId(self)].reloadMs
            : null,
        killfeed: [...client.killfeed],
        damageFlashAt: client.damageFlashAt,
        deathAt,
        rack,
      });
    };
    read();
    const id = setInterval(read, 100);
    return () => clearInterval(id);
  }, [client, frameRef, phase]);

  return view;
}
